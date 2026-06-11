import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EpicCard from '../components/EpicCard'
import ProgressBar from '../components/ProgressBar'
import ConfettiCelebration from '../components/ConfettiCelebration'
import { WalkingMario } from '../components/MarioSprite'
import { fmtDate, daysUntil } from '../utils/dates'

const HORIZON_TABS = [
  { key: 'all',     label: 'All' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year',    label: 'This Year' },
  { key: 'longterm',label: 'Long Term' },
]

export default function Dashboard({ awardXp, onOpenAI }) {
  const navigate = useNavigate()
  const [epics, setEpics]             = useState([])
  const [streaks, setStreaks]          = useState([])
  const [todayLogs, setTodayLogs]     = useState(new Set())
  const [horizonTab, setHorizonTab]   = useState('all')
  const [confetti, setConfetti]        = useState(0)
  const [stats, setStats]              = useState({ total_tasks: 0, done_tasks: 0, active_streaks: 0, total_xp: 0 })
  const [dueTodayTasks, setDueTodayTasks]   = useState([])
  const [overdueTasks, setOverdueTasks]     = useState([])
  const [doneTaskIds, setDoneTaskIds]       = useState(new Set())

  useEffect(() => { if (window.electronAPI) loadAll() }, [])

  async function loadAll() {
    try {
      const [epicRows, streakRows, logRows, taskStats, xpRow, todayRows, overdueRows] = await Promise.all([
        window.electronAPI.db.query('SELECT * FROM epics ORDER BY updated_at DESC', []),
        window.electronAPI.db.query('SELECT * FROM streak_habits ORDER BY current_streak DESC', []),
        window.electronAPI.db.query("SELECT habit_id FROM streak_logs WHERE logged_date = date('now')", []),
        window.electronAPI.db.query(
          "SELECT COUNT(*) as total_tasks, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_tasks FROM subtasks WHERE parent_id IS NULL", []
        ),
        window.electronAPI.settings.get('xp_total'),
        window.electronAPI.db.query(
          "SELECT s.id, s.title, s.due_date, s.status, e.name as epic_name, e.color as epic_color, e.id as epic_id FROM subtasks s JOIN epics e ON e.id = s.epic_id WHERE s.due_date = date('now') AND s.status != 'done' ORDER BY s.id",
          []
        ),
        window.electronAPI.db.query(
          "SELECT s.id, s.title, s.due_date, s.status, e.name as epic_name, e.color as epic_color, e.id as epic_id FROM subtasks s JOIN epics e ON e.id = s.epic_id WHERE s.due_date < date('now') AND s.status != 'done' ORDER BY s.due_date ASC",
          []
        ),
      ])
      setEpics(epicRows)
      setStreaks(streakRows)
      setTodayLogs(new Set(logRows.map(r => r.habit_id)))
      setStats({
        total_tasks:    taskStats[0]?.total_tasks || 0,
        done_tasks:     taskStats[0]?.done_tasks  || 0,
        active_streaks: streakRows.filter(s => s.current_streak > 0).length,
        total_xp:       Number(xpRow) || 0,
      })
      setDueTodayTasks(todayRows)
      setOverdueTasks(overdueRows)
    } catch {}
  }

  async function completeTask(taskId, epicId) {
    try {
      await window.electronAPI.db.run(
        'UPDATE subtasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['done', taskId]
      )
      // Recalc epic progress
      const rows = await window.electronAPI.db.query(
        "SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM subtasks WHERE epic_id = ? AND parent_id IS NULL",
        [epicId]
      )
      const pct = rows[0]?.total > 0 ? Math.round((rows[0].done / rows[0].total) * 100) : 0
      await window.electronAPI.db.run('UPDATE epics SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [pct, epicId])
      const result = await awardXp(15)
      if (result?.levelUp) setConfetti(c => c + 1)
      setDoneTaskIds(prev => new Set([...prev, taskId]))
      setDueTodayTasks(prev => prev.filter(t => t.id !== taskId))
      setOverdueTasks(prev => prev.filter(t => t.id !== taskId))
    } catch {}
  }

  async function logStreak(habitId) {
    if (todayLogs.has(habitId)) return
    try {
      await window.electronAPI.db.run(
        "INSERT OR IGNORE INTO streak_logs (habit_id, logged_date, completed) VALUES (?, date('now'), 1)",
        [habitId]
      )
      const habit = streaks.find(s => s.id === habitId)
      const newStreak = (habit?.current_streak || 0) + 1
      const newLongest = Math.max(habit?.longest_streak || 0, newStreak)
      await window.electronAPI.db.run(
        'UPDATE streak_habits SET current_streak = ?, longest_streak = ? WHERE id = ?',
        [newStreak, newLongest, habitId]
      )
      const result = await awardXp(10)
      if (result?.levelUp) setConfetti(c => c + 1)
      setTodayLogs(prev => new Set([...prev, habitId]))
      setStreaks(prev => prev.map(s =>
        s.id === habitId ? { ...s, current_streak: newStreak, longest_streak: newLongest } : s
      ))
    } catch {}
  }

  const visibleEpics = horizonTab === 'all' ? epics : epics.filter(e => e.horizon === horizonTab)
  const inProgressEpics = epics.filter(e => e.status === 'in_progress')

  return (
    <div className="page-enter max-w-[900px]">
      <ConfettiCelebration trigger={confetti} />
      <WalkingMario onOpenAI={onOpenAI} />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Epics"   value={inProgressEpics.length}                     color="teal"   icon="⚔️" />
        <StatCard label="Tasks Done"     value={`${stats.done_tasks}/${stats.total_tasks}`} color="amber"  icon="✅" />
        <StatCard label="Active Streaks" value={stats.active_streaks}                        color="purple" icon="🔥" />
        <StatCard label="Total XP"       value={stats.total_xp}                              color="teal"   icon="⭐" />
      </div>

      {/* Today's Schedule */}
      {(dueTodayTasks.length > 0 || overdueTasks.length > 0) && (
        <div className="mb-6 p-5 bg-white bounce-in" style={{ border: '2px solid #1D9E75', boxShadow: '3px 3px 0 #085041', borderRadius: 4 }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[15px]">📅</span>
              <h2 className="text-[15px] font-extrabold text-teal-dark">Today's Schedule</h2>
              {dueTodayTasks.length > 0 && (
                <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">{dueTodayTasks.length} due</span>
              )}
            </div>
            {overdueTasks.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca' }}>
                ⚠️ {overdueTasks.length} overdue (bolos)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Due Today */}
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-2">
                Due Today
              </p>
              {dueTodayTasks.length === 0
                ? <p className="text-[11px] text-text-hint py-2">Nothing due today 🎉</p>
                : dueTodayTasks.map(task => (
                  <DailyTaskRow key={task.id} task={task} onDone={completeTask} urgent={false} />
                ))
              }
            </div>

            {/* Overdue / Bolos */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: overdueTasks.length > 0 ? '#ef4444' : '#9bbdaa' }}>
                Overdue / Bolos
              </p>
              {overdueTasks.length === 0
                ? <p className="text-[11px] text-text-hint py-2">No overdue tasks 💪</p>
                : overdueTasks.map(task => (
                  <DailyTaskRow key={task.id} task={task} onDone={completeTask} urgent={true} />
                ))
              }
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Left: Epics */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-extrabold text-teal-dark">My Epics</h2>
            <button
              onClick={() => navigate('/epics')}
              className="text-[11px] font-bold text-primary hover:text-teal-med transition-colors"
            >
              View all →
            </button>
          </div>

          {/* Horizon tabs */}
          <div className="flex gap-1 mb-4">
            {HORIZON_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setHorizonTab(tab.key)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors game-btn ${
                  horizonTab === tab.key
                    ? 'bg-primary text-white'
                    : 'bg-teal-light text-teal-med hover:bg-teal-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {visibleEpics.length === 0 ? (
              <div className="text-center py-12 text-text-hint text-[13px]">No epics in this horizon yet.</div>
            ) : (
              visibleEpics.map(epic => <EpicCard key={epic.id} epic={epic} />)
            )}
          </div>
        </section>

        {/* Right: Daily streaks */}
        <section>
          <h2 className="text-[16px] font-extrabold text-teal-dark mb-4">Daily Streaks</h2>
          <div className="flex flex-col gap-3">
            {streaks.map(habit => (
              <StreakMini
                key={habit.id}
                habit={habit}
                logged={todayLogs.has(habit.id)}
                onLog={logStreak}
              />
            ))}
            {streaks.length === 0 && (
              <p className="text-[12px] text-text-hint text-center py-8">No habits yet.</p>
            )}
            <button
              onClick={() => navigate('/streaks')}
              className="mt-1 text-[11px] font-bold text-primary hover:text-teal-med text-center transition-colors"
            >
              Manage streaks →
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, icon }) {
  const S = {
    teal:   { bg: '#eefaf4', text: '#085041', border: '#1D9E75', shadow: '#085041' },
    amber:  { bg: '#fff8ec', text: '#7a4800', border: '#EF9F27', shadow: '#a65c00' },
    purple: { bg: '#f5f4ff', text: '#3d3a9e', border: '#7F77DD', shadow: '#3d3a9e' },
  }[color] || { bg: '#eefaf4', text: '#085041', border: '#1D9E75', shadow: '#085041' }

  return (
    <div
      className="px-5 py-4 relative overflow-hidden cursor-default"
      style={{
        background: S.bg,
        border: `2px solid ${S.border}`,
        borderTop: `4px solid ${S.border}`,
        boxShadow: `3px 3px 0 ${S.shadow}`,
        borderRadius: 4,
        transition: 'transform 0.08s, box-shadow 0.08s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translate(-1px,-1px)'
        e.currentTarget.style.boxShadow = `4px 4px 0 ${S.shadow}`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = `3px 3px 0 ${S.shadow}`
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: S.text, opacity: 0.65 }}>{label}</p>
      <p className="text-[24px] font-extrabold leading-none font-mono" style={{ color: S.text }}>{value}</p>
      {icon && (
        <span className="absolute bottom-2 right-3 text-[28px] select-none" style={{ opacity: 0.1 }}>
          {icon}
        </span>
      )}
    </div>
  )
}

const EPIC_COLOR_HEX = { teal: '#1D9E75', amber: '#EF9F27', purple: '#7F77DD' }

function DailyTaskRow({ task, onDone, urgent }) {
  const days     = task.due_date ? daysUntil(task.due_date) : 0
  const overdue  = days < 0
  const accentColor = urgent ? '#ef4444' : '#1D9E75'
  const epicColor   = EPIC_COLOR_HEX[task.epic_color] || '#1D9E75'

  return (
    <div
      className="flex items-center gap-2 mb-2 px-3 py-2 bg-white hover-lift"
      style={{
        border: `1.5px solid ${urgent ? '#fecaca' : '#d4f0e6'}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 4,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-teal-dark truncate">{task.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: epicColor + '18', color: epicColor }}>
            {task.epic_name}
          </span>
          {task.due_date && (
            <span className="text-[9px] font-bold" style={{ color: accentColor }}>
              {overdue ? `${Math.abs(days)}d late` : fmtDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDone(task.id, task.epic_id)}
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all game-btn"
        title="Mark done (+15 XP)"
        style={{ background: accentColor + '18', border: `1.5px solid ${accentColor}`, color: accentColor }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  )
}

function StreakMini({ habit, logged, onLog }) {
  return (
    <div
      className="bg-white px-4 py-3 flex items-center justify-between gap-3"
      style={{
        border: logged ? '2px solid #1D9E75' : '2px solid #d4f0e6',
        borderRadius: 4,
        boxShadow: logged ? '3px 3px 0 #085041' : '3px 3px 0 rgba(8,80,65,0.15)',
        transition: 'box-shadow 0.15s',
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-teal-dark truncate">{habit.name}</p>
        <p className="text-[10px] text-text-hint">🔥 {habit.current_streak} day streak</p>
      </div>
      <button
        onClick={() => onLog(habit.id)}
        disabled={logged}
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all game-btn ${
          logged
            ? 'bg-green-done/10 text-green-done cursor-default'
            : 'bg-teal-light text-teal-med hover:bg-primary hover:text-white'
        }`}
      >
        {logged ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>
    </div>
  )
}
