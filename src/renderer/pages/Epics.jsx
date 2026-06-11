import React, { useEffect, useState } from 'react'
import EpicCard from '../components/EpicCard'
import Modal from '../components/Modal'
import { presetToEndDate, endDateToHorizon, daysUntil } from '../utils/dates'

const PRESETS = ['2 weeks', '1 month', '2 months', '3 months', '6 months', '1 year', 'long term', 'custom']

const COLORS  = ['teal', 'amber', 'purple']
const COLOR_HEX = { teal: '#1D9E75', amber: '#EF9F27', purple: '#7F77DD' }

const inputCls = 'w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border outline-none focus:border-primary text-text-pri placeholder:text-text-hint transition-colors'

function TimeframePicker({ endDate, onChange }) {
  const [selected, setSelected] = useState('3 months')

  function pick(preset) {
    setSelected(preset)
    if (preset !== 'custom') {
      const end = presetToEndDate(preset)
      onChange(end, endDateToHorizon(end))
    }
  }

  const displayEnd = endDate
    ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {PRESETS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => pick(p)}
            className="px-2.5 py-1 text-[10px] font-bold rounded transition-all"
            style={{
              background: selected === p ? '#1D9E75' : '#eefaf4',
              color:      selected === p ? '#fff'    : '#0F6E56',
              border:     selected === p ? '1.5px solid #085041' : '1.5px solid #d4f0e6',
              boxShadow:  selected === p ? '2px 2px 0 #085041' : 'none',
            }}
          >
            {p === 'long term' ? 'Long term' : p}
          </button>
        ))}
      </div>
      {selected === 'custom' && (
        <input
          type="date"
          value={endDate}
          onChange={e => onChange(e.target.value, endDateToHorizon(e.target.value))}
          className={inputCls}
          style={{ marginTop: 4 }}
        />
      )}
      {endDate && selected !== 'custom' && (
        <p className="text-[10px] text-text-muted mt-1">
          → Ends <strong>{displayEnd}</strong>
          {' '}({daysUntil(new Date(endDate))} days from today)
        </p>
      )}
    </div>
  )
}

const DEFAULT_FORM = { name: '', description: '', horizon: 'quarter', end_date: presetToEndDate('3 months'), status: 'not_started', color: 'teal', icon: 'bolt' }

export default function Epics({ awardXp }) {
  const [epics, setEpics]   = useState([])
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (window.electronAPI) load() }, [])

  async function load() {
    try {
      const rows = await window.electronAPI.db.query('SELECT * FROM epics ORDER BY updated_at DESC', [])
      setEpics(rows)
    } catch {}
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO epics (name, description, icon, color, horizon, end_date, status, progress) VALUES (?,?,?,?,?,?,?,0)`,
        [form.name.trim(), form.description.trim(), form.icon, form.color, form.horizon, form.end_date || null, form.status]
      )
      await awardXp(20)
      setAdding(false)
      setForm(DEFAULT_FORM)
      await load()
    } catch {} finally {
      setSaving(false)
    }
  }

  function closeModal() { setAdding(false); setForm(DEFAULT_FORM) }

  const visible = filter === 'all' ? epics : epics.filter(e => e.horizon === filter)
  const tabs = [{ key: 'all', label: 'All' }, ...HORIZONS.map(h => ({ key: h.value, label: h.label }))]

  return (
    <div className="page-enter max-w-[820px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark">My Epics</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Big goals that define your trajectory</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white game-btn"
          style={{ background: '#1D9E75', border: '2px solid #085041', boxShadow: '3px 3px 0 #085041', borderRadius: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Epic
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1 text-[11px] font-bold transition-colors game-btn ${
              filter === tab.key
                ? 'bg-primary text-white'
                : 'bg-teal-light text-teal-med hover:bg-teal-border'
            }`}
            style={{
              border: `2px solid ${filter === tab.key ? '#085041' : '#d4f0e6'}`,
              borderRadius: 4,
              boxShadow: `2px 2px 0 ${filter === tab.key ? '#085041' : 'rgba(8,80,65,0.12)'}`,
            }}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-text-hint self-center">
          {visible.length} epic{visible.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {visible.map((epic, i) => (
          <div key={epic.id} className="bounce-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <EpicCard epic={epic} />
          </div>
        ))}
        {visible.length === 0 && (
          <div className="col-span-2 py-16 flex flex-col items-center gap-3">
            <span className="text-[40px] select-none opacity-30">⚔️</span>
            <p className="text-[13px] text-text-hint">No epics in this horizon yet.</p>
            <button
              onClick={() => setAdding(true)}
              className="text-[12px] font-bold text-primary hover:text-teal-med transition-colors"
            >
              Create your first epic →
            </button>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal open={adding} onClose={closeModal} title="New Epic ⚔️">
        <div className="flex flex-col gap-4">
          <Field label="Name *">
            <input
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="e.g. Land finance internship Q3"
              className={inputCls}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="What does success look like?"
              className={inputCls + ' resize-none'}
            />
          </Field>
          <Field label="Timeframe">
            <TimeframePicker
              endDate={form.end_date}
              onChange={(end_date, horizon) => setForm(f => ({ ...f, end_date, horizon }))}
            />
          </Field>
          <Field label="Color">
            <div className="flex gap-3 items-center">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: COLOR_HEX[c],
                    border: form.color === c ? '3px solid #085041' : '3px solid transparent',
                    boxShadow: form.color === c ? '0 0 0 2px ' + COLOR_HEX[c] : 'none',
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                  title={c}
                />
              ))}
              <span className="text-[11px] text-text-muted ml-1 capitalize">{form.color}</span>
            </div>
          </Field>
        </div>

        <div
          className="mt-5 px-3 py-2 text-[11px] text-text-muted flex items-center gap-1.5"
          style={{ background: '#eefaf4', border: '1px solid #d4f0e6', borderRadius: 4 }}
        >
          <span>⭐</span> Creating an Epic awards <strong>+20 XP</strong>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={closeModal} className="px-4 py-2 text-[12px] font-bold text-text-muted hover:text-teal-dark transition-colors">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="px-5 py-2 text-[12px] font-bold text-white game-btn disabled:opacity-40"
            style={{ background: '#1D9E75', border: '2px solid #085041', boxShadow: '3px 3px 0 #085041', borderRadius: 4 }}
          >
            {saving ? 'Saving…' : 'Create Epic'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
