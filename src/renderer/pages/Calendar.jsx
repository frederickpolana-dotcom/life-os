import React, { useEffect, useState, useCallback } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_H = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const COLOR_HEX = { teal: '#1D9E75', amber: '#EF9F27', purple: '#7F77DD' }

function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Returns array of Date objects for the calendar grid (always 6 rows × 7 cols, Mon-first)
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const dow   = first.getDay() // 0=Sun
  const startOffset = dow === 0 ? 6 : dow - 1 // how many days before 1st
  const grid = []
  const start = new Date(first)
  start.setDate(1 - startOffset)
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    grid.push(d)
  }
  return grid
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// ── Dot legend ────────────────────────────────────────────────────────────────
// green  (#1D9E75) = task due
// amber  (#EF9F27) = reminder
// red    (#ef4444) = epic deadline

export default function Calendar({ awardXp }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const todayStr = toDateStr(today)

  const [view,    setView]    = useState('month')   // 'month' | 'year'
  const [year,    setYear]    = useState(today.getFullYear())
  const [month,   setMonth]   = useState(today.getMonth())
  const [dotData, setDotData] = useState({})  // dateStr → { tasks, reminders, epics }
  const [selDay,  setSelDay]  = useState(null) // dateStr of clicked day
  const [dayItems, setDayItems] = useState(null) // { tasks, reminders, epics }
  const [loadingDay, setLoadingDay] = useState(false)

  // Load dots for the visible range
  useEffect(() => {
    if (window.electronAPI) {
      if (view === 'month') loadMonthDots(year, month)
      else loadYearDots(year)
    }
  }, [view, year, month])

  async function loadMonthDots(y, m) {
    const start = toDateStr(new Date(y, m, 1))
    const end   = toDateStr(new Date(y, m + 1, 0))
    await loadDotsForRange(start, end)
  }

  async function loadYearDots(y) {
    const start = `${y}-01-01`
    const end   = `${y}-12-31`
    await loadDotsForRange(start, end)
  }

  async function loadDotsForRange(start, end) {
    try {
      const [taskRows, remRows, epicRows] = await Promise.all([
        window.electronAPI.db.query(
          `SELECT due_date FROM subtasks WHERE due_date >= ? AND due_date <= ? AND status != 'done' AND parent_id IS NULL`,
          [start, end]
        ),
        window.electronAPI.db.query(
          `SELECT remind_date FROM reminders WHERE remind_date >= ? AND remind_date <= ? AND is_done = 0`,
          [start, end]
        ).catch(() => []),
        window.electronAPI.db.query(
          `SELECT end_date, color FROM epics WHERE end_date >= ? AND end_date <= ? AND status != 'done'`,
          [start, end]
        ),
      ])

      const map = {}
      function ensure(d) { if (!map[d]) map[d] = { tasks: 0, reminders: 0, epics: [] } }

      taskRows.forEach(r => { ensure(r.due_date); map[r.due_date].tasks++ })
      remRows.forEach(r => { ensure(r.remind_date); map[r.remind_date].reminders++ })
      epicRows.forEach(r => { ensure(r.end_date); map[r.end_date].epics.push(r.color || 'teal') })

      setDotData(map)
    } catch {}
  }

  async function loadDayItems(dateStr) {
    setLoadingDay(true)
    try {
      const [tasks, reminders, epics] = await Promise.all([
        window.electronAPI.db.query(
          `SELECT s.id, s.title, s.status, e.name as epic_name, e.color as epic_color
           FROM subtasks s JOIN epics e ON e.id = s.epic_id
           WHERE s.due_date = ? AND s.parent_id IS NULL ORDER BY e.name, s.id`,
          [dateStr]
        ),
        window.electronAPI.db.query(
          `SELECT * FROM reminders WHERE remind_date = ? ORDER BY remind_time, id`,
          [dateStr]
        ).catch(() => []),
        window.electronAPI.db.query(
          `SELECT id, name, color, status FROM epics WHERE end_date = ?`,
          [dateStr]
        ),
      ])
      setDayItems({ tasks, reminders, epics })
    } catch {
      setDayItems({ tasks: [], reminders: [], epics: [] })
    } finally {
      setLoadingDay(false)
    }
  }

  function clickDay(dateStr) {
    if (selDay === dateStr) { setSelDay(null); setDayItems(null) }
    else { setSelDay(dateStr); loadDayItems(dateStr) }
  }

  function prevPeriod() {
    if (view === 'month') {
      if (month === 0) { setMonth(11); setYear(y => y - 1) }
      else setMonth(m => m - 1)
    } else {
      setYear(y => y - 1)
    }
    setSelDay(null); setDayItems(null)
  }

  function nextPeriod() {
    if (view === 'month') {
      if (month === 11) { setMonth(0); setYear(y => y + 1) }
      else setMonth(m => m + 1)
    } else {
      setYear(y => y + 1)
    }
    setSelDay(null); setDayItems(null)
  }

  function goToday() {
    setView('month'); setYear(today.getFullYear()); setMonth(today.getMonth())
    setSelDay(todayStr); loadDayItems(todayStr)
  }

  const grid = buildMonthGrid(year, month)

  return (
    <div className="page-enter max-w-[780px]">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark">Calendar</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Deadlines, reminders & tasks at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded overflow-hidden" style={{ border: '2px solid #b3e8d3' }}>
            {['month','year'].map(v => (
              <button key={v} onClick={() => { setView(v); setSelDay(null); setDayItems(null) }}
                className="px-3 py-1 text-[11px] font-bold transition-colors capitalize"
                style={{
                  background: view === v ? '#1D9E75' : 'white',
                  color:      view === v ? 'white'   : '#1D9E75',
                }}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={goToday}
            className="px-3 py-1.5 text-[11px] font-bold game-btn"
            style={{ background: '#eefaf4', color: '#1D9E75', border: '2px solid #b3e8d3', boxShadow: '2px 2px 0 rgba(8,80,65,0.15)', borderRadius: 4 }}>
            Today
          </button>
        </div>
      </div>

      {/* Nav row */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevPeriod}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-teal-light transition-colors"
          style={{ border: '2px solid #b3e8d3' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 className="text-[16px] font-extrabold text-teal-dark">
          {view === 'month' ? `${MONTHS[month]} ${year}` : year}
        </h2>
        <button onClick={nextPeriod}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-teal-light transition-colors"
          style={{ border: '2px solid #b3e8d3' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {view === 'month'
        ? <MonthGrid grid={grid} month={month} todayStr={todayStr} selDay={selDay} dotData={dotData} onClickDay={clickDay} />
        : <YearGrid year={year} todayStr={todayStr} selDay={selDay} dotData={dotData} onClickDay={clickDay} onGoMonth={(m) => { setMonth(m); setView('month') }} />
      }

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 px-1">
        <LegendDot color="#1D9E75" label="Task due" />
        <LegendDot color="#EF9F27" label="Reminder" />
        <LegendDot color="#ef4444" label="Epic deadline" />
      </div>

      {/* Day detail panel */}
      {selDay && (
        <DayPanel dateStr={selDay} items={dayItems} loading={loadingDay} onClose={() => { setSelDay(null); setDayItems(null) }} />
      )}
    </div>
  )
}

// ── Month grid ─────────────────────────────────────────────────────────────────
function MonthGrid({ grid, month, todayStr, selDay, dotData, onClickDay }) {
  return (
    <div className="bg-white retro-card overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-teal-border">
        {DAYS_H.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-extrabold uppercase tracking-wider"
            style={{ color: '#9bbdaa' }}>
            {d}
          </div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7">
        {grid.map((date, i) => {
          const str      = toDateStr(date)
          const inMonth  = date.getMonth() === month
          const isToday  = str === todayStr
          const isSel    = str === selDay
          const info     = dotData[str]
          const hasDots  = info && (info.tasks > 0 || info.reminders > 0 || info.epics?.length > 0)
          const isLastRow = i >= 35

          return (
            <button key={str} onClick={() => onClickDay(str)}
              className="relative flex flex-col items-center pt-2 pb-1.5 transition-all hover:bg-teal-light"
              style={{
                borderRight:  (i + 1) % 7 !== 0 ? '1px solid #eef9f4' : 'none',
                borderBottom: !isLastRow ? '1px solid #eef9f4' : 'none',
                background:   isSel ? '#eefaf4' : isToday ? '#f4fdf8' : 'white',
                minHeight: 72,
              }}
            >
              {/* Date number */}
              <span className="w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-bold mb-1"
                style={{
                  background: isToday ? '#1D9E75' : isSel ? '#d4f0e6' : 'transparent',
                  color: isToday ? 'white' : inMonth ? (isSel ? '#085041' : '#085041') : '#c5dfd2',
                  fontWeight: isToday || isSel ? 800 : 600,
                }}>
                {date.getDate()}
              </span>

              {/* Dots */}
              {hasDots && (
                <div className="flex gap-0.5 flex-wrap justify-center px-1">
                  {info.tasks > 0 && Array.from({ length: Math.min(info.tasks, 3) }).map((_, di) => (
                    <span key={`t${di}`} className="w-1.5 h-1.5 rounded-full" style={{ background: '#1D9E75' }} />
                  ))}
                  {info.reminders > 0 && Array.from({ length: Math.min(info.reminders, 2) }).map((_, di) => (
                    <span key={`r${di}`} className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF9F27' }} />
                  ))}
                  {info.epics?.length > 0 && info.epics.slice(0, 2).map((c, di) => (
                    <span key={`e${di}`} className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} />
                  ))}
                </div>
              )}

              {/* Selected indicator */}
              {isSel && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{ border: '2px solid #1D9E75', borderRadius: 0 }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Year grid (12 mini calendars) ─────────────────────────────────────────────
function YearGrid({ year, todayStr, selDay, dotData, onClickDay, onGoMonth }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 12 }, (_, m) => (
        <MiniMonth key={m} year={year} month={m} todayStr={todayStr}
          selDay={selDay} dotData={dotData} onClickDay={onClickDay} onGoMonth={onGoMonth} />
      ))}
    </div>
  )
}

function MiniMonth({ year, month, todayStr, selDay, dotData, onClickDay, onGoMonth }) {
  const grid = buildMonthGrid(year, month)
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ border: '2px solid #b3e8d3', boxShadow: '2px 2px 0 #085041' }}>
      <button onClick={() => onGoMonth(month)}
        className="w-full py-1.5 text-[10px] font-extrabold text-center uppercase tracking-wider hover:bg-teal-light transition-colors"
        style={{ color: '#085041', borderBottom: '1px solid #b3e8d3' }}>
        {MONTHS[month].slice(0, 3)}
      </button>
      {/* mini day headers */}
      <div className="grid grid-cols-7 px-0.5 pt-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-[7px] font-bold" style={{ color: '#9bbdaa' }}>{d}</div>
        ))}
      </div>
      {/* mini cells */}
      <div className="grid grid-cols-7 px-0.5 pb-1.5 gap-y-0.5">
        {grid.map((date, i) => {
          const str     = toDateStr(date)
          const inMonth = date.getMonth() === month
          const isToday = str === todayStr
          const isSel   = str === selDay
          const info    = dotData[str]
          const hasDots = inMonth && info && (info.tasks > 0 || info.reminders > 0 || info.epics?.length > 0)
          return (
            <button key={str} onClick={() => inMonth && onClickDay(str)}
              className="flex flex-col items-center"
              style={{ cursor: inMonth ? 'pointer' : 'default' }}
            >
              <span className="w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold"
                style={{
                  background: isToday ? '#1D9E75' : isSel ? '#d4f0e6' : 'transparent',
                  color: isToday ? 'white' : inMonth ? '#085041' : '#d4e8dc',
                  fontWeight: isToday || isSel ? 800 : 500,
                }}>
                {date.getDate()}
              </span>
              {hasDots && (
                <div className="flex gap-px justify-center">
                  {info.tasks > 0      && <span className="w-1 h-1 rounded-full" style={{ background: '#1D9E75' }} />}
                  {info.reminders > 0  && <span className="w-1 h-1 rounded-full" style={{ background: '#EF9F27' }} />}
                  {info.epics?.length > 0 && <span className="w-1 h-1 rounded-full" style={{ background: '#ef4444' }} />}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Day detail panel ───────────────────────────────────────────────────────────
function DayPanel({ dateStr, items, loading, onClose }) {
  const date    = new Date(dateStr + 'T00:00:00')
  const WDAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const MTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const label   = `${WDAYS[date.getDay()]}, ${MTHS[date.getMonth()]} ${date.getDate()}`

  const tasks     = items?.tasks     || []
  const reminders = items?.reminders || []
  const epics     = items?.epics     || []
  const total     = tasks.length + reminders.length + epics.length

  return (
    <div className="mt-4 bg-white retro-card p-5 pop-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-extrabold text-teal-dark">{label}</h3>
          {!loading && total === 0 && <p className="text-[11px] text-text-hint mt-0.5">Nothing scheduled</p>}
        </div>
        <button onClick={onClose} className="text-text-hint hover:text-text-sec transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {loading && <div className="text-[12px] text-text-hint animate-pulse">Loading…</div>}

      {!loading && (
        <div className="flex flex-col gap-4">
          {/* Epic deadlines */}
          {epics.length > 0 && (
            <Section label="Epic Deadlines" dot="#ef4444">
              {epics.map(e => (
                <div key={e.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: COLOR_HEX[e.color] || '#1D9E75' }} />
                  <span className="text-[12px] font-bold text-text-pri">{e.name}</span>
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#ef444418', color: '#ef4444' }}>
                    {e.status === 'done' ? 'Done' : 'Deadline'}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {/* Reminders */}
          {reminders.length > 0 && (
            <Section label="Reminders" dot="#EF9F27">
              {reminders.map(r => (
                <div key={r.id} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center"
                    style={{ borderColor: r.is_done ? '#1D9E75' : '#b3e8d3', background: r.is_done ? '#1D9E75' : 'white' }}>
                    {!!r.is_done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  {r.remind_time && (
                    <span className="text-[10px] font-bold text-text-hint w-16 flex-shrink-0">{fmtTime(r.remind_time)}</span>
                  )}
                  <span className="text-[12px]"
                    style={{ color: r.is_done ? '#9bbdaa' : '#085041', textDecoration: r.is_done ? 'line-through' : 'none' }}>
                    {r.title}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {/* Tasks */}
          {tasks.length > 0 && (
            <Section label="Tasks Due" dot="#1D9E75">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded border-2 flex-shrink-0"
                    style={{ borderColor: t.status === 'done' ? '#1D9E75' : '#b3e8d3', background: t.status === 'done' ? '#1D9E75' : 'white' }} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: (COLOR_HEX[t.epic_color] || '#1D9E75') + '18', color: COLOR_HEX[t.epic_color] || '#1D9E75' }}>
                    {t.epic_name}
                  </span>
                  <span className="text-[12px] text-text-pri"
                    style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? '#9bbdaa' : '#085041' }}>
                    {t.title}
                  </span>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ label, dot, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">{label}</span>
      </div>
      <div className="flex flex-col gap-1.5 pl-1">{children}</div>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px] text-text-hint">{label}</span>
    </div>
  )
}
