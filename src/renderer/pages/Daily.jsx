import React, { useEffect, useState } from 'react'
import { buildSystemPrompt, fetchMemories } from '../utils/systemPrompt'

const SCHEDULE_EXTRA_RULES = `TASK: Generate a daily schedule.
Return ONLY a valid JSON array — no markdown, no code fences, no explanation before or after it.
Each element must have exactly these fields:
  "start_time": string in "HH:MM" 24-hour format
  "end_time": string in "HH:MM" 24-hour format
  "task_id": number (the [id:N] from the task list) or null for non-task blocks
  "label": string (concise display name, ≤60 chars)
  "reason": string (one sentence, ≤80 chars)

Rules:
- Schedule within 08:00–21:00
- Place highest-priority tasks during the user's peak productive window
- Include 15–20 min breaks between deep work sessions
- Honour fixed commitments at their listed times
- 6–10 blocks total, each 30–120 minutes, chronological, no overlaps`

const DAY_ABBR  = ['S','M','T','W','T','F','S']
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December']
const COLOR_HEX = { teal: '#1D9E75', amber: '#EF9F27', purple: '#7F77DD' }

function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getWeekDays(anchor) {
  const d   = new Date(anchor)
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(mon)
    day.setDate(mon.getDate() + i)
    return day
  })
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`
}

// ── Schedule helpers (outside component — no stale closures) ─────────────────

function parseScheduleBlocks(rawText) {
  const cleaned = (rawText || '')
    .replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('[')
  const end   = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(arr)
      ? arr.filter(b => typeof b.start_time === 'string' && typeof b.label === 'string')
      : []
  } catch { return [] }
}

export default function Daily({ awardXp }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [selDate,    setSelDate]    = useState(new Date(today))
  const [weekAnchor, setWeekAnchor] = useState(new Date(today))
  const [tasks,      setTasks]      = useState([])
  const [reminders,  setReminders]  = useState([])
  const [habits,     setHabits]     = useState([])
  const [loggedIds,  setLoggedIds]  = useState(new Set())
  const [dotMap,     setDotMap]     = useState({})
  const [addingRem,  setAddingRem]  = useState(false)
  const [remTitle,   setRemTitle]   = useState('')
  const [remTime,    setRemTime]    = useState('09:00')
  // Schedule state
  const [schedule,          setSchedule]          = useState([])
  const [scheduleLoading,   setScheduleLoading]   = useState(false)
  const [scheduleError,     setScheduleError]     = useState('')
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [dragIdx,           setDragIdx]           = useState(null)
  const [dragOverIdx,       setDragOverIdx]       = useState(null)

  const todayStr = toDateStr(today)
  const selStr   = toDateStr(selDate)
  const isToday  = selStr === todayStr
  const weekDays = getWeekDays(weekAnchor)

  useEffect(() => {
    if (window.electronAPI) ensureTable().then(loadAll)
  }, [selStr])

  useEffect(() => {
    if (window.electronAPI) loadDots()
  }, [weekAnchor.toISOString()])

  async function ensureTable() {
    await window.electronAPI.db.run(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        remind_date DATE NOT NULL,
        remind_time TEXT DEFAULT '09:00',
        is_done INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {})
    await window.electronAPI.db.run(`
      CREATE TABLE IF NOT EXISTS daily_schedules (
        schedule_date DATE PRIMARY KEY,
        blocks TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {})
  }

  async function loadAll() {
    try {
      const [taskRows, remRows, habitRows, logRows, schedRow] = await Promise.all([
        window.electronAPI.db.query(
          `SELECT s.id, s.title, s.status, e.name as epic_name, e.color as epic_color
           FROM subtasks s JOIN epics e ON e.id = s.epic_id
           WHERE s.due_date = ? AND s.status != 'done' AND s.parent_id IS NULL
           ORDER BY e.name, s.id`,
          [selStr]
        ),
        window.electronAPI.db.query(
          'SELECT * FROM reminders WHERE remind_date = ? ORDER BY remind_time, id',
          [selStr]
        ),
        window.electronAPI.db.query(
          'SELECT * FROM streak_habits ORDER BY current_streak DESC',
          []
        ),
        window.electronAPI.db.query(
          "SELECT habit_id FROM streak_logs WHERE logged_date = date('now')",
          []
        ),
        window.electronAPI.db.get(
          'SELECT blocks FROM daily_schedules WHERE schedule_date = ?',
          [selStr]
        ).catch(() => null),
      ])
      setTasks(taskRows)
      setReminders(remRows)
      setHabits(habitRows)
      setLoggedIds(new Set(logRows.map(r => r.habit_id)))
      if (schedRow?.blocks) {
        try { setSchedule(JSON.parse(schedRow.blocks)) } catch { setSchedule([]) }
      } else {
        setSchedule([])
      }
    } catch {}
  }

  async function loadDots() {
    try {
      const days = getWeekDays(weekAnchor)
      const s = toDateStr(days[0])
      const e = toDateStr(days[6])
      const rows = await window.electronAPI.db.query(
        `SELECT due_date, COUNT(*) as cnt FROM subtasks
         WHERE due_date >= ? AND due_date <= ? AND status != 'done' AND parent_id IS NULL
         GROUP BY due_date`,
        [s, e]
      )
      const remRows = await window.electronAPI.db.query(
        `SELECT remind_date, COUNT(*) as cnt FROM reminders
         WHERE remind_date >= ? AND remind_date <= ? AND is_done = 0
         GROUP BY remind_date`,
        [s, e]
      ).catch(() => [])
      const map = {}
      rows.forEach(r => { map[r.due_date] = (map[r.due_date] || 0) + r.cnt })
      remRows.forEach(r => { map[r.remind_date] = (map[r.remind_date] || 0) + r.cnt })
      setDotMap(map)
    } catch {}
  }

  async function addReminder() {
    if (!remTitle.trim()) return
    await window.electronAPI.db.run(
      'INSERT INTO reminders (title, remind_date, remind_time) VALUES (?,?,?)',
      [remTitle.trim(), selStr, remTime]
    )
    setRemTitle('')
    setAddingRem(false)
    await loadAll()
    await loadDots()
  }

  async function toggleReminder(id, isDone) {
    await window.electronAPI.db.run('UPDATE reminders SET is_done=? WHERE id=?', [isDone ? 0 : 1, id])
    setReminders(prev => prev.map(r => r.id === id ? { ...r, is_done: isDone ? 0 : 1 } : r))
    await loadDots()
  }

  async function deleteReminder(id) {
    await window.electronAPI.db.run('DELETE FROM reminders WHERE id=?', [id])
    setReminders(prev => prev.filter(r => r.id !== id))
    await loadDots()
  }

  async function logHabit(habitId) {
    if (loggedIds.has(habitId)) return
    await window.electronAPI.db.run(
      "INSERT OR IGNORE INTO streak_logs (habit_id, logged_date, completed) VALUES (?, date('now'), 1)",
      [habitId]
    )
    const h = habits.find(x => x.id === habitId)
    if (h) {
      const ns = (h.current_streak || 0) + 1
      await window.electronAPI.db.run(
        'UPDATE streak_habits SET current_streak=?, longest_streak=? WHERE id=?',
        [ns, Math.max(h.longest_streak || 0, ns), habitId]
      )
      setHabits(prev => prev.map(x => x.id === habitId ? { ...x, current_streak: ns } : x))
    }
    setLoggedIds(prev => new Set([...prev, habitId]))
    await awardXp?.(10)
  }

  function shiftWeek(delta) {
    const d = new Date(weekAnchor)
    d.setDate(d.getDate() + delta * 7)
    setWeekAnchor(d)
  }

  // ── Schedule helpers ─────────────────────────────────────────────────────────

  async function saveSchedule(blocks) {
    await window.electronAPI.db.run(
      `INSERT INTO daily_schedules (schedule_date, blocks, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(schedule_date) DO UPDATE SET
         blocks     = excluded.blocks,
         updated_at = excluded.updated_at`,
      [selStr, JSON.stringify(blocks)]
    ).catch(() => {})
  }

  async function generateSchedule() {
    setConfirmRegenerate(false)
    setScheduleError('')
    setScheduleLoading(true)
    try {
      const [topTasks, memRow, todayRems, provider, model, ollamaEndpoint, ollamaModel, memories] = await Promise.all([
        window.electronAPI.tasks.getTopTasks(10),
        window.electronAPI.db.get(
          "SELECT description FROM assistant_memory WHERE pattern_type = 'productive_hour'"
        ).catch(() => null),
        window.electronAPI.db.query(
          'SELECT title, remind_time FROM reminders WHERE remind_date = ? AND is_done = 0 ORDER BY remind_time',
          [selStr]
        ).catch(() => []),
        window.electronAPI.settings.get('ai_provider'),
        window.electronAPI.settings.get('ai_model'),
        window.electronAPI.settings.get('ollama_endpoint'),
        window.electronAPI.settings.get('ollama_model'),
        fetchMemories(),
      ])

      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

      const taskLines = topTasks.length
        ? topTasks.map((t, i) =>
            `  ${i + 1}. [id:${t.id}] "${t.title}" (epic: ${t.epic_name || 'none'}, score: ${t.priority_score || 0}, xp: ${t.xp_value || 15})`
          ).join('\n')
        : '  (no open tasks)'

      const remLines = todayRems.length
        ? todayRems.map(r => `  - ${r.remind_time || '?'} ${r.title}`).join('\n')
        : '  (none)'

      const peakInfo = memRow?.description || 'unknown'

      const userMsg = [
        `Current time: ${currentTime}`,
        `Scheduling date: ${selStr}`,
        `Peak productive window: ${peakInfo}`,
        '\nOpen tasks ranked by priority score:',
        taskLines,
        '\nFixed commitments / reminders today:',
        remLines,
      ].join('\n')

      const systemPrompt = buildSystemPrompt({ memories, extraRules: SCHEDULE_EXTRA_RULES })

      const effectiveModel = (provider === 'ollama')
        ? (ollamaModel || 'llama3')
        : (model || 'claude-sonnet-4-20250514')

      const rawText = await window.electronAPI.ai.chat(
        [{ role: 'user', content: userMsg }],
        provider,
        effectiveModel,
        ollamaEndpoint || null,
        systemPrompt,
      )

      const blocks = parseScheduleBlocks(rawText)
      if (!blocks.length) throw new Error('AI returned no valid time blocks')

      setSchedule(blocks)
      await saveSchedule(blocks)
    } catch (err) {
      setScheduleError(err.message || 'Failed to generate schedule')
    } finally {
      setScheduleLoading(false)
    }
  }

  async function completeBlock(taskId) {
    if (!taskId) return
    const row = await window.electronAPI.db.get(
      'SELECT epic_id FROM subtasks WHERE id = ?', [taskId]
    ).catch(() => null)
    if (!row) return

    await window.electronAPI.db.run(
      "UPDATE subtasks SET status='done', completed_at=CURRENT_TIMESTAMP WHERE id=?",
      [taskId]
    )

    // Recalc epic progress
    const progress = await window.electronAPI.db.get(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done
       FROM subtasks WHERE epic_id=? AND parent_id IS NULL`,
      [row.epic_id]
    ).catch(() => null)
    if (progress) {
      const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
      await window.electronAPI.db.run(
        'UPDATE epics SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [pct, row.epic_id]
      )
    }

    await awardXp?.(15)
    await window.electronAPI.tasks.runScoring().catch(() => {})

    // Mark block as done in state + persist
    setSchedule(prev => {
      const next = prev.map(b => b.task_id === taskId ? { ...b, done: true } : b)
      saveSchedule(next)
      return next
    })
    // Refresh tasks list
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  function reorderBlocks(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    setSchedule(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      saveSchedule(next)
      return next
    })
  }

  const allDone  = habits.length > 0 && habits.every(h => loggedIds.has(h.id))
  const doneCount = habits.filter(h => loggedIds.has(h.id)).length

  return (
    <div className="page-enter max-w-[660px]">

      {/* Header */}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-extrabold text-teal-dark">
              {DAY_NAMES[selDate.getDay()]}
            </h1>
            {isToday && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                style={{ background: '#1D9E7520', color: '#1D9E75' }}>TODAY</span>
            )}
          </div>
          <p className="text-[12px] text-text-muted mt-0.5">
            {MONTHS[selDate.getMonth()]} {selDate.getDate()}, {selDate.getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              onClick={() => { setSelDate(new Date(today)); setWeekAnchor(new Date(today)) }}
              className="text-[11px] font-bold text-primary hover:text-teal-med transition-colors"
            >
              ← Back to today
            </button>
          )}
          {/* Generate my day button */}
          {confirmRegenerate ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ background: '#FFF8EC', border: '1.5px solid #EF9F2740' }}>
              <span className="text-[10px] font-bold" style={{ color: '#a65c00' }}>Replace schedule?</span>
              <button onClick={generateSchedule}
                className="text-[10px] font-extrabold px-2 py-0.5 rounded transition-all"
                style={{ background: '#EF9F27', color: 'white', border: '1.5px solid #a65c00' }}>
                Yes
              </button>
              <button onClick={() => setConfirmRegenerate(false)}
                className="text-[10px] font-bold px-2 py-0.5 rounded transition-all"
                style={{ background: '#f4fdf8', color: '#4a7060', border: '1.5px solid #b3e8d3' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => schedule.length > 0 ? setConfirmRegenerate(true) : generateSchedule()}
              disabled={scheduleLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-extrabold rounded-[10px] transition-all disabled:opacity-50"
              style={{
                background: '#EF9F27',
                color: 'white',
                border: '2px solid #a65c00',
                boxShadow: '2px 2px 0 #a65c00',
              }}
            >
              {scheduleLoading ? (
                <>
                  <SpinIcon />
                  Generating…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                  Generate my day
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Week strip */}
      <div className="mb-6 p-4 bg-white retro-card">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => shiftWeek(-1)}
            className="p-1 text-text-hint hover:text-primary transition-colors rounded">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
            {MONTHS[weekDays[0].getMonth()].slice(0,3)} {weekDays[0].getDate()} – {weekDays[6].getDate()}, {weekDays[6].getFullYear()}
          </span>
          <button onClick={() => shiftWeek(1)}
            className="p-1 text-text-hint hover:text-primary transition-colors rounded">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d, i) => {
            const str      = toDateStr(d)
            const isSel    = str === selStr
            const isT      = str === todayStr
            const dotCount = dotMap[str] || 0
            return (
              <button key={str} onClick={() => setSelDate(new Date(d))}
                className="flex flex-col items-center gap-1 py-2.5 rounded-lg transition-all"
                style={{
                  background: isSel ? '#1D9E75' : isT ? '#eefaf4' : 'transparent',
                  border: `2px solid ${isSel ? '#085041' : isT ? '#b3e8d3' : 'transparent'}`,
                  boxShadow: isSel ? '2px 2px 0 #085041' : 'none',
                }}
              >
                <span className="text-[8px] font-extrabold uppercase"
                  style={{ color: isSel ? 'rgba(255,255,255,0.65)' : '#9bbdaa' }}>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}
                </span>
                <span className="text-[15px] font-extrabold leading-none"
                  style={{ color: isSel ? 'white' : isT ? '#1D9E75' : '#085041' }}>
                  {d.getDate()}
                </span>
                <div className="flex gap-0.5 h-1.5">
                  {Array.from({ length: Math.min(dotCount, 3) }).map((_, di) => (
                    <span key={di} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isSel ? 'rgba(255,255,255,0.55)' : '#1D9E75' }} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Reminders */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px]">🔔</span>
            <h2 className="text-[13px] font-extrabold text-teal-dark">Reminders</h2>
            {reminders.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#1D9E7520', color: '#1D9E75' }}>
                {reminders.filter(r => !r.is_done).length} left
              </span>
            )}
          </div>
          <button onClick={() => setAddingRem(a => !a)}
            className="text-[11px] font-bold text-primary hover:text-teal-med transition-colors">
            {addingRem ? 'Cancel' : '+ Add'}
          </button>
        </div>

        <div className="bg-white retro-card p-4">
          {addingRem && (
            <div className="flex gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid #eef9f4' }}>
              <input autoFocus
                value={remTitle}
                onChange={e => setRemTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addReminder()}
                placeholder="What do you need to do?"
                className="flex-1 px-3 py-1.5 text-[12px] bg-teal-pale border border-teal-border rounded-lg outline-none focus:border-primary text-text-pri placeholder:text-text-hint"
              />
              <input type="time" value={remTime}
                onChange={e => setRemTime(e.target.value)}
                className="px-2 py-1.5 text-[12px] bg-teal-pale border border-teal-border rounded-lg outline-none focus:border-primary text-text-pri"
                style={{ width: 100 }}
              />
              <button onClick={addReminder} disabled={!remTitle.trim()}
                className="px-3 py-1.5 text-[11px] font-bold text-white game-btn disabled:opacity-40"
                style={{ background: '#1D9E75', border: '2px solid #085041', boxShadow: '2px 2px 0 #085041', borderRadius: 6 }}>
                Add
              </button>
            </div>
          )}

          {reminders.length === 0 && !addingRem && (
            <p className="text-[12px] text-text-hint py-1">
              No reminders for {isToday ? 'today' : 'this day'}.{' '}
              <button onClick={() => setAddingRem(true)} className="text-primary font-bold hover:underline">Add one →</button>
            </p>
          )}

          <div className="flex flex-col gap-2">
            {reminders.map(r => (
              <div key={r.id} className="flex items-center gap-2.5 group">
                <button onClick={() => toggleReminder(r.id, r.is_done)} className="flex-shrink-0 mt-0.5">
                  <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                    style={{ borderColor: r.is_done ? '#1D9E75' : '#b3e8d3', background: r.is_done ? '#1D9E75' : 'transparent' }}>
                    {!!r.is_done && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
                {r.remind_time && (
                  <span className="text-[10px] font-bold text-text-hint w-16 flex-shrink-0">{fmtTime(r.remind_time)}</span>
                )}
                <span className="flex-1 text-[12px]"
                  style={{ color: r.is_done ? '#9bbdaa' : '#085041', textDecoration: r.is_done ? 'line-through' : 'none' }}>
                  {r.title}
                </span>
                <button onClick={() => deleteReminder(r.id)}
                  className="opacity-0 group-hover:opacity-100 text-text-hint hover:text-red-400 transition-all">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks due */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[14px]">📋</span>
          <h2 className="text-[13px] font-extrabold text-teal-dark">
            Tasks Due {isToday ? 'Today' : 'This Day'}
          </h2>
          {tasks.length > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: '#EF9F2720', color: '#EF9F27' }}>
              {tasks.length}
            </span>
          )}
        </div>

        <div className="bg-white retro-card p-4">
          {tasks.length === 0 ? (
            <p className="text-[12px] text-text-hint py-1">
              No tasks due {isToday ? 'today' : 'on this day'}. 🎉
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: COLOR_HEX[t.epic_color] || '#1D9E75' }} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: (COLOR_HEX[t.epic_color] || '#1D9E75') + '18', color: COLOR_HEX[t.epic_color] || '#1D9E75', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.epic_name}
                  </span>
                  <span className="text-[12px] text-text-pri flex-1">{t.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Habits — only show for today */}
      {isToday && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px]">🔥</span>
              <h2 className="text-[13px] font-extrabold text-teal-dark">Habits</h2>
              {habits.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: allDone ? '#22c55e20' : '#EF9F2720', color: allDone ? '#22c55e' : '#EF9F27' }}>
                  {allDone ? 'All done! 🎉' : `${doneCount}/${habits.length}`}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white retro-card p-4">
            {habits.length === 0 ? (
              <p className="text-[12px] text-text-hint py-1">No habits set up yet. Add some in Streaks!</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {habits.map(h => {
                  const done = loggedIds.has(h.id)
                  return (
                    <div key={h.id} className="flex items-center gap-2.5">
                      <button onClick={() => logHabit(h.id)} disabled={done} className="flex-shrink-0">
                        <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                          style={{ borderColor: done ? '#EF9F27' : '#b3e8d3', background: done ? '#EF9F27' : 'transparent' }}>
                          {done && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      </button>
                      <span className="flex-1 text-[12px]"
                        style={{ color: done ? '#9bbdaa' : '#085041' }}>
                        {h.name}
                      </span>
                      <span className="text-[11px] font-extrabold" style={{ color: '#EF9F27' }}>
                        🔥 {h.current_streak}d
                      </span>
                      {!done && (
                        <button onClick={() => logHabit(h.id)}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all hover:opacity-80"
                          style={{ background: '#EF9F2720', color: '#EF9F27', border: '1px solid #EF9F2740' }}>
                          Log
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Schedule Timeline */}
      {(schedule.length > 0 || scheduleLoading) && (
        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[14px]">🗓️</span>
            <h2 className="text-[13px] font-extrabold text-teal-dark">AI Schedule</h2>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: '#7F77DD20', color: '#7F77DD' }}>
              drag to reorder
            </span>
          </div>

          {scheduleError && (
            <p className="text-[11px] font-bold mb-2" style={{ color: '#e05050' }}>
              ⚠ {scheduleError}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            {schedule.map((block, idx) => (
              <TimeBlock
                key={idx}
                block={block}
                index={idx}
                isDragOver={dragOverIdx === idx}
                onDone={() => completeBlock(block.task_id)}
                onDragStart={() => { setDragIdx(idx); setDragOverIdx(null) }}
                onDragOver={() => setDragOverIdx(idx)}
                onDrop={() => {
                  reorderBlocks(dragIdx, idx)
                  setDragIdx(null)
                  setDragOverIdx(null)
                }}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error shown when schedule is empty but something went wrong */}
      {!schedule.length && !scheduleLoading && scheduleError && (
        <p className="text-[11px] font-bold mb-4" style={{ color: '#e05050' }}>
          ⚠ {scheduleError}
        </p>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SpinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function TimeBlock({ block, index, isDragOver, onDone, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const isTask   = !!block.task_id
  const isDone   = !!block.done
  const isBreak  = !isTask

  const barColor = isDone ? '#9bbdaa' : isBreak ? '#c8e6d9' : '#1D9E75'
  const bg       = isDone ? '#f9fefb' : isBreak ? '#f9fefb' : 'white'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDrop={e => { e.preventDefault(); onDrop() }}
      onDragEnd={onDragEnd}
      className="flex items-start gap-3 p-3 rounded-[10px] transition-all select-none"
      style={{
        background: bg,
        border: `1.5px solid ${isDragOver ? '#1D9E75' : isDone ? '#d4f0e6' : '#e8f5ee'}`,
        boxShadow: isDragOver ? '0 0 0 2px rgba(29,158,117,0.2)' : '1px 1px 0 rgba(8,80,65,0.06)',
        opacity: isDone ? 0.6 : 1,
        cursor: 'grab',
      }}
    >
      {/* Drag handle */}
      <div className="flex-shrink-0 mt-0.5 text-text-hint" style={{ cursor: 'grab', lineHeight: 1 }}>
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="3" cy="2"  r="1.2" /><circle cx="7" cy="2"  r="1.2" />
          <circle cx="3" cy="7"  r="1.2" /><circle cx="7" cy="7"  r="1.2" />
          <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
        </svg>
      </div>

      {/* Color bar */}
      <div className="flex-shrink-0 w-1 self-stretch rounded-full mt-0.5"
        style={{ background: barColor, minHeight: 36 }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-extrabold tabular-nums"
            style={{ color: isDone ? '#9bbdaa' : '#4a7060' }}>
            {block.start_time}–{block.end_time}
          </span>
          <span className="text-[12px] font-bold flex-1 min-w-0 truncate"
            style={{
              color: isDone ? '#9bbdaa' : '#085041',
              textDecoration: isDone ? 'line-through' : 'none',
            }}>
            {block.label}
          </span>
          {isTask && !isDone && (
            <button
              onClick={e => { e.stopPropagation(); onDone() }}
              className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all hover:opacity-80 active:scale-95"
              style={{
                background: '#1D9E7518',
                color: '#1D9E75',
                border: '1.5px solid #b3e8d3',
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Done
            </button>
          )}
          {isDone && (
            <span className="flex-shrink-0 text-[10px] font-bold" style={{ color: '#22c55e' }}>✓ Done</span>
          )}
        </div>
        {block.reason && (
          <p className="text-[10px] mt-0.5 truncate"
            style={{ color: '#9bbdaa' }}>
            {block.reason}
          </p>
        )}
      </div>
    </div>
  )
}
