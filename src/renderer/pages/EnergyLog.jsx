import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const ENERGY_EMOJI = { 1: '😩', 2: '😕', 3: '😐', 4: '😊', 5: '🔥' }
const ENERGY_COLOR = { 1: '#ef4444', 2: '#f97316', 3: '#EF9F27', 4: '#1D9E75', 5: '#085041' }

export default function EnergyLog({ awardXp }) {
  const [logs, setLogs]       = useState([])
  const [today, setToday]     = useState(null)
  const [rating, setRating]   = useState(3)
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => { if (window.electronAPI) load() }, [])

  async function load() {
    try {
      const rows = await window.electronAPI.db.query(
        'SELECT * FROM energy_logs ORDER BY log_date DESC LIMIT 30', []
      )
      setLogs(rows)
      const todayRow = rows.find(r => r.log_date === todayStr)
      if (todayRow) {
        setToday(todayRow)
        setRating(todayRow.energy_rating)
        setNotes(todayRow.notes || '')
      }
    } catch {}
  }

  async function save() {
    setSaving(true)
    try {
      const isNew = !today
      await window.electronAPI.db.run(
        `INSERT INTO energy_logs (log_date, energy_rating, notes) VALUES (?, ?, ?)
         ON CONFLICT(log_date) DO UPDATE SET energy_rating=excluded.energy_rating, notes=excluded.notes`,
        [todayStr, rating, notes]
      )
      if (isNew) await awardXp?.(5)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await load()
    } catch {} finally { setSaving(false) }
  }

  const chartData = [...logs].reverse().map(r => ({
    date:   r.log_date.slice(5),
    energy: r.energy_rating,
  }))

  const avg = logs.length > 0
    ? (logs.reduce((s, r) => s + r.energy_rating, 0) / logs.length).toFixed(1)
    : '—'

  return (
    <div className="page-enter max-w-[680px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark">Energy Log</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Track your daily energy levels</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-text-hint uppercase tracking-wide">30-day avg</p>
          <p className="text-[22px] font-extrabold text-primary leading-none">{avg}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_260px] gap-6">
        {/* Left: Log today */}
        <div className="bg-white border border-teal-border rounded-card p-5">
          <p className="text-[13px] font-bold text-teal-dark mb-4">
            {today ? 'Update today\'s log' : 'How\'s your energy today?'}
          </p>

          {/* Rating buttons */}
          <div className="flex gap-2 mb-4">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={`flex-1 flex flex-col items-center py-2.5 rounded-[10px] transition-all border ${
                  rating === n
                    ? 'border-primary bg-teal-light shadow-sm scale-105'
                    : 'border-teal-border bg-teal-pale hover:bg-teal-light'
                }`}
              >
                <span className="text-xl mb-0.5">{ENERGY_EMOJI[n]}</span>
                <span className={`text-[10px] font-bold ${rating === n ? 'text-teal-dark' : 'text-text-hint'}`}>{n}</span>
              </button>
            ))}
          </div>

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What affected your energy today? (optional)"
            rows={3}
            className="w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri placeholder:text-text-hint resize-none mb-4"
          />

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2 bg-primary text-white text-[12px] font-bold rounded-[10px] hover:bg-teal-med disabled:opacity-40 transition-colors"
          >
            {saved ? '✓ Logged!' : saving ? 'Saving…' : today ? 'Update Log' : 'Log Energy'}
          </button>
        </div>

        {/* Right: Recent logs */}
        <div className="bg-white border border-teal-border rounded-card p-5">
          <p className="text-[13px] font-bold text-teal-dark mb-3">Recent</p>
          <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
            {logs.slice(0, 14).map(r => (
              <div key={r.id} className="flex items-center gap-2 py-1">
                <span className="text-sm">{ENERGY_EMOJI[r.energy_rating]}</span>
                <span className="text-[11px] text-text-muted flex-1">{r.log_date.slice(5)}</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <div
                      key={n}
                      className="w-2 h-2 rounded-full"
                      style={{ background: n <= r.energy_rating ? ENERGY_COLOR[r.energy_rating] : '#E1F5EE' }}
                    />
                  ))}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-[11px] text-text-hint text-center py-4">No entries yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 2 && (
        <div className="mt-6 bg-white border border-teal-border rounded-card p-5">
          <p className="text-[13px] font-bold text-teal-dark mb-4">Energy trend (last 30 days)</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1F5EE" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888780' }} interval="preserveStartEnd" />
              <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fontSize: 10, fill: '#888780' }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #d4f0e6' }}
                formatter={v => [ENERGY_EMOJI[v] + ' ' + v, 'Energy']}
              />
              <Line type="monotone" dataKey="energy" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3, fill: '#1D9E75' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
