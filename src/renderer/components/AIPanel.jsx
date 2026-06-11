import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MarioFaceIcon } from './MarioSprite'

const PROVIDERS = [
  { value: 'anthropic', label: 'Claude',  color: '#1D9E75' },
  { value: 'openai',    label: 'GPT',     color: '#74aa9c' },
  { value: 'gemini',    label: 'Gemini',  color: '#4285f4' },
  { value: 'ollama',    label: 'Ollama',  color: '#EF9F27' },
]

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai:    'gpt-4o',
  gemini:    'gemini-2.0-flash',
  ollama:    'llama3',
}

async function buildSystemPrompt() {
  if (!window.electronAPI) return ''
  try {
    const [name, xp, level, epics, streaks, todayLogs] = await Promise.all([
      window.electronAPI.settings.get('user_name'),
      window.electronAPI.settings.get('xp_total'),
      window.electronAPI.settings.get('xp_level'),
      window.electronAPI.db.query('SELECT id, name, status, progress, horizon FROM epics ORDER BY updated_at DESC', []),
      window.electronAPI.db.query('SELECT id, name, current_streak, longest_streak FROM streak_habits ORDER BY current_streak DESC', []),
      window.electronAPI.db.query(
        "SELECT h.id, h.name FROM streak_logs l JOIN streak_habits h ON h.id = l.habit_id WHERE l.logged_date = date('now')", []
      ),
    ])

    const epicsList    = epics.map(e => `  • [id:${e.id}] "${e.name}" — ${e.status}, ${e.progress}% done, horizon: ${e.horizon}`).join('\n')
    const habitsList   = streaks.map(s => `  • [id:${s.id}] "${s.name}" — ${s.current_streak} day streak (best: ${s.longest_streak})`).join('\n')
    const loggedToday  = todayLogs.length ? todayLogs.map(l => `"${l.name}"`).join(', ') : 'none yet'

    return `You are Life OS AI — a strategic productivity coach inside a gamified desktop app for ${name || 'the user'}.

== CONFIRMATION-FIRST RULE (IMPORTANT) ==
For big actions (create_goal, add_habit, add_contact): DO NOT execute immediately.
Instead follow this flow:
  1. Ask 1-2 focused clarifying questions: What's the real goal? What's the timeline? Any constraints?
  2. Propose your full plan in text: name, timeframe, and a detailed numbered subtask list
  3. End with: "Want me to set this up in Life OS? Just say yes! 🎯"
  4. ONLY include the action block AFTER user says yes / "do it" / "go ahead" / "looks good" / "create it"

For simple direct actions (navigate, log streak, add a single task to existing epic) — act immediately, no confirmation needed.

== SUBTASK QUALITY RULES ==
When you propose or create subtasks, every single one must be:
- SPECIFIC: includes what exactly to do, not just a vague topic
  ✗ Bad: "Study math"
  ✓ Good: "Complete Khan Academy Calculus Unit 1-3 (est. 8 hrs)"
- MEASURABLE: has a clear done condition
  ✗ Bad: "Practice coding"
  ✓ Good: "Build 3 portfolio projects: a CLI tool, a web scraper, and a REST API"
- TIME-AWARE: scoped to ~1-3 weeks of work
- SEQUENTIAL: ordered from foundational → advanced
- 6-8 subtasks minimum for any meaningful goal

== ACTIONS ==
Only ONE action block per message. Format:

Navigate:
\`\`\`action
{"type":"navigate","to":"/epics"}
\`\`\`
Pages: /dashboard /epics /epics/:id /streaks /time-audit /network /weekly /energy /settings

Add task to epic (use epic_id from live state):
\`\`\`action
{"type":"add_task","epic_id":1,"title":"Specific task title"}
\`\`\`

Log streak habit (use habit_id):
\`\`\`action
{"type":"log_streak","habit_id":1}
\`\`\`

Add new habit:
\`\`\`action
{"type":"add_habit","name":"Morning run","description":"30 min every morning","icon":"flame"}
\`\`\`

Add contact:
\`\`\`action
{"type":"add_contact","name":"Jane","role":"Engineer","company":"Google","relationship_type":"mentor","notes":"Met at hackathon"}
\`\`\`

Create goal (ONLY after user confirms):
\`\`\`action
{"type":"create_goal","name":"Goal name","description":"One-sentence motivation","icon":"code","color":"teal","horizon":"quarter","end_date":"2026-09-11","subtasks":["Week 1-2: Specific deliverable A","Week 3-4: Specific deliverable B","Week 5-6: Specific deliverable C","Week 7-8: Specific deliverable D","Week 9-10: Specific deliverable E","Week 11-12: Final milestone F"]}
\`\`\`
icon: bolt star briefcase book language code heart flame target brain rocket trophy
color: teal | amber | purple
horizon: quarter (≤3mo) | year (≤1yr) | longterm (multi-year)
end_date: ISO date string matching the timeframe the user specified

== LIVE APP STATE ==
${name || 'User'} — Level ${level || 1} — ${xp || 0} XP

Epics:
${epicsList || '  (none yet)'}

Habits:
${habitsList || '  (none yet)'}

Logged today: ${loggedToday}

Keep replies focused and energetic. When proposing a plan, format the subtasks as a numbered list so the user can read and react before confirming.`
  } catch {
    return 'You are a helpful AI assistant inside a personal productivity app.'
  }
}

function parseAction(text) {
  const match = text.match(/```action\n([\s\S]*?)\n```/)
  if (!match) return { cleanText: text.trim(), action: null }
  try {
    return {
      cleanText: text.replace(/```action\n[\s\S]*?\n```/, '').trim(),
      action:    JSON.parse(match[1]),
    }
  } catch {
    return { cleanText: text.trim(), action: null }
  }
}

const WELCOME = {
  role: 'assistant',
  content: "Hey! I'm your Life OS AI. I can see all your epics, streaks, and progress — and I remember our past conversations.\n\nAsk me anything — or try: \"What should I focus on today?\" or \"Log my Mandarin streak\" or \"Add a task to my HSK epic\".",
  actionResult: null,
}

export default function AIPanel({ open, onClose, playSound }) {
  const navigate = useNavigate()

  const [messages, setMessages]       = useState([WELCOME])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [provider, setProvider]       = useState('anthropic')
  const [model, setModel]             = useState('claude-sonnet-4-20250514')
  const [ollamaUrl, setOllamaUrl]     = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3')
  const bottomRef          = useRef(null)
  const hasLoadedHistory   = useRef(false)

  useEffect(() => {
    if (open) {
      loadSettings()
      if (!hasLoadedHistory.current) {
        hasLoadedHistory.current = true
        loadHistory()
      }
    }
  }, [open])

  async function loadHistory() {
    if (!window.electronAPI) return
    try {
      const rows = await window.electronAPI.db.query(
        'SELECT role, content FROM ai_messages ORDER BY id ASC',
        []
      )
      if (rows.length > 0) {
        const history = rows.map(r => ({ role: r.role, content: r.content, actionResult: null }))
        setMessages([WELCOME, ...history])
      }
    } catch {}
  }

  async function saveMessages(userText, aiText) {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.db.run('INSERT INTO ai_messages (role,content) VALUES (?,?)', ['user', userText])
      await window.electronAPI.db.run('INSERT INTO ai_messages (role,content) VALUES (?,?)', ['assistant', aiText])
      // Keep last 80 messages (40 exchanges)
      await window.electronAPI.db.run(
        'DELETE FROM ai_messages WHERE id NOT IN (SELECT id FROM ai_messages ORDER BY id DESC LIMIT 80)',
        []
      )
    } catch {}
  }

  async function clearHistory() {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.db.run('DELETE FROM ai_messages', [])
      setMessages([WELCOME])
    } catch {}
  }

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function loadSettings() {
    if (!window.electronAPI) return
    try {
      const [prov, mod, ep, om] = await Promise.all([
        window.electronAPI.settings.get('ai_provider'),
        window.electronAPI.settings.get('ai_model'),
        window.electronAPI.settings.get('ollama_endpoint'),
        window.electronAPI.settings.get('ollama_model'),
      ])
      if (prov) setProvider(prov)
      if (mod)  setModel(mod)
      if (ep)   setOllamaUrl(ep)
      if (om)   setOllamaModel(om)
    } catch {}
  }

  function switchProvider(p) {
    setProvider(p)
    setModel(DEFAULT_MODELS[p] || '')
  }

  async function executeAction(action) {
    if (!action || !window.electronAPI) return null
    try {
      switch (action.type) {
        case 'navigate':
          navigate(action.to)
          return `📍 Navigated to ${action.to}`

        case 'add_task': {
          const epicId = action.epic_id
          if (!epicId) return '⚠ No epic_id provided'
          await window.electronAPI.db.run(
            'INSERT INTO subtasks (epic_id, title, status) VALUES (?,?,?)',
            [epicId, action.title, 'not_started']
          )
          const epic = await window.electronAPI.db.get('SELECT name FROM epics WHERE id=?', [epicId])
          navigate(`/epics/${epicId}`)
          return `✅ Added "${action.title}" to "${epic?.name || 'epic'}"`
        }

        case 'log_streak': {
          const habitId = action.habit_id
          if (!habitId) return '⚠ No habit_id provided'
          await window.electronAPI.db.run(
            "INSERT OR IGNORE INTO streak_logs (habit_id, logged_date, completed) VALUES (?, date('now'), 1)",
            [habitId]
          )
          const habit = await window.electronAPI.db.get(
            'SELECT name, current_streak, longest_streak FROM streak_habits WHERE id=?', [habitId]
          )
          navigate('/streaks')
          if (habit) {
            const ns = (habit.current_streak || 0) + 1
            await window.electronAPI.db.run(
              'UPDATE streak_habits SET current_streak=?, longest_streak=? WHERE id=?',
              [ns, Math.max(habit.longest_streak || 0, ns), habitId]
            )
            return `🔥 Logged "${habit.name}" — now ${ns} days!`
          }
          return '✅ Streak logged'
        }

        case 'add_habit': {
          await window.electronAPI.db.run(
            'INSERT INTO streak_habits (name, description, icon, current_streak, longest_streak) VALUES (?,?,?,0,0)',
            [action.name, action.description || '', action.icon || 'flame']
          )
          navigate('/streaks')
          return `🔥 Added habit "${action.name}" — start your streak today!`
        }

        case 'add_contact': {
          await window.electronAPI.db.run(
            'INSERT INTO contacts (name, role, company, relationship_type, notes) VALUES (?,?,?,?,?)',
            [action.name, action.role || '', action.company || '', action.relationship_type || 'other', action.notes || '']
          )
          navigate('/network')
          return `🤝 Added "${action.name}"${action.company ? ` from ${action.company}` : ''} to your network`
        }

        case 'add_epic': {
          await window.electronAPI.db.run(
            'INSERT INTO epics (name, description, horizon, status, progress) VALUES (?,?,?,?,0)',
            [action.name, action.description || '', action.horizon || 'quarter', 'not_started']
          )
          navigate('/epics')
          return `🚀 Created epic "${action.name}"`
        }

        case 'create_goal': {
          const res = await window.electronAPI.db.run(
            'INSERT INTO epics (name, description, icon, color, horizon, end_date, status, progress) VALUES (?,?,?,?,?,?,?,0)',
            [
              action.name,
              action.description || '',
              action.icon        || 'bolt',
              action.color       || 'teal',
              action.horizon     || 'quarter',
              action.end_date    || null,
              'not_started',
            ]
          )
          const epicId = res.lastInsertRowid
          const subtasks = Array.isArray(action.subtasks) ? action.subtasks : []
          for (const title of subtasks) {
            await window.electronAPI.db.run(
              'INSERT INTO subtasks (epic_id, title, status) VALUES (?,?,?)',
              [epicId, title.trim(), 'not_started']
            )
          }
          await window.electronAPI.xp.award(20)
          navigate(`/epics/${epicId}`)
          const list = subtasks.map((t, i) => `  ${i + 1}. ${t}`).join('\n')
          return `🎯 Created "${action.name}" +20 XP\n\nTasks:\n${list}`
        }

        default:
          return null
      }
    } catch (e) {
      return `⚠ Action failed: ${e.message}`
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg = { role: 'user', content: text, actionResult: null }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)

    try {
      const systemPrompt = await buildSystemPrompt()
      const apiMessages  = history.map(m => ({ role: m.role, content: m.content }))
      const effectiveModel   = provider === 'ollama' ? ollamaModel : model
      const effectiveEndpoint = provider === 'ollama' ? ollamaUrl   : undefined

      const raw = await window.electronAPI.ai.chat(
        apiMessages, provider, effectiveModel, effectiveEndpoint, systemPrompt
      )

      playSound?.('message')
      const { cleanText, action } = parseAction(raw)
      const actionResult = await executeAction(action)

      setMessages([...history, { role: 'assistant', content: cleanText, actionResult }])
      saveMessages(text, cleanText)
    } catch (e) {
      setMessages([...history, { role: 'assistant', content: `Error: ${e.message}`, actionResult: null }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const activeProv = PROVIDERS.find(p => p.value === provider)

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[530px] bg-white rounded-card shadow-2xl border border-teal-border flex flex-col slide-up">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-teal-border">
        <div className="flex items-center gap-2">
          <MarioFaceIcon px={3} />
          <div>
            <span className="font-bold text-[13px] text-teal-dark">Life OS AI</span>
            <div className="text-[9px] font-bold text-primary" style={{ marginTop: -1 }}>💾 memory on</div>
          </div>
        </div>
        {/* Provider tabs */}
        <div className="flex items-center gap-1">
          {PROVIDERS.map(p => (
            <button
              key={p.value}
              onClick={() => switchProvider(p.value)}
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                provider === p.value ? 'text-white' : 'text-text-hint hover:text-text-sec'
              }`}
              style={provider === p.value ? { background: p.color } : {}}
            >
              {p.label}
            </button>
          ))}
          {/* Clear memory */}
          <button
            onClick={clearHistory}
            title="Clear chat memory"
            className="ml-1 text-text-hint hover:text-red-400 transition-colors p-1"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
          <button onClick={onClose} className="text-text-muted hover:text-text-sec transition-colors p-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Model / Ollama config row */}
      <div className="px-3 py-2 bg-teal-pale border-b border-teal-border flex items-center gap-2">
        {provider === 'ollama' ? (
          <>
            <input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="flex-1 text-[10px] px-2 py-1 bg-white border border-teal-border rounded-[6px] outline-none focus:border-primary text-text-sec" />
            <input value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}
              placeholder="llama3"
              className="w-20 text-[10px] px-2 py-1 bg-white border border-teal-border rounded-[6px] outline-none focus:border-primary text-text-sec" />
          </>
        ) : (
          <input value={model} onChange={e => setModel(e.target.value)}
            className="flex-1 text-[10px] px-2 py-1 bg-white border border-teal-border rounded-[6px] outline-none focus:border-primary text-text-sec" />
        )}
        <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: activeProv?.color || '#1D9E75' }}>
          {activeProv?.label}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[88%] px-3 py-2 rounded-[14px] text-[12px] leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-teal-light text-text-pri rounded-bl-sm'
            }`}>
              {m.content}
            </div>
            {m.actionResult && (
              <div className="mt-1 px-3 py-2 bg-amber/10 border border-amber/30 rounded-[10px] max-w-[88%]">
                <span className="text-[10px] font-bold text-amber-dark whitespace-pre-wrap leading-relaxed">{m.actionResult}</span>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-teal-light px-3 py-2 rounded-[14px] rounded-bl-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-teal-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={`Ask ${activeProv?.label || 'AI'}… or say "log my streak"`}
            className="flex-1 text-[12px] px-3 py-2 bg-teal-pale border border-teal-border rounded-[10px] outline-none focus:border-primary text-text-pri placeholder:text-text-hint"
          />
          <button onClick={send} disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-[10px] bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-teal-med transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
