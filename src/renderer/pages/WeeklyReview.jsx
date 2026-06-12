import React, { useEffect, useState } from 'react'

const ENERGY_LABELS = { 1: '😩 Drained', 2: '😕 Low', 3: '😐 Neutral', 4: '😊 Good', 5: '🔥 Peak' }

// ── Date helpers ─────────────────────────────────────────────────────────────

function getWeekStart(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr, n) {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── AI helpers ───────────────────────────────────────────────────────────────

function parseAIReview(text) {
  const section = (tag) => {
    const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\[[A-Z]+\\]|$)`, 'i')
    const m  = (text || '').match(re)
    return m ? m[1].trim() : ''
  }
  const summary   = section('SUMMARY')
  const win       = section('WIN')
  const gap       = section('GAP')
  const qBlock    = section('QUESTIONS')
  const questions = qBlock
    .split('\n')
    .map(l => l.replace(/^[-•*\d.)]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
  return { summary, win, gap, questions }
}

function buildDataText({ completedTasks, habitStats, epicSummary, nudgeCount, energyLogs, weekStart, weekEnd }) {
  const taskLines = completedTasks.length
    ? completedTasks.slice(0, 20).map(t => `  - "${t.title}" (${t.epic_name})`).join('\n')
    : '  (none this week)'

  const habitLines = habitStats.length
    ? habitStats.map(h =>
        `  - ${h.name}: ${h.days_this_week}/7 days (current streak: ${h.current_streak}d)`
      ).join('\n')
    : '  (no habits set up)'

  const epicLines = epicSummary.length
    ? epicSummary.map(e =>
        `  - ${e.name}: ${e.completed_this_week} task(s) completed → ${e.progress}% overall progress`
      ).join('\n')
    : '  (no epic activity this week)'

  const avgEnergy = energyLogs.length
    ? (energyLogs.reduce((s, e) => s + e.energy_rating, 0) / energyLogs.length).toFixed(1)
    : 'not logged'

  return [
    `Week: ${weekStart} to ${weekEnd}`,
    `\nTasks completed (${completedTasks.length} total):`,
    taskLines,
    `\nHabit consistency:`,
    habitLines,
    `\nEpic progress:`,
    epicLines,
    `\nAverage daily energy: ${avgEnergy}/5 (logged ${energyLogs.length}/7 days)`,
    `Nudges sent this week: ${nudgeCount}`,
  ].join('\n')
}

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM = { what_worked: '', what_didnt: '', dropping_this_week: '', focus_next_week: '', energy_rating: 3 }

const SYSTEM_PROMPT = `You are a personal performance coach reviewing one week of productivity data.
Respond with exactly four labeled sections using these exact markers on their own lines:

[SUMMARY]
Write 2-3 sentences summarising overall performance this week. Be specific — mention actual numbers and patterns.

[WIN]
State the single biggest win of the week in exactly 1 concise sentence.

[GAP]
State the single biggest gap or missed opportunity in exactly 1 concise sentence.

[QUESTIONS]
Write exactly 3 reflective questions, one per line, each starting with "- ".
Tailor every question to what specifically slipped or stood out in the data.
Do not write anything outside these four sections. Do not add commentary or sign-offs.`

// ── Main component ───────────────────────────────────────────────────────────

export default function WeeklyReview({ awardXp }) {
  const [weekOffset,   setWeekOffset]   = useState(0)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [hasEntry,     setHasEntry]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)

  // AI review
  const [aiReview,     setAiReview]     = useState(null)
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiError,      setAiError]      = useState('')
  const [confirmRegen, setConfirmRegen] = useState(false)

  const weekStart = getWeekStart(weekOffset)
  const weekEnd   = addDays(weekStart, 7)

  useEffect(() => {
    if (!window.electronAPI) return
    setAiReview(null)
    setAiError('')
    setAiLoading(false)
    setConfirmRegen(false)
    initPage()
  }, [weekStart])

  async function initPage() {
    await ensureTable()
    await Promise.all([loadNotes(), checkAndGenerateReview(false)])
  }

  async function ensureTable() {
    await window.electronAPI.db.run(`
      CREATE TABLE IF NOT EXISTS weekly_ai_reviews (
        week_start          DATE PRIMARY KEY,
        summary             TEXT,
        biggest_win         TEXT,
        biggest_gap         TEXT,
        reflective_questions TEXT,
        data_fingerprint    TEXT,
        generated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {})
  }

  async function loadNotes() {
    try {
      const row = await window.electronAPI.db.get(
        'SELECT * FROM weekly_reviews WHERE week_start = ?', [weekStart]
      )
      if (row) {
        setHasEntry(true)
        setForm({
          what_worked:        row.what_worked        || '',
          what_didnt:         row.what_didnt         || '',
          dropping_this_week: row.dropping_this_week || '',
          focus_next_week:    row.focus_next_week    || '',
          energy_rating:      row.energy_rating      || 3,
        })
      } else {
        setHasEntry(false)
        setForm(EMPTY_FORM)
      }
    } catch {}
  }

  async function collectWeekData() {
    const [completedTasks, habitStats, epicSummary, nudgeRow, energyLogs] = await Promise.all([
      window.electronAPI.db.query(
        `SELECT s.title, e.name as epic_name
         FROM subtasks s
         JOIN epics e ON e.id = s.epic_id
         WHERE date(s.completed_at) >= ? AND date(s.completed_at) < ?
         ORDER BY s.completed_at DESC`,
        [weekStart, weekEnd]
      ),
      window.electronAPI.db.query(
        `SELECT sh.id, sh.name, sh.current_streak,
                COALESCE(SUM(CASE WHEN sl.logged_date >= ? AND sl.logged_date < ? THEN 1 ELSE 0 END), 0) AS days_this_week
         FROM streak_habits sh
         LEFT JOIN streak_logs sl ON sl.habit_id = sh.id
         GROUP BY sh.id
         ORDER BY sh.name`,
        [weekStart, weekEnd]
      ),
      window.electronAPI.db.query(
        `SELECT e.name, e.progress,
                COUNT(s.id) as completed_this_week
         FROM epics e
         LEFT JOIN subtasks s ON s.epic_id = e.id
           AND date(s.completed_at) >= ? AND date(s.completed_at) < ?
         WHERE e.status != 'done'
         GROUP BY e.id
         HAVING completed_this_week > 0
         ORDER BY completed_this_week DESC`,
        [weekStart, weekEnd]
      ),
      window.electronAPI.db.get(
        `SELECT COUNT(*) as count FROM nudge_log
         WHERE sent_at >= ? AND sent_at < ?`,
        [weekStart, weekEnd]
      ).catch(() => ({ count: 0 })),
      window.electronAPI.db.query(
        `SELECT log_date, energy_rating FROM energy_logs
         WHERE log_date >= ? AND log_date < ?
         ORDER BY log_date`,
        [weekStart, weekEnd]
      ),
    ])

    return {
      completedTasks: completedTasks || [],
      habitStats:     habitStats     || [],
      epicSummary:    epicSummary    || [],
      nudgeCount:     nudgeRow?.count ?? 0,
      energyLogs:     energyLogs     || [],
      weekStart,
      weekEnd,
    }
  }

  function computeFingerprint(data) {
    return JSON.stringify({
      tasks:   data.completedTasks.length,
      habits:  data.habitStats.map(h => `${h.id}:${h.days_this_week}`).join(','),
      energy:  data.energyLogs.map(e => e.energy_rating).join(','),
      nudges:  data.nudgeCount,
    })
  }

  async function checkAndGenerateReview(force) {
    setAiLoading(true)
    setAiError('')
    try {
      const data = await collectWeekData()
      const fp   = computeFingerprint(data)

      if (!force) {
        const cached = await window.electronAPI.db.get(
          'SELECT * FROM weekly_ai_reviews WHERE week_start = ?', [weekStart]
        ).catch(() => null)

        if (cached && cached.data_fingerprint === fp) {
          try {
            setAiReview({
              summary:   cached.summary           || '',
              win:       cached.biggest_win       || '',
              gap:       cached.biggest_gap       || '',
              questions: JSON.parse(cached.reflective_questions || '[]'),
            })
            return
          } catch {}
        }
      }

      // Need to (re)generate
      const [provider, model, ollamaEndpoint, ollamaModel] = await Promise.all([
        window.electronAPI.settings.get('ai_provider'),
        window.electronAPI.settings.get('ai_model'),
        window.electronAPI.settings.get('ollama_endpoint'),
        window.electronAPI.settings.get('ollama_model'),
      ])

      const effectiveModel = provider === 'ollama'
        ? (ollamaModel || 'llama3')
        : (model       || 'claude-sonnet-4-20250514')

      const rawText = await window.electronAPI.ai.chat(
        [{ role: 'user', content: buildDataText(data) }],
        provider,
        effectiveModel,
        ollamaEndpoint || null,
        SYSTEM_PROMPT,
      )

      const parsed = parseAIReview(rawText)
      if (!parsed.summary && !parsed.win && !parsed.gap) {
        throw new Error('AI returned an unrecognisable format — check your provider settings')
      }

      await window.electronAPI.db.run(
        `INSERT INTO weekly_ai_reviews
           (week_start, summary, biggest_win, biggest_gap, reflective_questions, data_fingerprint)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(week_start) DO UPDATE SET
           summary              = excluded.summary,
           biggest_win          = excluded.biggest_win,
           biggest_gap          = excluded.biggest_gap,
           reflective_questions = excluded.reflective_questions,
           data_fingerprint     = excluded.data_fingerprint,
           generated_at         = CURRENT_TIMESTAMP`,
        [weekStart, parsed.summary, parsed.win, parsed.gap, JSON.stringify(parsed.questions), fp]
      ).catch(() => {})

      setAiReview(parsed)
    } catch (err) {
      setAiError(err.message || 'Failed to generate review')
    } finally {
      setAiLoading(false)
      setConfirmRegen(false)
    }
  }

  async function saveNotes() {
    setSaving(true)
    try {
      const isNew = !hasEntry
      await window.electronAPI.db.run(
        `INSERT INTO weekly_reviews
           (week_start, what_worked, what_didnt, dropping_this_week, focus_next_week, energy_rating)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(week_start) DO UPDATE SET
           what_worked        = excluded.what_worked,
           what_didnt         = excluded.what_didnt,
           dropping_this_week = excluded.dropping_this_week,
           focus_next_week    = excluded.focus_next_week,
           energy_rating      = excluded.energy_rating`,
        [weekStart, form.what_worked, form.what_didnt, form.dropping_this_week, form.focus_next_week, form.energy_rating]
      )
      if (isNew) {
        setHasEntry(true)
        await awardXp?.(25)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  const tf = (key, placeholder, rows = 3) => (
    <textarea
      value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri placeholder:text-text-hint resize-none leading-relaxed"
    />
  )

  return (
    <div className="page-enter max-w-[680px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark">Weekly Review</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Reflect, reset, refocus</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="w-8 h-8 rounded-[10px] bg-teal-light text-teal-med flex items-center justify-center hover:bg-teal-border transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-[12px] font-bold text-teal-dark w-[120px] text-center">
            {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `Week of ${weekStart}`}
          </span>
          <button
            onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
            disabled={weekOffset >= 0}
            className="w-8 h-8 rounded-[10px] bg-teal-light text-teal-med flex items-center justify-center hover:bg-teal-border disabled:opacity-30 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* AI review section */}
        <AIReviewPanel
          review={aiReview}
          loading={aiLoading}
          error={aiError}
          confirmRegen={confirmRegen}
          onRequestRegen={() => aiReview ? setConfirmRegen(true) : checkAndGenerateReview(true)}
          onConfirmRegen={() => checkAndGenerateReview(true)}
          onCancelRegen={() => setConfirmRegen(false)}
        />

        {/* Divider */}
        <div className="flex items-center gap-3 mt-1">
          <div className="flex-1 h-px bg-teal-border" />
          <span className="text-[10px] font-extrabold text-text-hint uppercase tracking-wider">Your notes</span>
          <div className="flex-1 h-px bg-teal-border" />
        </div>

        {/* Energy rating */}
        <div className="bg-white border border-teal-border rounded-card p-5">
          <p className="text-[13px] font-bold text-teal-dark mb-3">Overall energy this week</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setForm(f => ({ ...f, energy_rating: n }))}
                className={`flex-1 py-2 rounded-[10px] text-[11px] font-bold transition-all ${
                  form.energy_rating === n
                    ? 'bg-primary text-white shadow-sm scale-105'
                    : 'bg-teal-pale text-text-muted hover:bg-teal-light'
                }`}
              >
                {ENERGY_LABELS[n]}
              </button>
            ))}
          </div>
        </div>

        <ReviewSection label="✅ What worked well?" hint="Wins, breakthroughs, things to repeat">
          {tf('what_worked', 'e.g. Deep work blocks in the morning, consistent gym sessions…')}
        </ReviewSection>

        <ReviewSection label="⚡ What didn't work?" hint="Obstacles, time sinks, patterns to break">
          {tf('what_didnt', 'e.g. Too much time on social media, missed 2 study sessions…')}
        </ReviewSection>

        <ReviewSection label="🗑 Dropping this week" hint="One habit, obligation, or distraction to cut">
          {tf('dropping_this_week', 'e.g. Late-night scrolling before bed…', 2)}
        </ReviewSection>

        <ReviewSection label="🎯 Focus for next week" hint="The one thing that moves the needle most">
          {tf('focus_next_week', 'e.g. Submit 5 internship applications, finish HSK chapter 7…', 2)}
        </ReviewSection>

        <button
          onClick={saveNotes}
          disabled={saving}
          className="w-full py-2.5 bg-primary text-white text-[13px] font-bold rounded-[10px] hover:bg-teal-med disabled:opacity-40 transition-colors"
        >
          {saved ? '✓ Notes Saved! +25 XP' : saving ? 'Saving…' : 'Save My Notes'}
        </button>
      </div>
    </div>
  )
}

// ── AI review panel ───────────────────────────────────────────────────────────

function AIReviewPanel({ review, loading, error, confirmRegen, onRequestRegen, onConfirmRegen, onCancelRegen }) {
  if (loading) {
    return (
      <div className="bg-white border border-teal-border rounded-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <SpinBadge />
          <p className="text-[13px] font-bold text-teal-dark">Analysing your week…</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {[55, 40, 70].map((pct, i) => (
            <div key={i} className="h-3 rounded-full"
              style={{ width: `${pct}%`, background: '#e8f5ee', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (error && !review) {
    return (
      <div className="bg-white border border-teal-border rounded-card p-5">
        <div className="flex items-start gap-2">
          <span className="text-[16px] mt-0.5">⚠️</span>
          <div>
            <p className="text-[12px] font-bold mb-1" style={{ color: '#c0392b' }}>{error}</p>
            <button onClick={onRequestRegen} className="text-[11px] font-bold text-primary hover:underline">
              Try again →
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!review) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Summary card */}
      <div className="p-4 rounded-[12px]"
        style={{ background: 'linear-gradient(135deg, #ebfaf3 0%, #f2f6ff 100%)', border: '1.5px solid #b3e8d3' }}>
        {/* Card header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[9px] font-extrabold">AI</span>
            </div>
            <p className="text-[12px] font-extrabold text-teal-dark">Performance summary</p>
          </div>
          <div className="flex items-center gap-1.5">
            {error && (
              <span className="text-[10px] font-bold" style={{ color: '#EF9F27' }}>using cached</span>
            )}
            {confirmRegen ? (
              <>
                <span className="text-[10px] font-bold" style={{ color: '#a65c00' }}>Regenerate?</span>
                <button onClick={onConfirmRegen}
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded transition-all hover:opacity-80"
                  style={{ background: '#EF9F27', color: 'white', border: '1.5px solid #a65c00' }}>
                  Yes
                </button>
                <button onClick={onCancelRegen}
                  className="text-[10px] font-bold px-2 py-0.5 rounded transition-all"
                  style={{ background: '#f4fdf8', color: '#4a7060', border: '1.5px solid #b3e8d3' }}>
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={onRequestRegen}
                className="flex items-center gap-1 text-[10px] font-bold text-text-hint hover:text-primary transition-colors">
                <RefreshSvg />
                Regenerate
              </button>
            )}
          </div>
        </div>
        <p className="text-[13px] text-text-pri leading-relaxed">{review.summary}</p>
      </div>

      {/* Win & Gap */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-[10px]"
          style={{ background: '#f0faf4', border: '1.5px solid #a8ddc4' }}>
          <p className="text-[9px] font-extrabold uppercase tracking-widest mb-2"
            style={{ color: '#2a8a67' }}>Biggest Win</p>
          <p className="text-[12px] font-semibold leading-snug" style={{ color: '#085041' }}>
            {review.win || '—'}
          </p>
        </div>
        <div className="p-4 rounded-[10px]"
          style={{ background: '#fff8ed', border: '1.5px solid #f5d28a' }}>
          <p className="text-[9px] font-extrabold uppercase tracking-widest mb-2"
            style={{ color: '#a65c00' }}>Biggest Gap</p>
          <p className="text-[12px] font-semibold leading-snug" style={{ color: '#7a3f00' }}>
            {review.gap || '—'}
          </p>
        </div>
      </div>

      {/* Reflective questions */}
      {review.questions?.length > 0 && (
        <div className="p-4 rounded-[10px]"
          style={{ background: '#f8f7ff', border: '1.5px solid #cac8f5' }}>
          <p className="text-[9px] font-extrabold uppercase tracking-widest mb-3"
            style={{ color: '#7F77DD' }}>Reflect on this</p>
          <div className="flex flex-col gap-2.5">
            {review.questions.map((q, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-extrabold mt-0.5"
                  style={{ background: '#7F77DD20', color: '#7F77DD' }}>
                  {i + 1}
                </span>
                <p className="text-[12px] leading-snug" style={{ color: '#3d3a9e' }}>{q}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SpinBadge() {
  return (
    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
        strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  )
}

function RefreshSvg() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function ReviewSection({ label, hint, children }) {
  return (
    <div className="bg-white border border-teal-border rounded-card p-5">
      <p className="text-[13px] font-bold text-teal-dark mb-0.5">{label}</p>
      {hint && <p className="text-[11px] text-text-hint mb-3">{hint}</p>}
      {children}
    </div>
  )
}
