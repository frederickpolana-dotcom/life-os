import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MarioFaceIcon } from './MarioSprite'
import { buildSystemPrompt, fetchMemories } from '../utils/systemPrompt'

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

// ── Context builder ───────────────────────────────────────────────────────────

async function buildChatSystemPrompt() {
  if (!window.electronAPI) return buildSystemPrompt({})
  try {
    const [xp, level, epics, subtasks, habits, todayLogs, memories] = await Promise.all([
      window.electronAPI.settings.get('xp_total'),
      window.electronAPI.settings.get('xp_level'),
      window.electronAPI.db.query(
        "SELECT id, name, status, progress, horizon FROM epics WHERE status != 'done' ORDER BY updated_at DESC",
        []
      ),
      window.electronAPI.db.query(
        `SELECT s.id, s.title, s.status, s.is_recurring, s.epic_id,
                CASE WHEN rc.subtask_id IS NOT NULL THEN 1 ELSE 0 END as done_today
         FROM subtasks s
         LEFT JOIN recurring_completions rc
           ON rc.subtask_id = s.id AND rc.completed_date = date('now')
         WHERE s.parent_id IS NULL
         ORDER BY s.epic_id, s.is_recurring, s.id`,
        []
      ).catch(() => []),
      window.electronAPI.db.query(
        'SELECT id, name, current_streak, longest_streak FROM streak_habits ORDER BY current_streak DESC',
        []
      ),
      window.electronAPI.db.query(
        "SELECT h.id FROM streak_logs l JOIN streak_habits h ON h.id = l.habit_id WHERE l.logged_date = date('now')",
        []
      ),
      fetchMemories(),
    ])

    // Group subtasks by epic
    const tasksByEpic = {}
    for (const s of subtasks) {
      if (!tasksByEpic[s.epic_id]) tasksByEpic[s.epic_id] = { milestones: [], daily: [] }
      if (s.is_recurring) tasksByEpic[s.epic_id].daily.push(s)
      else tasksByEpic[s.epic_id].milestones.push(s)
    }
    const loggedIds = new Set(todayLogs.map(r => r.id))

    const epicContext = epics.length === 0 ? '  (none yet)' : epics.map(e => {
      const g = tasksByEpic[e.id] || { milestones: [], daily: [] }
      const lines = [`[epic_id:${e.id}] "${e.name}" — ${e.status}, ${e.progress}% (${e.horizon})`]
      if (g.milestones.length > 0) {
        lines.push('  Milestones:')
        g.milestones.slice(0, 8).forEach(t => {
          lines.push(`    [subtask_id:${t.id}] ${t.status === 'done' ? '✅' : '○'} ${t.title}`)
        })
        if (g.milestones.length > 8) lines.push(`    … +${g.milestones.length - 8} more`)
      }
      if (g.daily.length > 0) {
        lines.push('  Daily checklist:')
        g.daily.forEach(t => {
          lines.push(`    [subtask_id:${t.id}] ${t.done_today ? '✅ done today' : '○ pending'} ${t.title}`)
        })
      }
      return lines.join('\n')
    }).join('\n\n')

    const habitContext = habits.length === 0 ? '  (none)' : habits.map(h =>
      `[habit_id:${h.id}] "${h.name}" — 🔥${h.current_streak} streak${loggedIds.has(h.id) ? ' ✅ logged today' : ''}`
    ).join('\n')

    const extraRules = `\
== LIVE APP STATE ==
Level ${level || 1} · ${xp || 0} XP total

Active Epics:
${epicContext}

Streak Habits:
${habitContext}

== AVAILABLE ACTIONS ==
Include at most ONE \`\`\`action block per reply. Format:
\`\`\`action
{"type":"...", ...}
\`\`\`

─ NAVIGATION
{"type":"navigate","to":"/epics"}
Pages: /dashboard /epics /epics/:id /streaks /time-audit /network /weekly /energy /settings

─ TASK MANAGEMENT
Add milestone (one-time):
{"type":"add_task","epic_id":1,"title":"Specific title"}

Add daily task (repeating):
{"type":"add_daily_task","epic_id":1,"title":"Daily task name"}

Move task → daily checklist:
{"type":"move_to_daily","subtask_id":5}
→ Use when user says "move X to daily", "make X repeat daily", "X should be a daily habit"

Move task → milestones:
{"type":"move_to_milestone","subtask_id":7}
→ Use when user says "move X to milestones", "make X one-time"

Complete a milestone (+15 XP):
{"type":"complete_task","subtask_id":5,"epic_id":1}

Log daily epic task for today (+10 XP):
{"type":"log_daily_epic_task","subtask_id":7}

Delete a task:
{"type":"delete_task","subtask_id":5}
→ ONLY use when user explicitly says delete/remove

Update epic status:
{"type":"update_epic","epic_id":1,"status":"in_progress"}
status: not_started | in_progress | done

─ HABITS
Log streak habit (+10 XP):
{"type":"log_streak","habit_id":1}

Add habit:
{"type":"add_habit","name":"Morning run","description":"","icon":"flame"}

─ NETWORK
Add contact:
{"type":"add_contact","name":"Jane","role":"Engineer","company":"Google","relationship_type":"mentor","notes":""}
relationship_type: mentor | peer | lead | other

─ CREATE FULL GOAL (ask for confirmation first)
{"type":"create_goal","name":"Goal name","description":"One-sentence motivation","icon":"bolt","color":"teal","horizon":"quarter","end_date":"2026-09-30","subtasks":["Week 1-2: Deliverable A","Week 3-4: Deliverable B","Week 5-6: Deliverable C","Week 7-8: Deliverable D","Week 9-10: Deliverable E","Week 11-12: Final milestone F"]}
icon: bolt star briefcase book language code heart flame target brain rocket trophy
color: teal | amber | purple
horizon: quarter (≤3mo) | year (≤1yr) | longterm (multi-year)

== WHEN TO ACT IMMEDIATELY vs ASK FIRST ==
ACT IMMEDIATELY (no confirmation):
  navigate, log_streak, log_daily_epic_task, complete_task
  move_to_daily, move_to_milestone, update_epic, delete_task
  add_task / add_daily_task when title is clear from user's message

ASK FIRST, THEN ACT:
  create_goal → ask 1-2 questions (timeline, main motivation), then propose subtask breakdown, end with "Want me to set this up? Just say yes!"
  add_habit → confirm the name
  add_contact → confirm name/role/company`

    return buildSystemPrompt({ memories, extraRules })
  } catch {
    return buildSystemPrompt({})
  }
}

// ── Action parser ─────────────────────────────────────────────────────────────

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

// ── Welcome message ───────────────────────────────────────────────────────────

const WELCOME = {
  role: 'assistant',
  content: "Hey! I'm your Life OS AI. I can see all your epics, tasks, streaks, and progress.\n\nTry: \"Move my gym task to the daily checklist\" · \"Log my Mandarin streak\" · \"What should I focus on today?\" · \"Create a weight loss plan\"",
  actionResult: null,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AIPanel({ open, onClose, playSound, awardXp }) {
  const navigate = useNavigate()

  const [messages, setMessages]       = useState([WELCOME])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [provider, setProvider]       = useState('anthropic')
  const [model, setModel]             = useState('claude-sonnet-4-20250514')
  const [ollamaUrl, setOllamaUrl]     = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3')
  const [attachedDoc, setAttachedDoc] = useState(null)
  const bottomRef        = useRef(null)
  const hasLoadedHistory = useRef(false)

  useEffect(() => {
    if (open) {
      loadSettings()
      if (!hasLoadedHistory.current) {
        hasLoadedHistory.current = true
        loadHistory()
      }
    }
  }, [open])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function loadHistory() {
    if (!window.electronAPI) return
    try {
      const rows = await window.electronAPI.db.query('SELECT role, content FROM ai_messages ORDER BY id ASC', [])
      if (rows.length > 0) {
        setMessages([WELCOME, ...rows.map(r => ({ role: r.role, content: r.content, actionResult: null }))])
      }
    } catch {}
  }

  async function saveMessages(userText, aiText) {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.db.run('INSERT INTO ai_messages (role,content) VALUES (?,?)', ['user', userText])
      await window.electronAPI.db.run('INSERT INTO ai_messages (role,content) VALUES (?,?)', ['assistant', aiText])
      await window.electronAPI.db.run(
        'DELETE FROM ai_messages WHERE id NOT IN (SELECT id FROM ai_messages ORDER BY id DESC LIMIT 80)', []
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

  // Award XP — uses prop (gets toasts/confetti) or falls back to direct API
  async function doAwardXp(amount) {
    if (awardXp) return awardXp(amount)
    return window.electronAPI.xp.award(amount).catch(() => null)
  }

  // ── Action executor ─────────────────────────────────────────────────────────

  async function executeAction(action) {
    if (!action || !window.electronAPI) return null
    try {
      switch (action.type) {

        case 'navigate':
          navigate(action.to)
          return `📍 Navigated to ${action.to}`

        case 'add_task': {
          if (!action.epic_id) return '⚠ Missing epic_id'
          await window.electronAPI.db.run(
            'INSERT INTO subtasks (epic_id, title, status, is_recurring) VALUES (?,?,?,0)',
            [action.epic_id, action.title, 'not_started']
          )
          // Recalc progress
          const rows = await window.electronAPI.db.query(
            "SELECT COUNT(*) as t, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as d FROM subtasks WHERE epic_id=? AND parent_id IS NULL AND is_recurring=0",
            [action.epic_id]
          )
          const pct = rows[0]?.t > 0 ? Math.round((rows[0].d / rows[0].t) * 100) : 0
          await window.electronAPI.db.run('UPDATE epics SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [pct, action.epic_id])
          const epic = await window.electronAPI.db.get('SELECT name FROM epics WHERE id=?', [action.epic_id])
          navigate(`/epics/${action.epic_id}`)
          return `✅ Added milestone "${action.title}" to "${epic?.name || 'epic'}"`
        }

        case 'add_daily_task': {
          if (!action.epic_id) return '⚠ Missing epic_id'
          await window.electronAPI.db.run(
            'INSERT INTO subtasks (epic_id, title, status, is_recurring) VALUES (?,?,?,1)',
            [action.epic_id, action.title, 'not_started']
          )
          const epic = await window.electronAPI.db.get('SELECT name FROM epics WHERE id=?', [action.epic_id])
          navigate(`/epics/${action.epic_id}`)
          return `🔄 Added daily task "${action.title}" to "${epic?.name || 'epic'}" — earns +10 XP each day`
        }

        case 'move_to_daily': {
          if (!action.subtask_id) return '⚠ Missing subtask_id'
          await window.electronAPI.db.run(
            "UPDATE subtasks SET is_recurring=1, status='not_started', completed_at=NULL WHERE id=?",
            [action.subtask_id]
          )
          const t = await window.electronAPI.db.get('SELECT title, epic_id FROM subtasks WHERE id=?', [action.subtask_id])
          if (t) {
            // Recalc epic progress (task moved out of milestones)
            const rows = await window.electronAPI.db.query(
              "SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM subtasks WHERE epic_id=? AND parent_id IS NULL AND is_recurring=0",
              [t.epic_id]
            )
            const pct = rows[0]?.total > 0 ? Math.round((rows[0].done / rows[0].total) * 100) : 0
            await window.electronAPI.db.run('UPDATE epics SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [pct, t.epic_id])
            navigate(`/epics/${t.epic_id}`)
            return `🔄 Moved "${t.title}" to the Daily Checklist — it will now repeat every day`
          }
          return '⚠ Task not found'
        }

        case 'move_to_milestone': {
          if (!action.subtask_id) return '⚠ Missing subtask_id'
          await window.electronAPI.db.run(
            "UPDATE subtasks SET is_recurring=0 WHERE id=?",
            [action.subtask_id]
          )
          const t = await window.electronAPI.db.get('SELECT title, epic_id FROM subtasks WHERE id=?', [action.subtask_id])
          if (t) {
            const rows = await window.electronAPI.db.query(
              "SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM subtasks WHERE epic_id=? AND parent_id IS NULL AND is_recurring=0",
              [t.epic_id]
            )
            const pct = rows[0]?.total > 0 ? Math.round((rows[0].done / rows[0].total) * 100) : 0
            await window.electronAPI.db.run('UPDATE epics SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [pct, t.epic_id])
            navigate(`/epics/${t.epic_id}`)
            return `📌 Moved "${t.title}" to Milestones — complete it once for +15 XP`
          }
          return '⚠ Task not found'
        }

        case 'complete_task': {
          if (!action.subtask_id) return '⚠ Missing subtask_id'
          await window.electronAPI.db.run(
            "UPDATE subtasks SET status='done', completed_at=CURRENT_TIMESTAMP WHERE id=?",
            [action.subtask_id]
          )
          const t = await window.electronAPI.db.get('SELECT title, epic_id FROM subtasks WHERE id=?', [action.subtask_id])
          const epicId = action.epic_id || t?.epic_id
          if (epicId) {
            const rows = await window.electronAPI.db.query(
              "SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM subtasks WHERE epic_id=? AND parent_id IS NULL AND is_recurring=0",
              [epicId]
            )
            const pct = rows[0]?.total > 0 ? Math.round((rows[0].done / rows[0].total) * 100) : 0
            await window.electronAPI.db.run('UPDATE epics SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [pct, epicId])
          }
          await doAwardXp(15)
          navigate(epicId ? `/epics/${epicId}` : '/epics')
          return `✅ Completed "${t?.title || 'task'}" +15 XP`
        }

        case 'log_daily_epic_task': {
          if (!action.subtask_id) return '⚠ Missing subtask_id'
          await window.electronAPI.db.run(
            "INSERT OR IGNORE INTO recurring_completions (subtask_id, completed_date) VALUES (?, date('now'))",
            [action.subtask_id]
          )
          await doAwardXp(10)
          const t = await window.electronAPI.db.get('SELECT title FROM subtasks WHERE id=?', [action.subtask_id])
          return `🔄 Logged "${t?.title || 'daily task'}" for today +10 XP`
        }

        case 'delete_task': {
          if (!action.subtask_id) return '⚠ Missing subtask_id'
          const t = await window.electronAPI.db.get('SELECT title, epic_id, is_recurring FROM subtasks WHERE id=?', [action.subtask_id])
          if (!t) return '⚠ Task not found'
          await window.electronAPI.db.run('DELETE FROM subtasks WHERE id=?', [action.subtask_id])
          if (!t.is_recurring) {
            const rows = await window.electronAPI.db.query(
              "SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM subtasks WHERE epic_id=? AND parent_id IS NULL AND is_recurring=0",
              [t.epic_id]
            )
            const pct = rows[0]?.total > 0 ? Math.round((rows[0].done / rows[0].total) * 100) : 0
            await window.electronAPI.db.run('UPDATE epics SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [pct, t.epic_id])
          }
          navigate(`/epics/${t.epic_id}`)
          return `🗑 Deleted "${t.title}"`
        }

        case 'update_epic': {
          if (!action.epic_id) return '⚠ Missing epic_id'
          await window.electronAPI.db.run(
            'UPDATE epics SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            [action.status, action.epic_id]
          )
          const e = await window.electronAPI.db.get('SELECT name FROM epics WHERE id=?', [action.epic_id])
          navigate(`/epics/${action.epic_id}`)
          return `📋 "${e?.name || 'Epic'}" → ${action.status.replace('_', ' ')}`
        }

        case 'log_streak': {
          if (!action.habit_id) return '⚠ Missing habit_id'
          await window.electronAPI.db.run(
            "INSERT OR IGNORE INTO streak_logs (habit_id, logged_date, completed) VALUES (?, date('now'), 1)",
            [action.habit_id]
          )
          const habit = await window.electronAPI.db.get(
            'SELECT name, current_streak, longest_streak FROM streak_habits WHERE id=?', [action.habit_id]
          )
          if (habit) {
            const ns = (habit.current_streak || 0) + 1
            const nl = Math.max(habit.longest_streak || 0, ns)
            await window.electronAPI.db.run(
              'UPDATE streak_habits SET current_streak=?, longest_streak=? WHERE id=?',
              [ns, nl, action.habit_id]
            )
            await doAwardXp(10)
            navigate('/streaks')
            return `🔥 Logged "${habit.name}" — ${ns} day streak! +10 XP`
          }
          return '✅ Streak logged'
        }

        case 'add_habit': {
          await window.electronAPI.db.run(
            'INSERT INTO streak_habits (name, description, icon, current_streak, longest_streak) VALUES (?,?,?,0,0)',
            [action.name, action.description || '', action.icon || 'flame']
          )
          navigate('/streaks')
          return `🔥 Added habit "${action.name}" — log it daily to build your streak!`
        }

        case 'add_contact': {
          await window.electronAPI.db.run(
            'INSERT INTO contacts (name, role, company, relationship_type, notes) VALUES (?,?,?,?,?)',
            [action.name, action.role || '', action.company || '', action.relationship_type || 'other', action.notes || '']
          )
          navigate('/network')
          return `🤝 Added "${action.name}"${action.company ? ` @ ${action.company}` : ''} to your network`
        }

        case 'add_epic': {
          const res = await window.electronAPI.db.run(
            'INSERT INTO epics (name, description, horizon, status, progress) VALUES (?,?,?,?,0)',
            [action.name, action.description || '', action.horizon || 'quarter', 'not_started']
          )
          await doAwardXp(20)
          navigate(`/epics/${res.lastInsertRowid}`)
          return `🚀 Created epic "${action.name}" +20 XP`
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
              'INSERT INTO subtasks (epic_id, title, status, is_recurring) VALUES (?,?,?,0)',
              [epicId, title.trim(), 'not_started']
            )
          }
          await doAwardXp(20)
          navigate(`/epics/${epicId}`)
          const list = subtasks.map((t, i) => `  ${i + 1}. ${t}`).join('\n')
          return `🎯 Created "${action.name}" with ${subtasks.length} milestones +20 XP\n\n${list}`
        }

        default:
          return null
      }
    } catch (e) {
      return `⚠ Action failed: ${e.message}`
    }
  }

  // ── Document picker ─────────────────────────────────────────────────────────

  async function pickDocument() {
    if (!window.electronAPI?.files) return
    const result = await window.electronAPI.files.readDocument()
    if (!result) return
    if (result.error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${result.error}`, actionResult: null }])
      return
    }
    setAttachedDoc({ name: result.name, content: result.content })
  }

  // ── Send ────────────────────────────────────────────────────────────────────

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg = { role: 'user', content: text, actionResult: null }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)

    try {
      const systemPrompt = await buildChatSystemPrompt()
      const docContext   = attachedDoc
        ? `\n\n== ATTACHED DOCUMENT: ${attachedDoc.name} ==\n${attachedDoc.content}\n== END DOCUMENT ==`
        : ''
      const apiMessages    = history.map(m => ({ role: m.role, content: m.content }))
      const effectiveModel    = provider === 'ollama' ? ollamaModel : model
      const effectiveEndpoint = provider === 'ollama' ? ollamaUrl   : undefined

      const raw = await window.electronAPI.ai.chat(
        apiMessages, provider, effectiveModel, effectiveEndpoint, systemPrompt + docContext
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

  // ── Render ──────────────────────────────────────────────────────────────────

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
            <div className="text-[9px] font-bold text-primary" style={{ marginTop: -1 }}>💾 memory · ⚡ actions</div>
          </div>
        </div>
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
          <button onClick={clearHistory} title="Clear chat memory" className="ml-1 text-text-hint hover:text-red-400 transition-colors p-1">
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

      {/* Model row */}
      <div className="px-3 py-2 bg-teal-pale border-b border-teal-border flex items-center gap-2">
        {provider === 'ollama' ? (
          <>
            <input value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434"
              className="flex-1 text-[10px] px-2 py-1 bg-white border border-teal-border rounded-[6px] outline-none focus:border-primary text-text-sec" />
            <input value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} placeholder="llama3"
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
        {attachedDoc && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-[8px]"
            style={{ background: '#fff8ec', border: '1.5px solid #EF9F2760' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF9F27" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span className="text-[10px] font-bold text-amber-dark flex-1 truncate">{attachedDoc.name}</span>
            <span className="text-[9px] text-text-hint">in context</span>
            <button onClick={() => setAttachedDoc(null)} className="ml-1 text-text-hint hover:text-red-400 transition-colors" title="Remove">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={pickDocument} title="Attach a document"
            className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors hover:bg-teal-light"
            style={{ color: attachedDoc ? '#EF9F27' : '#9bbdaa', border: `1.5px solid ${attachedDoc ? '#EF9F2780' : '#d4f0e6'}` }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={`Ask ${activeProv?.label || 'AI'}… or "move X to daily checklist"`}
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
