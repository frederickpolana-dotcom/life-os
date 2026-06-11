import React, { useEffect, useState } from 'react'

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
  }

  async function loadAll() {
    try {
      const [taskRows, remRows, habitRows, logRows] = await Promise.all([
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
      ])
      setTasks(taskRows)
      setReminders(remRows)
      setHabits(habitRows)
      setLoggedIds(new Set(logRows.map(r => r.habit_id)))
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

  const allDone  = habits.length > 0 && habits.every(h => loggedIds.has(h.id))
  const doneCount = habits.filter(h => loggedIds.has(h.id)).length

  return (
    <div className="page-enter max-w-[660px]">

      {/* Header */}
      <div className="mb-5 flex items-end justify-between">
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
        {!isToday && (
          <button
            onClick={() => { setSelDate(new Date(today)); setWeekAnchor(new Date(today)) }}
            className="text-[11px] font-bold text-primary hover:text-teal-med transition-colors"
          >
            ← Back to today
          </button>
        )}
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
    </div>
  )
}
