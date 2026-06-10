import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CATEGORIES = [
  { key: 'deep_work_hours', label: 'Deep Work',  color: '#1D9E75' },
  { key: 'learning_hours',  label: 'Learning',   color: '#7F77DD' },
  { key: 'admin_hours',     label: 'Admin',      color: '#EF9F27' },
  { key: 'social_hours',    label: 'Social',     color: '#085041' },
  { key: 'rest_hours',      label: 'Rest',       color: '#B4B2A9' },
]

function getWeekStart(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + 1 + offset * 7)
  return d.toISOString().split('T')[0]
}

export default function TimeAudit() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [entry, setEntry]           = useState(null)
  const [form, setForm]             = useState({ deep_work_hours: '', learning_hours: '', admin_hours: '', social_hours: '', rest_hours: '', notes: '' })
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  const weekStart = getWeekStart(weekOffset)

  useEffect(() => { if (window.electronAPI) load() }, [weekStart])

  async function load() {
    try {
      const row = await window.electronAPI.db.get(
        'SELECT * FROM time_logs WHERE week_start = ?', [weekStart]
      )
      if (row) {
        setEntry(row)
        setForm({
          deep_work_hours: row.deep_work_hours || '',
          learning_hours:  row.learning_hours  || '',
          admin_hours:     row.admin_hours     || '',
          social_hours:    row.social_hours    || '',
          rest_hours:      row.rest_hours      || '',
          notes:           row.notes           || '',
        })
      } else {
        setEntry(null)
        setForm({ deep_work_hours: '', learning_hours: '', admin_hours: '', social_hours: '', rest_hours: '', notes: '' })
      }
    } catch {}
  }

  async function save() {
    setSaving(true)
    try {
      const vals = [
        parseFloat(form.deep_work_hours) || 0,
        parseFloat(form.learning_hours)  || 0,
        parseFloat(form.admin_hours)     || 0,
        parseFloat(form.social_hours)    || 0,
        parseFloat(form.rest_hours)      || 0,
        form.notes,
        weekStart,
      ]
      await window.electronAPI.db.run(
        `INSERT INTO time_logs (week_start, deep_work_hours, learning_hours, admin_hours, social_hours, rest_hours, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(week_start) DO UPDATE SET
           deep_work_hours=excluded.deep_work_hours,
           learning_hours=excluded.learning_hours,
           admin_hours=excluded.admin_hours,
           social_hours=excluded.social_hours,
           rest_hours=excluded.rest_hours,
           notes=excluded.notes`,
        vals
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await load()
    } catch {} finally { setSaving(false) }
  }

  const chartData = CATEGORIES.map(c => ({
    name:  c.label,
    hours: parseFloat(form[c.key]) || 0,
    color: c.color,
  })).filter(d => d.hours > 0)

  const totalHours = CATEGORIES.reduce((s, c) => s + (parseFloat(form[c.key]) || 0), 0)

  return (
    <div className="page-enter max-w-[700px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark">Time Audit</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Track how you spend each week</p>
        </div>
        {/* Week nav */}
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(o => o - 1)} className="w-8 h-8 rounded-[10px] bg-teal-light text-teal-med flex items-center justify-center hover:bg-teal-border transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className="text-[12px] font-bold text-teal-dark w-[120px] text-center">
            {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : `Week of ${weekStart}`}
          </span>
          <button onClick={() => setWeekOffset(o => Math.min(0, o + 1))} disabled={weekOffset >= 0} className="w-8 h-8 rounded-[10px] bg-teal-light text-teal-med flex items-center justify-center hover:bg-teal-border disabled:opacity-30 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Input form */}
        <div className="bg-white border border-teal-border rounded-card p-5">
          <p className="text-[13px] font-bold text-teal-dark mb-4">Hours this week</p>
          <div className="flex flex-col gap-3">
            {CATEGORIES.map(cat => (
              <div key={cat.key} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                <label className="text-[12px] font-medium text-text-sec w-[90px]">{cat.label}</label>
                <input
                  type="number"
                  min="0"
                  max="168"
                  step="0.5"
                  value={form[cat.key]}
                  onChange={e => setForm(f => ({ ...f, [cat.key]: e.target.value }))}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-[12px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri"
                />
                <span className="text-[11px] text-text-hint w-6">hrs</span>
              </div>
            ))}
            <div className="pt-2 border-t border-teal-border">
              <label className="block text-[11px] font-bold text-text-muted mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Reflections on this week…"
                className="w-full px-2 py-1.5 text-[12px] bg-teal-pale border border-teal-border rounded-sm outline-none focus:border-primary text-text-pri resize-none"
              />
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="mt-4 w-full py-2 bg-primary text-white text-[12px] font-bold rounded-[10px] hover:bg-teal-med disabled:opacity-40 transition-colors"
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Week'}
          </button>
        </div>

        {/* Chart */}
        <div className="bg-white border border-teal-border rounded-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold text-teal-dark">Breakdown</p>
            <span className="text-[12px] font-extrabold text-primary">{totalHours.toFixed(1)}h total</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888780' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888780' }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #d4f0e6' }}
                  formatter={v => [`${v}h`, 'Hours']}
                />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-text-hint text-[12px]">
              Enter hours to see breakdown
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
