import React, { useEffect, useState, useMemo } from 'react'
import { buildSystemPrompt, fetchMemories } from '../utils/systemPrompt'

// ── Mood system ────────────────────────────────────────────────────────────────

const MOOD = {
  1: { emoji: '😞', label: 'Rough', color: '#ef4444', soft: '#fdecec' },
  2: { emoji: '😔', label: 'Low',   color: '#f97316', soft: '#fdf0e6' },
  3: { emoji: '😐', label: 'Okay',  color: '#EF9F27', soft: '#fff7e8' },
  4: { emoji: '🙂', label: 'Good',  color: '#1D9E75', soft: '#eafaf2' },
  5: { emoji: '😄', label: 'Great', color: '#085041', soft: '#e3f4ec' },
}

// Stable daily writing prompt
const PROMPTS = [
  'What happened today, and how did it make you feel?',
  "What's been on your mind lately?",
  'What drained you today — and what filled you up?',
  'Describe a moment from today you want to remember.',
  'What are you avoiding, and why?',
  'What did you learn about yourself today?',
  'If today had a title, what would it be?',
  'What would make tomorrow feel like a win?',
  'Who or what are you grateful for right now?',
  'What thought keeps coming back to you?',
]

// ── Date helpers ────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10)

function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function fmtLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayOfYear(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, 0, 0)
  const now = new Date(y, m - 1, d)
  return Math.floor((now - start) / 86400000)
}

function journalStreak(dates) {
  const set = new Set(dates)
  let streak = 0
  let cursor = todayStr()
  // Allow the streak to "survive" if today isn't written yet but yesterday was
  if (!set.has(cursor)) cursor = addDaysStr(cursor, -1)
  while (set.has(cursor)) {
    streak++
    cursor = addDaysStr(cursor, -1)
  }
  return streak
}

const wordCount = (s) => (s || '').trim() ? (s || '').trim().split(/\s+/).length : 0

// ── AI reflection ───────────────────────────────────────────────────────────────

const REFLECTION_EXTRA_RULES = `TASK: You are reading the user's private journal entries to produce a warm, perceptive reflection — like a thoughtful friend who actually listened.
Respond with exactly four labeled sections using these EXACT markers on their own lines:

[NARRATIVE]
2-4 sentences capturing the main themes, events, and emotional throughline of this period. Write in second person ("you"). Be specific to what they actually wrote — reference real details, not generic observations.

[MOOD]
1-2 sentences on the emotional arc across the period — did it rise, dip, or swing? Tie it to the mood ratings and the tone of the writing.

[PATTERNS]
Exactly 3 recurring thoughts, behaviours, or themes you noticed. One per line, each starting with "- ". Be concrete.

[INSIGHT]
1-2 sentences of gentle, forward-looking insight, or one question worth sitting with. Grounded in their entries, never preachy or generic.

Write nothing outside these four sections.`

function parseReflection(text) {
  const section = (tag) => {
    const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z]+\\]|$)`, 'i')
    const m = (text || '').match(re)
    return m ? m[1].trim() : ''
  }
  const patterns = section('PATTERNS')
    .split('\n')
    .map(l => l.replace(/^[-•*\d.)]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
  return {
    narrative: section('NARRATIVE'),
    mood:      section('MOOD'),
    patterns,
    insight:   section('INSIGHT'),
  }
}

function buildReflectionData(entries, rangeDays) {
  const body = entries.map(e => {
    const m = MOOD[e.mood]
    let s = `── ${e.entry_date}  (mood: ${m ? m.label : 'unrated'})`
    if (e.content)   s += `\n${e.content.trim().slice(0, 1200)}`
    if (e.highlight) s += `\nHighlight: ${e.highlight.trim()}`
    if (e.gratitude) s += `\nGrateful for: ${e.gratitude.trim()}`
    if (e.challenge) s += `\nChallenge: ${e.challenge.trim()}`
    return s
  }).join('\n\n')

  const moods = entries.filter(e => e.mood).map(e => e.mood)
  const avg = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : 'n/a'

  return `These are my personal journal entries from the last ${rangeDays} days (${entries.length} entries, average mood ${avg}/5). Reflect on them:\n\n${body}`
}

// ── Main component ──────────────────────────────────────────────────────────────

const EMPTY_FORM = { content: '', mood: 0, highlight: '', gratitude: '', challenge: '' }

export default function Journal({ awardXp }) {
  const [tab, setTab]               = useState('write') // 'write' | 'reflect' | 'history'
  const [entries, setEntries]       = useState([])      // all entries (date desc)
  const [selectedDate, setSelected] = useState(todayStr())
  const [form, setForm]             = useState(EMPTY_FORM)
  const [hasEntry, setHasEntry]     = useState(false)
  const [showExtra, setShowExtra]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  // Reflection state
  const [range, setRange]           = useState(7)
  const [reflection, setReflection] = useState(null)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiError, setAiError]       = useState('')
  const [confirmRegen, setConfirm]  = useState(false)

  useEffect(() => { if (window.electronAPI) init() }, [])

  async function init() {
    await ensureTables()
    await loadAllEntries()
    await loadEntry(todayStr())
  }

  async function ensureTables() {
    await window.electronAPI.db.run(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_date  DATE NOT NULL UNIQUE,
        content     TEXT,
        mood        INTEGER,
        highlight   TEXT,
        gratitude   TEXT,
        challenge   TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {})
    await window.electronAPI.db.run(`
      CREATE TABLE IF NOT EXISTS journal_reflections (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        range_type  TEXT NOT NULL,
        end_date    DATE NOT NULL,
        narrative   TEXT,
        mood_arc    TEXT,
        patterns    TEXT,
        insight     TEXT,
        fingerprint TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(range_type, end_date)
      )
    `).catch(() => {})
  }

  async function loadAllEntries() {
    try {
      const rows = await window.electronAPI.db.query(
        'SELECT entry_date, mood, content FROM journal_entries ORDER BY entry_date DESC', []
      )
      setEntries(rows || [])
    } catch {}
  }

  async function loadEntry(date) {
    setSelected(date)
    try {
      const row = await window.electronAPI.db.get(
        'SELECT * FROM journal_entries WHERE entry_date = ?', [date]
      )
      if (row) {
        setHasEntry(true)
        setForm({
          content:   row.content   || '',
          mood:      row.mood      || 0,
          highlight: row.highlight || '',
          gratitude: row.gratitude || '',
          challenge: row.challenge || '',
        })
        setShowExtra(Boolean(row.highlight || row.gratitude || row.challenge))
      } else {
        setHasEntry(false)
        setForm(EMPTY_FORM)
        setShowExtra(false)
      }
    } catch {}
  }

  async function save() {
    if (!form.content.trim() && !form.mood) return
    setSaving(true)
    try {
      const isNew = !hasEntry
      await window.electronAPI.db.run(
        `INSERT INTO journal_entries (entry_date, content, mood, highlight, gratitude, challenge)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(entry_date) DO UPDATE SET
           content   = excluded.content,
           mood      = excluded.mood,
           highlight = excluded.highlight,
           gratitude = excluded.gratitude,
           challenge = excluded.challenge,
           updated_at = CURRENT_TIMESTAMP`,
        [selectedDate, form.content, form.mood || null, form.highlight, form.gratitude, form.challenge]
      )
      if (isNew) {
        setHasEntry(true)
        await awardXp?.(8)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
      await loadAllEntries()
    } catch {} finally { setSaving(false) }
  }

  // ── Reflection generation ─────────────────────────────────────────────────────

  async function generateReflection(force) {
    setAiLoading(true)
    setAiError('')
    setConfirm(false)
    try {
      const end   = todayStr()
      const start = addDaysStr(end, -(range - 1))
      const rows = await window.electronAPI.db.query(
        'SELECT entry_date, mood, content, highlight, gratitude, challenge FROM journal_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date ASC',
        [start, end]
      )

      if (!rows || rows.length < 2) {
        setReflection(null)
        setAiError(`Write at least 2 entries in the last ${range} days to unlock a reflection. You have ${rows?.length || 0}.`)
        return
      }

      const fp = JSON.stringify(rows.map(r => `${r.entry_date}:${r.mood}:${wordCount(r.content)}:${wordCount(r.highlight) + wordCount(r.gratitude) + wordCount(r.challenge)}`))

      if (!force) {
        const cached = await window.electronAPI.db.get(
          'SELECT * FROM journal_reflections WHERE range_type = ? AND end_date = ?',
          [String(range), end]
        ).catch(() => null)
        if (cached && cached.fingerprint === fp) {
          setReflection({
            narrative: cached.narrative || '',
            mood:      cached.mood_arc  || '',
            patterns:  JSON.parse(cached.patterns || '[]'),
            insight:   cached.insight   || '',
            entryCount: rows.length,
          })
          return
        }
      }

      const [provider, model, ollamaEndpoint, ollamaModel, memories] = await Promise.all([
        window.electronAPI.settings.get('ai_provider'),
        window.electronAPI.settings.get('ai_model'),
        window.electronAPI.settings.get('ollama_endpoint'),
        window.electronAPI.settings.get('ollama_model'),
        fetchMemories(),
      ])
      const effectiveModel = provider === 'ollama'
        ? (ollamaModel || 'llama3')
        : (model       || 'claude-sonnet-4-20250514')

      const raw = await window.electronAPI.ai.chat(
        [{ role: 'user', content: buildReflectionData(rows, range) }],
        provider,
        effectiveModel,
        ollamaEndpoint || null,
        buildSystemPrompt({ memories, extraRules: REFLECTION_EXTRA_RULES }),
      )

      const parsed = parseReflection(raw)
      if (!parsed.narrative && !parsed.insight) {
        throw new Error('The AI returned an unexpected format — check your provider settings.')
      }

      await window.electronAPI.db.run(
        `INSERT INTO journal_reflections (range_type, end_date, narrative, mood_arc, patterns, insight, fingerprint)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(range_type, end_date) DO UPDATE SET
           narrative = excluded.narrative,
           mood_arc  = excluded.mood_arc,
           patterns  = excluded.patterns,
           insight   = excluded.insight,
           fingerprint = excluded.fingerprint,
           created_at = CURRENT_TIMESTAMP`,
        [String(range), end, parsed.narrative, parsed.mood, JSON.stringify(parsed.patterns), parsed.insight, fp]
      ).catch(() => {})

      setReflection({ ...parsed, entryCount: rows.length })
    } catch (err) {
      setAiError(err.message || 'Failed to generate reflection.')
    } finally {
      setAiLoading(false)
    }
  }

  // Reset reflection when range changes; auto-load cached if present
  useEffect(() => {
    if (tab === 'reflect') {
      setReflection(null)
      setAiError('')
      generateReflection(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, tab])

  // ── Derived ───────────────────────────────────────────────────────────────────

  const entryDates = useMemo(() => entries.map(e => e.entry_date), [entries])
  const streak     = useMemo(() => journalStreak(entryDates), [entryDates])
  const prompt     = PROMPTS[dayOfYear(selectedDate) % PROMPTS.length]
  const isToday    = selectedDate === todayStr()
  const words      = wordCount(form.content)

  return (
    <div className="page-enter max-w-[720px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark flex items-center gap-2">
            <FeatherIcon /> Journal
          </h1>
          <p className="text-[12px] text-text-muted mt-0.5">Think out loud. Look back with clarity.</p>
        </div>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: '#fff7e8', border: '1.5px solid #f5d28a' }}>
              <span className="text-[13px]">🔥</span>
              <span className="text-[12px] font-extrabold" style={{ color: '#a65c00' }}>{streak}-day streak</span>
            </div>
          )}
          <div className="text-right">
            <p className="text-[10px] font-bold text-text-hint uppercase tracking-wide">Entries</p>
            <p className="text-[20px] font-extrabold text-primary leading-none">{entries.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 p-1 rounded-[12px]" style={{ background: '#e8f5ee', width: 'fit-content' }}>
        <TabBtn active={tab === 'write'}   onClick={() => setTab('write')}   icon="✍️" label="Write" />
        <TabBtn active={tab === 'reflect'} onClick={() => setTab('reflect')} icon="🔮" label="AI Reflections" />
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon="📅" label="History" />
      </div>

      {tab === 'write' && (
        <WriteTab
          form={form} setForm={setForm}
          selectedDate={selectedDate} isToday={isToday}
          prompt={prompt} words={words} hasEntry={hasEntry}
          showExtra={showExtra} setShowExtra={setShowExtra}
          saving={saving} saved={saved} onSave={save}
          onJumpToday={() => loadEntry(todayStr())}
        />
      )}

      {tab === 'reflect' && (
        <ReflectTab
          range={range} setRange={setRange}
          reflection={reflection} loading={aiLoading} error={aiError}
          confirmRegen={confirmRegen}
          onRequestRegen={() => reflection ? setConfirm(true) : generateReflection(true)}
          onConfirmRegen={() => generateReflection(true)}
          onCancelRegen={() => setConfirm(false)}
        />
      )}

      {tab === 'history' && (
        <HistoryTab
          entries={entries}
          selectedDate={selectedDate}
          onPickDate={(d) => { loadEntry(d); setTab('write') }}
        />
      )}
    </div>
  )
}

// ── Write tab ───────────────────────────────────────────────────────────────────

function WriteTab({ form, setForm, selectedDate, isToday, prompt, words, hasEntry, showExtra, setShowExtra, saving, saved, onSave }) {
  const canSave = form.content.trim() || form.mood

  return (
    <div className="flex flex-col gap-4">
      {/* Date banner */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-teal-dark">
          {isToday ? 'Today' : fmtLong(selectedDate)}
          {!isToday && <span className="text-[11px] font-semibold text-text-hint ml-2">· editing a past day</span>}
        </p>
        {hasEntry && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: '#eafaf2', color: '#1D9E75', border: '1px solid #b3e8d3' }}>
            saved entry
          </span>
        )}
      </div>

      {/* Mood selector */}
      <div className="bg-white border border-teal-border rounded-card p-5">
        <p className="text-[13px] font-bold text-teal-dark mb-3">How did the day feel?</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => {
            const m = MOOD[n]
            const active = form.mood === n
            return (
              <button
                key={n}
                onClick={() => setForm(f => ({ ...f, mood: active ? 0 : n }))}
                className="flex-1 flex flex-col items-center py-3 rounded-[12px] transition-all border-2"
                style={{
                  borderColor: active ? m.color : '#e1f0e9',
                  background:  active ? m.soft : '#f8fdfb',
                  transform:   active ? 'translateY(-2px)' : 'none',
                  boxShadow:   active ? `0 4px 0 ${m.color}33` : 'none',
                }}
              >
                <span className="text-[26px] leading-none mb-1.5" style={{ filter: active ? 'none' : 'grayscale(0.4)', opacity: active ? 1 : 0.7 }}>
                  {m.emoji}
                </span>
                <span className="text-[10px] font-bold" style={{ color: active ? m.color : '#9bbdaa' }}>
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Free write */}
      <div className="bg-white border border-teal-border rounded-card p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-semibold text-text-muted italic">"{prompt}"</p>
          <span className="text-[10px] font-bold text-text-hint tabular-nums">
            {words} {words === 1 ? 'word' : 'words'}
          </span>
        </div>
        <textarea
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          placeholder="Start writing… nobody's reading but you (and your AI, when you ask)."
          rows={10}
          className="w-full px-3.5 py-3 text-[13px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri placeholder:text-text-hint resize-none leading-relaxed"
          style={{ minHeight: 200 }}
        />
      </div>

      {/* Structured prompts (collapsible) */}
      {!showExtra ? (
        <button
          onClick={() => setShowExtra(true)}
          className="self-start flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-teal-med transition-colors"
        >
          <span className="text-[14px] leading-none">＋</span> Add highlight, gratitude & challenge
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <MiniField icon="⭐" label="Highlight of the day" tint="#fff7e8" border="#f5d28a"
            value={form.highlight} onChange={v => setForm(f => ({ ...f, highlight: v }))}
            placeholder="The one moment worth keeping…" />
          <MiniField icon="🙏" label="Grateful for" tint="#eafaf2" border="#b3e8d3"
            value={form.gratitude} onChange={v => setForm(f => ({ ...f, gratitude: v }))}
            placeholder="Big or small — what are you thankful for?" />
          <MiniField icon="🪨" label="What challenged you" tint="#f8f7ff" border="#cac8f5"
            value={form.challenge} onChange={v => setForm(f => ({ ...f, challenge: v }))}
            placeholder="What was hard, and how did you handle it?" />
        </div>
      )}

      {/* Save */}
      <button
        onClick={onSave}
        disabled={saving || !canSave}
        className="w-full py-3 bg-primary text-white text-[13px] font-bold rounded-[12px] hover:bg-teal-med disabled:opacity-40 transition-colors"
      >
        {saved ? (hasEntry ? '✓ Saved' : '✓ Entry saved! +8 XP') : saving ? 'Saving…' : hasEntry ? 'Update Entry' : 'Save Entry'}
      </button>
    </div>
  )
}

function MiniField({ icon, label, tint, border, value, onChange, placeholder }) {
  return (
    <div className="rounded-[10px] p-3.5" style={{ background: tint, border: `1.5px solid ${border}` }}>
      <p className="text-[11px] font-extrabold text-teal-dark mb-1.5">{icon} {label}</p>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-[12px] bg-white/70 border border-white rounded-sm outline-none focus:border-primary text-text-pri placeholder:text-text-hint"
      />
    </div>
  )
}

// ── Reflect tab ─────────────────────────────────────────────────────────────────

function ReflectTab({ range, setRange, reflection, loading, error, confirmRegen, onRequestRegen, onConfirmRegen, onCancelRegen }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Range toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 p-1 rounded-[10px]" style={{ background: '#e8f5ee' }}>
          {[7, 30].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-4 py-1.5 rounded-[8px] text-[11px] font-bold transition-all"
              style={range === r
                ? { background: '#1D9E75', color: 'white', boxShadow: '0 1px 3px rgba(8,80,65,0.25)' }
                : { background: 'transparent', color: '#4a7060' }}
            >
              Last {r} days
            </button>
          ))}
        </div>
        {reflection && !loading && (
          confirmRegen ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold" style={{ color: '#a65c00' }}>Regenerate?</span>
              <button onClick={onConfirmRegen}
                className="text-[10px] font-extrabold px-2 py-0.5 rounded"
                style={{ background: '#EF9F27', color: 'white', border: '1.5px solid #a65c00' }}>Yes</button>
              <button onClick={onCancelRegen}
                className="text-[10px] font-bold px-2 py-0.5 rounded"
                style={{ background: '#f4fdf8', color: '#4a7060', border: '1.5px solid #b3e8d3' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={onRequestRegen}
              className="flex items-center gap-1 text-[10px] font-bold text-text-hint hover:text-primary transition-colors">
              <RefreshSvg /> Regenerate
            </button>
          )
        )}
      </div>

      {loading && <ReflectionSkeleton range={range} />}

      {!loading && error && (
        <div className="bg-white border border-teal-border rounded-card p-6 text-center">
          <span className="text-[28px] block mb-2 opacity-40">🔮</span>
          <p className="text-[12px] font-semibold text-text-muted leading-relaxed max-w-[360px] mx-auto">{error}</p>
          <button onClick={onConfirmRegen} className="mt-3 text-[11px] font-bold text-primary hover:underline">
            Try again →
          </button>
        </div>
      )}

      {!loading && !error && reflection && (
        <div className="flex flex-col gap-3">
          {/* Narrative */}
          <div className="p-5 rounded-[14px]"
            style={{ background: 'linear-gradient(135deg, #ebfaf3 0%, #f2f6ff 100%)', border: '1.5px solid #b3e8d3' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[9px] font-extrabold">AI</span>
              </div>
              <div>
                <p className="text-[12px] font-extrabold text-teal-dark leading-tight">Your last {range} days</p>
                <p className="text-[10px] text-text-hint">reflected from {reflection.entryCount} entries</p>
              </div>
            </div>
            <p className="text-[13px] text-text-pri leading-relaxed">{reflection.narrative}</p>
          </div>

          {/* Mood arc */}
          {reflection.mood && (
            <div className="p-4 rounded-[10px]" style={{ background: '#fff8ed', border: '1.5px solid #f5d28a' }}>
              <p className="text-[9px] font-extrabold uppercase tracking-widest mb-2" style={{ color: '#a65c00' }}>Emotional arc</p>
              <p className="text-[12px] font-semibold leading-snug" style={{ color: '#7a3f00' }}>{reflection.mood}</p>
            </div>
          )}

          {/* Patterns */}
          {reflection.patterns?.length > 0 && (
            <div className="p-4 rounded-[10px]" style={{ background: '#f8f7ff', border: '1.5px solid #cac8f5' }}>
              <p className="text-[9px] font-extrabold uppercase tracking-widest mb-3" style={{ color: '#7F77DD' }}>Patterns noticed</p>
              <div className="flex flex-col gap-2.5">
                {reflection.patterns.map((p, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-extrabold mt-0.5"
                      style={{ background: '#7F77DD20', color: '#7F77DD' }}>{i + 1}</span>
                    <p className="text-[12px] leading-snug" style={{ color: '#3d3a9e' }}>{p}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insight */}
          {reflection.insight && (
            <div className="p-4 rounded-[10px]" style={{ background: '#f0faf4', border: '1.5px solid #a8ddc4' }}>
              <p className="text-[9px] font-extrabold uppercase tracking-widest mb-2" style={{ color: '#2a8a67' }}>Something to sit with</p>
              <p className="text-[13px] font-semibold leading-snug" style={{ color: '#085041' }}>{reflection.insight}</p>
            </div>
          )}
        </div>
      )}

      {!loading && !error && !reflection && (
        <div className="bg-white border border-teal-border rounded-card p-6 text-center">
          <span className="text-[28px] block mb-2">🔮</span>
          <p className="text-[12px] text-text-muted">Generating your reflection…</p>
        </div>
      )}
    </div>
  )
}

function ReflectionSkeleton({ range }) {
  return (
    <div className="bg-white border border-teal-border rounded-card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
            strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <p className="text-[13px] font-bold text-teal-dark">Reading your last {range} days…</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {[70, 90, 55, 80].map((pct, i) => (
          <div key={i} className="h-3 rounded-full"
            style={{ width: `${pct}%`, background: '#e8f5ee', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}

// ── History tab (calendar heatmap) ──────────────────────────────────────────────

function HistoryTab({ entries, selectedDate, onPickDate }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = todayStr().split('-').map(Number)
    return { y, m } // m is 1-12
  })

  const entryMap = useMemo(() => {
    const map = {}
    for (const e of entries) map[e.entry_date] = e
    return map
  }, [entries])

  const { y, m } = viewMonth
  const firstDay = new Date(y, m - 1, 1).getDay() // 0 Sun
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = todayStr()
  const isCurrentMonth = (() => { const [ty, tm] = today.split('-').map(Number); return ty === y && tm === m })()

  function shift(delta) {
    let nm = m + delta, ny = y
    if (nm < 1) { nm = 12; ny-- }
    if (nm > 12) { nm = 1; ny++ }
    setViewMonth({ y: ny, m: nm })
  }

  const recent = entries.slice(0, 8)

  return (
    <div className="flex flex-col gap-5">
      {/* Calendar */}
      <div className="bg-white border border-teal-border rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shift(-1)}
            className="w-8 h-8 rounded-[10px] bg-teal-light text-teal-med flex items-center justify-center hover:bg-teal-border transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <p className="text-[13px] font-extrabold text-teal-dark">{monthLabel}</p>
          <button onClick={() => shift(1)} disabled={isCurrentMonth}
            className="w-8 h-8 rounded-[10px] bg-teal-light text-teal-med flex items-center justify-center hover:bg-teal-border disabled:opacity-30 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[9px] font-extrabold text-text-hint uppercase">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />
            const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const entry = entryMap[dateStr]
            const mood = entry?.mood ? MOOD[entry.mood] : null
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const isFuture = dateStr > today

            return (
              <button
                key={dateStr}
                onClick={() => !isFuture && onPickDate(dateStr)}
                disabled={isFuture}
                title={entry ? `${fmtShort(dateStr)} · ${mood ? mood.label : 'written'}` : fmtShort(dateStr)}
                className="aspect-square rounded-[8px] flex items-center justify-center text-[11px] font-bold transition-all relative"
                style={{
                  background: mood ? mood.soft : entry ? '#eafaf2' : isFuture ? '#fafdfb' : '#f4fbf8',
                  border: isSelected ? '2px solid #1D9E75'
                        : mood ? `1.5px solid ${mood.color}55`
                        : entry ? '1.5px solid #b3e8d3'
                        : '1.5px solid #eef6f2',
                  color: mood ? mood.color : entry ? '#1D9E75' : isFuture ? '#cfe3da' : '#7da894',
                  cursor: isFuture ? 'default' : 'pointer',
                  opacity: isFuture ? 0.5 : 1,
                }}
              >
                {entry ? <span className="text-[14px] leading-none">{mood ? mood.emoji : '·'}</span> : d}
                {isToday && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: '#1D9E75' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid #eef6f2' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="flex items-center gap-1">
              <span className="text-[13px]">{MOOD[n].emoji}</span>
              <span className="text-[9px] font-bold text-text-hint">{MOOD[n].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent entries list */}
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-text-hint mb-2">Recent entries</p>
        {recent.length === 0 ? (
          <div className="bg-white border border-teal-border rounded-card p-6 text-center">
            <span className="text-[28px] block mb-2 opacity-40">📖</span>
            <p className="text-[12px] text-text-muted">No entries yet — your story starts today.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map(e => {
              const mood = e.mood ? MOOD[e.mood] : null
              const preview = (e.content || '').trim().replace(/\s+/g, ' ').slice(0, 90)
              return (
                <button
                  key={e.entry_date}
                  onClick={() => onPickDate(e.entry_date)}
                  className="flex items-center gap-3 px-4 py-3 bg-white text-left hover-lift"
                  style={{
                    border: '1.5px solid #e1f0e9',
                    borderLeft: `3px solid ${mood ? mood.color : '#b3e8d3'}`,
                    borderRadius: 8,
                  }}
                >
                  <span className="text-[20px] flex-shrink-0">{mood ? mood.emoji : '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-extrabold text-teal-dark">{fmtShort(e.entry_date)}</p>
                    <p className="text-[11px] text-text-muted truncate">{preview || 'No text — mood only'}{preview.length === 90 ? '…' : ''}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9bbdaa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bits ────────────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-2 rounded-[9px] text-[11px] font-bold transition-all flex items-center gap-1.5 whitespace-nowrap"
      style={active
        ? { background: 'white', color: '#085041', boxShadow: '0 1px 4px rgba(8,80,65,0.12)' }
        : { background: 'transparent', color: '#4a7060' }}
    >
      <span className="text-[13px] leading-none">{icon}</span> {label}
    </button>
  )
}

function FeatherIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  )
}

function RefreshSvg() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
