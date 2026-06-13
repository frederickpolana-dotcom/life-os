import React, { useEffect, useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

// ── Constants ───────────────────────────────────────────────────────────────────

const LEVEL_THRESHOLDS = { 1: 0, 2: 200, 3: 500, 4: 1000, 5: 2000 }
const MAX_LEVEL = 5

const HEAT = ['#eef6f2', '#cdebdd', '#8fd9b7', '#3fb589', '#1D9E75'] // 0–4 intensity (teal ramp)
const MOOD_EMOJI = { 1: '😞', 2: '😔', 3: '😐', 4: '🙂', 5: '😄' }
const EPIC_HEX = { teal: '#1D9E75', amber: '#EF9F27', purple: '#7F77DD' }
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Date helpers ────────────────────────────────────────────────────────────────

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayStr = () => iso(new Date())
function shiftDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d }

// ── Animated count-up ───────────────────────────────────────────────────────────

function useCountUp(target, duration = 1100) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf, start
    const animate = (t) => {
      if (!start) start = t
      const p = Math.min((t - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(target * eased)
      if (p < 1) raf = requestAnimationFrame(animate)
      else setVal(target)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

function CountUp({ value, decimals = 0, className, style }) {
  const v = useCountUp(value)
  return <span className={className} style={style}>{v.toFixed(decimals)}</span>
}

// ── Progress ring ───────────────────────────────────────────────────────────────

function Ring({ pct, size = 96, stroke = 9, color = '#1D9E75', track = '#e3f4ec', children }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const animated = useCountUp(pct, 1200)
  const offset = circ * (1 - Math.min(animated, 100) / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────────

export default function Insights() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => { if (window.electronAPI) load() }, [])

  async function load() {
    setLoading(true)
    try {
      const heatStart = iso(shiftDays(-118))
      const monthStart = iso(shiftDays(-29))

      const q  = (sql, p = []) => window.electronAPI.db.query(sql, p).catch(() => [])
      const g1 = (sql, p = []) => window.electronAPI.db.get(sql, p).catch(() => null)

      const [
        xpTotal, xpLevel,
        tasksDoneRow, longestRow, journalCountRow, activeEpicRow,
        heatTasks, heatStreaks, heatRecurring, heatJournal, heatEnergy,
        moodRows, energyRows,
        habitRows, epicRows, weekdayRows,
      ] = await Promise.all([
        window.electronAPI.settings.get('xp_total'),
        window.electronAPI.settings.get('xp_level'),
        g1("SELECT COUNT(*) n FROM subtasks WHERE status='done' AND is_recurring=0"),
        g1('SELECT MAX(longest_streak) n FROM streak_habits'),
        g1('SELECT COUNT(*) n FROM journal_entries').catch(() => ({ n: 0 })),
        g1("SELECT COUNT(*) n FROM epics WHERE status!='done'"),
        // heatmap sources
        q("SELECT date(completed_at) d, COUNT(*) c FROM subtasks WHERE completed_at >= ? GROUP BY d", [heatStart]),
        q("SELECT logged_date d, COUNT(*) c FROM streak_logs WHERE logged_date >= ? GROUP BY d", [heatStart]),
        q("SELECT completed_date d, COUNT(*) c FROM recurring_completions WHERE completed_date >= ? GROUP BY d", [heatStart]),
        q("SELECT entry_date d FROM journal_entries WHERE entry_date >= ?", [heatStart]),
        q("SELECT log_date d FROM energy_logs WHERE log_date >= ?", [heatStart]),
        // trend
        q("SELECT entry_date d, mood FROM journal_entries WHERE entry_date >= ? AND mood IS NOT NULL", [monthStart]),
        q("SELECT log_date d, energy_rating e FROM energy_logs WHERE log_date >= ?", [monthStart]),
        // habits
        q(`SELECT h.id, h.name, h.current_streak, h.longest_streak,
                  COUNT(l.id) logged
           FROM streak_habits h
           LEFT JOIN streak_logs l ON l.habit_id = h.id AND l.logged_date >= ?
           GROUP BY h.id ORDER BY h.current_streak DESC`, [monthStart]),
        // epics
        q("SELECT name, color, progress, status FROM epics WHERE status!='done' ORDER BY progress DESC LIMIT 6"),
        // weekday productivity
        q("SELECT strftime('%w', completed_at) dow, COUNT(*) c FROM subtasks WHERE completed_at IS NOT NULL GROUP BY dow"),
      ])

      // ── Build heatmap map ──
      const dayMap = {}
      const add = (date, n = 1) => { if (date) dayMap[date] = (dayMap[date] || 0) + n }
      heatTasks.forEach(r => add(r.d, r.c))
      heatStreaks.forEach(r => add(r.d, r.c))
      heatRecurring.forEach(r => add(r.d, r.c))
      heatJournal.forEach(r => add(r.d, 1))
      heatEnergy.forEach(r => add(r.d, 1))

      const cells = []
      for (let i = 118; i >= 0; i--) {
        const ds = iso(shiftDays(-i))
        cells.push({ date: ds, count: dayMap[ds] || 0 })
      }
      const activeDays = cells.filter(c => c.count > 0).length
      const totalActions = cells.reduce((s, c) => s + c.count, 0)

      // ── Trend (last 30 days) ──
      const moodMap = {}, energyMap = {}
      moodRows.forEach(r => { moodMap[r.d] = r.mood })
      energyRows.forEach(r => { energyMap[r.d] = r.e })
      const trend = []
      for (let i = 29; i >= 0; i--) {
        const ds = iso(shiftDays(-i))
        trend.push({
          date: ds.slice(5),
          mood: moodMap[ds] ?? null,
          energy: energyMap[ds] ?? null,
        })
      }

      // ── Weekday ──
      const weekday = WEEKDAYS.map((label, i) => {
        const row = weekdayRows.find(r => Number(r.dow) === i)
        return { day: label.slice(0, 3), count: row ? row.c : 0 }
      })

      const xp = Number(xpTotal) || 0
      const lvl = Number(xpLevel) || 1
      const cur = LEVEL_THRESHOLDS[lvl] ?? 0
      const next = LEVEL_THRESHOLDS[lvl + 1] ?? null
      const levelPct = next ? Math.min(100, ((xp - cur) / (next - cur)) * 100) : 100

      setData({
        xp, lvl, levelPct, next, xpIntoLevel: xp - cur, xpForLevel: next ? next - cur : 0,
        tasksDone: tasksDoneRow?.n || 0,
        longest: longestRow?.n || 0,
        journalCount: journalCountRow?.n || 0,
        activeEpics: activeEpicRow?.n || 0,
        cells, activeDays, totalActions,
        trend, weekday,
        habits: habitRows || [],
        epics: epicRows || [],
      })
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <InsightsSkeleton />
  if (!data) return <div className="text-text-muted text-[13px] p-8">No data yet — start using Life OS and come back.</div>

  return (
    <div className="page-enter max-w-[920px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark flex items-center gap-2">
            <ChartIcon /> Insights
          </h1>
          <p className="text-[12px] text-text-muted mt-0.5">Your life, measured. Patterns you can act on.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-text-hint uppercase tracking-wide">Lifetime actions</p>
          <p className="text-[20px] font-extrabold text-primary leading-none">
            <CountUp value={data.totalActions} />
          </p>
        </div>
      </div>

      {/* Hero stat row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {/* Level ring */}
        <div className="relative overflow-hidden flex items-center gap-3 px-4 py-4"
          style={{ background: 'linear-gradient(135deg,#063a2c,#0a5e44)', borderRadius: 10, boxShadow: '3px 3px 0 #04231a' }}>
          <Ring pct={data.levelPct} size={68} stroke={7} color="#4dffb0" track="rgba(255,255,255,0.12)">
            <span className="text-[16px] font-extrabold text-white leading-none">{data.lvl}</span>
            <span className="text-[7px] font-bold tracking-widest" style={{ color: '#4dffb0' }}>LVL</span>
          </Ring>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#6fdcae' }}>Level {data.lvl}</p>
            <p className="text-[15px] font-extrabold text-white leading-tight"><CountUp value={data.xp} /> XP</p>
            <p className="text-[9px]" style={{ color: '#7dc4a4' }}>
              {data.next ? `${data.xpForLevel - data.xpIntoLevel} to Lv ${data.lvl + 1}` : 'Max level 🏆'}
            </p>
          </div>
        </div>

        <HeroStat icon="✅" label="Tasks Completed" value={data.tasksDone} tint="#eafaf2" border="#b3e8d3" color="#085041" />
        <HeroStat icon="🔥" label="Longest Streak" value={data.longest} suffix=" days" tint="#fff7e8" border="#f5d28a" color="#a65c00" />
        <HeroStat icon="📖" label="Journal Entries" value={data.journalCount} tint="#f5f4ff" border="#cac8f5" color="#3d3a9e" />
      </div>

      {/* Activity heatmap */}
      <Heatmap cells={data.cells} activeDays={data.activeDays} />

      {/* Trend + Habits */}
      <div className="grid grid-cols-[1.2fr_1fr] gap-4 mt-5">
        <MoodEnergyTrend trend={data.trend} />
        <HabitConsistency habits={data.habits} />
      </div>

      {/* Epics + Weekday */}
      <div className="grid grid-cols-[1fr_1fr] gap-4 mt-5">
        <EpicProgress epics={data.epics} />
        <WeekdayProductivity weekday={data.weekday} />
      </div>
    </div>
  )
}

// ── Hero stat card ────────────────────────────────────────────────────────────────

function HeroStat({ icon, label, value, suffix = '', tint, border, color }) {
  return (
    <div className="relative overflow-hidden px-4 py-4" style={{ background: tint, border: `2px solid ${border}`, borderRadius: 10, boxShadow: `3px 3px 0 ${border}66` }}>
      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color, opacity: 0.7 }}>{label}</p>
      <p className="text-[24px] font-extrabold leading-none font-mono" style={{ color }}>
        <CountUp value={value} />{suffix}
      </p>
      <span className="absolute -bottom-2 right-1 text-[40px] select-none" style={{ opacity: 0.12 }}>{icon}</span>
    </div>
  )
}

// ── Activity heatmap ──────────────────────────────────────────────────────────────

function intensity(count) {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 2) return 2
  if (count <= 4) return 3
  return 4
}

function Heatmap({ cells, activeDays }) {
  // Pad so the first column starts on Sunday
  const firstDow = new Date(cells[0].date + 'T12:00:00').getDay()
  const padded = [...Array(firstDow).fill(null), ...cells]
  const weeks = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))

  // Month labels per column (show when the month changes)
  const monthLabels = weeks.map((week, wi) => {
    const firstReal = week.find(Boolean)
    if (!firstReal) return ''
    const d = new Date(firstReal.date + 'T12:00:00')
    const prevWeek = weeks[wi - 1]
    const prevReal = prevWeek?.find(Boolean)
    const prevMonth = prevReal ? new Date(prevReal.date + 'T12:00:00').getMonth() : -1
    return d.getMonth() !== prevMonth ? d.toLocaleDateString('en-US', { month: 'short' }) : ''
  })

  return (
    <div className="bg-white border border-teal-border rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[13px] font-bold text-teal-dark">Activity over the last 17 weeks</p>
          <p className="text-[10px] text-text-hint mt-0.5">Tasks, habits, journal & energy — every action counts</p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-extrabold text-primary leading-none"><CountUp value={activeDays} /></p>
          <p className="text-[9px] font-bold text-text-hint uppercase tracking-wide">active days</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 'min-content' }}>
          {/* Month labels */}
          <div className="flex gap-[3px] mb-1 pl-[22px]">
            {monthLabels.map((label, i) => (
              <div key={i} style={{ width: 13 }} className="text-[8px] font-bold text-text-hint">{label}</div>
            ))}
          </div>
          <div className="flex gap-[5px]">
            {/* Weekday labels */}
            <div className="flex flex-col gap-[3px] pr-1">
              {WEEKDAYS.map((d, i) => (
                <div key={i} style={{ height: 13, lineHeight: '13px' }} className="text-[8px] font-bold text-text-hint">
                  {i % 2 === 1 ? d.slice(0, 1) : ''}
                </div>
              ))}
            </div>
            {/* Columns */}
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }).map((_, di) => {
                    const cell = week[di]
                    if (!cell) return <div key={di} style={{ width: 13, height: 13 }} />
                    const lvl = intensity(cell.count)
                    return (
                      <div
                        key={di}
                        title={`${cell.date}: ${cell.count} action${cell.count === 1 ? '' : 's'}`}
                        style={{
                          width: 13, height: 13, borderRadius: 3,
                          background: HEAT[lvl],
                          border: lvl === 0 ? '1px solid #e6f1ec' : 'none',
                          transition: 'transform 0.1s',
                        }}
                        className="hover:scale-125"
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3">
        <span className="text-[9px] font-bold text-text-hint">Less</span>
        {HEAT.map((c, i) => (
          <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c, border: i === 0 ? '1px solid #e6f1ec' : 'none' }} />
        ))}
        <span className="text-[9px] font-bold text-text-hint">More</span>
      </div>
    </div>
  )
}

// ── Mood & Energy trend ───────────────────────────────────────────────────────────

function MoodEnergyTrend({ trend }) {
  const hasData = trend.some(t => t.mood != null || t.energy != null)
  return (
    <div className="bg-white border border-teal-border rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-bold text-teal-dark">Mood vs Energy</p>
        <div className="flex items-center gap-3">
          <Legend color="#1D9E75" label="Mood" />
          <Legend color="#EF9F27" label="Energy" />
        </div>
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef6f2" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9bbdaa' }} interval={6} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 9, fill: '#9bbdaa' }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #d4f0e6' }} />
            <Line type="monotone" dataKey="mood" stroke="#1D9E75" strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="energy" stroke="#EF9F27" strokeWidth={2.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyMini icon="📈" text="Log journal moods and daily energy to see how they move together." />
      )}
    </div>
  )
}

// ── Habit consistency ─────────────────────────────────────────────────────────────

function HabitConsistency({ habits }) {
  return (
    <div className="bg-white border border-teal-border rounded-card p-5">
      <p className="text-[13px] font-bold text-teal-dark mb-3">30-day consistency</p>
      {habits.length === 0 ? (
        <EmptyMini icon="🔥" text="No habits yet — build a streak to track consistency." />
      ) : (
        <div className="flex flex-col gap-3">
          {habits.slice(0, 5).map(h => {
            const pct = Math.min(100, Math.round((h.logged / 30) * 100))
            return (
              <div key={h.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-teal-dark truncate">{h.name}</span>
                  <span className="text-[10px] font-extrabold" style={{ color: pct >= 70 ? '#1D9E75' : pct >= 40 ? '#EF9F27' : '#9bbdaa' }}>
                    {pct}% · 🔥{h.current_streak}
                  </span>
                </div>
                <div style={{ height: 7, background: '#eef6f2', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 4,
                    background: pct >= 70 ? '#1D9E75' : pct >= 40 ? '#EF9F27' : '#cdebdd',
                    transition: 'width 0.9s cubic-bezier(0.34,1.56,0.64,1)',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Epic progress ─────────────────────────────────────────────────────────────────

function EpicProgress({ epics }) {
  return (
    <div className="bg-white border border-teal-border rounded-card p-5">
      <p className="text-[13px] font-bold text-teal-dark mb-3">Epic momentum</p>
      {epics.length === 0 ? (
        <EmptyMini icon="🚀" text="No active epics. Create a goal to start tracking progress." />
      ) : (
        <div className="flex flex-col gap-3">
          {epics.map((e, i) => {
            const c = EPIC_HEX[e.color] || '#1D9E75'
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-teal-dark truncate">{e.name}</span>
                  <span className="text-[10px] font-extrabold" style={{ color: c }}>{e.progress}%</span>
                </div>
                <div style={{ height: 7, background: '#eef6f2', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${e.progress}%`, background: c, borderRadius: 4, transition: 'width 0.9s cubic-bezier(0.34,1.56,0.64,1)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Weekday productivity ──────────────────────────────────────────────────────────

function WeekdayProductivity({ weekday }) {
  const max = Math.max(...weekday.map(w => w.count), 1)
  const peak = weekday.reduce((a, b) => (b.count > a.count ? b : a), weekday[0])
  const hasData = weekday.some(w => w.count > 0)
  return (
    <div className="bg-white border border-teal-border rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-bold text-teal-dark">When you get things done</p>
        {hasData && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#eafaf2', color: '#1D9E75' }}>Peak: {peak.day}</span>}
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={weekday} margin={{ top: 4, right: 8, bottom: 0, left: -28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef6f2" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#9bbdaa' }} />
            <YAxis tick={{ fontSize: 9, fill: '#9bbdaa' }} allowDecimals={false} />
            <Tooltip cursor={{ fill: '#f4fbf8' }} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #d4f0e6' }} formatter={v => [v, 'tasks']} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {weekday.map((w, i) => (
                <Cell key={i} fill={w.count === max ? '#1D9E75' : '#a8ddc4'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyMini icon="📊" text="Complete tasks to discover your most productive days." />
      )}
    </div>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────────

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      <span className="text-[9px] font-bold text-text-muted">{label}</span>
    </div>
  )
}

function EmptyMini({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-[26px] mb-2 opacity-40">{icon}</span>
      <p className="text-[11px] text-text-hint max-w-[220px] leading-relaxed">{text}</p>
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div className="page-enter max-w-[920px]">
      <div className="h-6 w-32 rounded mb-6" style={{ background: '#e8f5ee' }} />
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-[88px] rounded-[10px]" style={{ background: '#f0faf4', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
      <div className="h-[200px] rounded-card mb-5" style={{ background: '#f0faf4', animation: 'shimmer 1.5s ease-in-out infinite' }} />
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(i => <div key={i} className="h-[220px] rounded-card" style={{ background: '#f0faf4', animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />)}
      </div>
    </div>
  )
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
