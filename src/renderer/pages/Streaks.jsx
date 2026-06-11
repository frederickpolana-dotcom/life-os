import React, { useEffect, useState } from 'react'
import StreakCard from '../components/StreakCard'
import Modal from '../components/Modal'
import ConfettiCelebration from '../components/ConfettiCelebration'

const DEFAULT_FORM = { name: '', description: '', icon: 'flame' }

export default function Streaks({ awardXp }) {
  const [habits, setHabits]       = useState([])
  const [todayLogs, setTodayLogs] = useState(new Set())
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState(DEFAULT_FORM)
  const [saving, setSaving]       = useState(false)
  const [confetti, setConfetti]   = useState(0)

  const [logsMap, setLogsMap] = useState({})

  useEffect(() => { if (window.electronAPI) load() }, [])

  async function load() {
    try {
      const [habitRows, logRows, historyRows] = await Promise.all([
        window.electronAPI.db.query('SELECT * FROM streak_habits ORDER BY current_streak DESC', []),
        window.electronAPI.db.query("SELECT habit_id FROM streak_logs WHERE logged_date = date('now')", []),
        window.electronAPI.db.query(
          "SELECT habit_id, logged_date FROM streak_logs WHERE logged_date >= date('now', '-28 days')", []
        ),
      ])
      setHabits(habitRows)
      setTodayLogs(new Set(logRows.map(r => r.habit_id)))
      // Build map: habitId → Set<dateString>
      const map = {}
      for (const row of historyRows) {
        if (!map[row.habit_id]) map[row.habit_id] = new Set()
        map[row.habit_id].add(row.logged_date)
      }
      setLogsMap(map)
    } catch {}
  }

  async function logToday(habitId) {
    if (todayLogs.has(habitId)) return
    try {
      await window.electronAPI.db.run(
        "INSERT OR IGNORE INTO streak_logs (habit_id, logged_date, completed) VALUES (?, date('now'), 1)",
        [habitId]
      )
      const habit = habits.find(h => h.id === habitId)
      const newStreak  = (habit?.current_streak || 0) + 1
      const newLongest = Math.max(habit?.longest_streak || 0, newStreak)
      await window.electronAPI.db.run(
        'UPDATE streak_habits SET current_streak = ?, longest_streak = ? WHERE id = ?',
        [newStreak, newLongest, habitId]
      )
      const result = await awardXp(10)
      if (result?.levelUp) setConfetti(c => c + 1)
      setTodayLogs(prev => new Set([...prev, habitId]))
      setHabits(prev => prev.map(h =>
        h.id === habitId ? { ...h, current_streak: newStreak, longest_streak: newLongest } : h
      ))
    } catch {}
  }

  async function saveHabit() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        'INSERT INTO streak_habits (name, description, icon, current_streak, longest_streak) VALUES (?,?,?,0,0)',
        [form.name.trim(), form.description.trim(), form.icon]
      )
      setAdding(false)
      setForm(DEFAULT_FORM)
      await load()
    } catch {} finally { setSaving(false) }
  }

  async function deleteHabit(habitId) {
    await window.electronAPI.db.run('DELETE FROM streak_habits WHERE id = ?', [habitId])
    await load()
  }

  const totalLogged = todayLogs.size
  const total       = habits.length

  return (
    <div className="page-enter max-w-[700px]">
      <ConfettiCelebration trigger={confetti} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark">Streaks</h1>
          <p className="text-[12px] text-text-muted mt-0.5">
            {totalLogged}/{total} habits logged today
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white game-btn"
          style={{ background: '#1D9E75', border: '2px solid #085041', boxShadow: '3px 3px 0 #085041', borderRadius: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Habit
        </button>
      </div>

      {/* Today progress bar */}
      {total > 0 && (
        <div className="bg-white px-5 py-4 mb-6 retro-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-teal-dark">Today's progress</span>
            <span className="text-[12px] font-extrabold text-primary">{total > 0 ? Math.round((totalLogged / total) * 100) : 0}%</span>
          </div>
          <div className="w-full h-2.5 bg-teal-light rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full progress-fill"
              style={{ width: `${total > 0 ? (totalLogged / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {habits.map((habit, i) => (
          <div key={habit.id} className="relative group bounce-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <StreakCard
              habit={habit}
              todayLogged={todayLogs.has(habit.id)}
              onLog={logToday}
              recentDates={logsMap[habit.id] || new Set()}
            />
            <button
              onClick={() => deleteHabit(habit.id)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-text-hint hover:text-red-500 transition-all p-1"
              title="Delete habit"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        ))}
        {habits.length === 0 && (
          <div className="col-span-2 text-center py-16 text-text-hint text-[13px]">
            No habits yet. Start building your streaks!
          </div>
        )}
      </div>

      <Modal open={adding} onClose={() => { setAdding(false); setForm(DEFAULT_FORM) }} title="New Habit" width={400}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">Habit name *</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveHabit()}
              placeholder="e.g. Morning meditation"
              className="w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri placeholder:text-text-hint"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes"
              className="w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri placeholder:text-text-hint"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setAdding(false)} className="px-4 py-2 text-[12px] font-bold text-text-sec hover:text-teal-dark transition-colors">Cancel</button>
          <button
            onClick={saveHabit}
            disabled={saving || !form.name.trim()}
            className="px-5 py-2 bg-primary text-white text-[12px] font-bold rounded-[10px] hover:bg-teal-med disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : 'Create Habit'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
