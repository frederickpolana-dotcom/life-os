import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EpicCard from '../components/EpicCard'
import ProgressBar from '../components/ProgressBar'
import ConfettiCelebration from '../components/ConfettiCelebration'
import { WalkingMario } from '../components/MarioSprite'

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

  useEffect(() => { if (window.electronAPI) loadAll() }, [])

  async function loadAll() {
    try {
      const [epicRows, streakRows, logRows, taskStats, xpRow] = await Promise.all([
        window.electronAPI.db.query('SELECT * FROM epics ORDER BY updated_at DESC', []),
        window.electronAPI.db.query('SELECT * FROM streak_habits ORDER BY current_streak DESC', []),
        window.electronAPI.db.query(
          "SELECT habit_id FROM streak_logs WHERE logged_date = date('now')", []
        ),
        window.electronAPI.db.query(
          "SELECT COUNT(*) as total_tasks, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_tasks FROM subtasks WHERE parent_id IS NULL",
          []
        ),
        window.electronAPI.settings.get('xp_total'),
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
