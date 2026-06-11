import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SubTaskItem from '../components/SubTaskItem'
import ProgressBar from '../components/ProgressBar'
import StatusPill from '../components/StatusPill'
import Modal from '../components/Modal'
import ConfettiCelebration from '../components/ConfettiCelebration'
import { getHorizonDeadline, getQuarterLabel, daysUntil, fmtDate, fmtDateFull, deadlineColor, presetToEndDate, endDateToHorizon } from '../utils/dates'

const HORIZONS = [
  { value: 'quarter',  label: 'This Quarter' },
  { value: 'year',     label: 'This Year'    },
  { value: 'longterm', label: 'Long Term'    },
]
const STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done'        },
]
const COLORS    = ['teal', 'amber', 'purple']
const COLOR_HEX = { teal: '#1D9E75', amber: '#EF9F27', purple: '#7F77DD' }

const RETRO_CARD_CLASS = { teal: 'retro-card', amber: 'retro-card-amber', purple: 'retro-card-purple' }
const RETRO_BORDER = {
  teal:   { border: '#1D9E75', shadow: '#085041', bg: '#eefaf4', text: '#085041' },
  amber:  { border: '#EF9F27', shadow: '#a65c00', bg: '#fff8ec', text: '#7a4800' },
  purple: { border: '#7F77DD', shadow: '#3d3a9e', bg: '#f5f4ff', text: '#3d3a9e' },
}

export default function EpicDetail({ awardXp }) {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const [epic, setEpic]         = useState(null)
  const [tasks, setTasks]       = useState([])
  const [addingTask, setAddingTask] = useState(false)
  const [newTitle, setNewTitle]   = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState({})
  const [confetti, setConfetti] = useState(0)

  useEffect(() => { if (window.electronAPI) load() }, [id])

  async function load() {
    try {
      const [epicRow, taskRows] = await Promise.all([
        window.electronAPI.db.get('SELECT * FROM epics WHERE id = ?', [id]),
        window.electronAPI.db.query('SELECT * FROM subtasks WHERE epic_id = ? AND parent_id IS NULL ORDER BY id', [id]),
      ])
      setEpic(epicRow)
      setTasks(taskRows)
    } catch {}
  }

  async function addTask() {
    const title = newTitle.trim()
    if (!title) return
    await window.electronAPI.db.run(
      'INSERT INTO subtasks (epic_id, title, status, due_date) VALUES (?, ?, ?, ?)',
      [id, title, 'not_started', newDueDate || null]
    )
    setNewTitle('')
    setNewDueDate('')
    setAddingTask(false)
    await load()
    await recalcProgress()
  }

  async function changeStatus(taskId, nextStatus) {
    const sql = nextStatus === 'done'
      ? 'UPDATE subtasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE subtasks SET status = ?, completed_at = NULL WHERE id = ?'
    await window.electronAPI.db.run(sql, [nextStatus, taskId])
    if (nextStatus === 'done') {
      const result = await awardXp(15)
      if (result?.levelUp) setConfetti(c => c + 1)
    }
    await load()
    await recalcProgress()
  }

  async function deleteTask(taskId) {
    await window.electronAPI.db.run('DELETE FROM subtasks WHERE id = ?', [taskId])
    await load()
    await recalcProgress()
  }

  async function recalcProgress() {
    const rows = await window.electronAPI.db.query(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done FROM subtasks WHERE epic_id = ? AND parent_id IS NULL",
      [id]
    )
    const row = rows[0]
    const pct = row?.total > 0 ? Math.round((row.done / row.total) * 100) : 0
    await window.electronAPI.db.run(
      'UPDATE epics SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [pct, id]
    )
    setEpic(e => e ? { ...e, progress: pct } : e)
  }

  function openEdit() {
    setEditForm({ name: epic.name, description: epic.description || '', status: epic.status, horizon: epic.horizon, color: epic.color, end_date: epic.end_date || '' })
    setEditing(true)
  }

  async function saveEdit() {
    if (!editForm.name.trim()) return
    try {
      await window.electronAPI.db.run(
        'UPDATE epics SET name = ?, description = ?, status = ?, horizon = ?, color = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [editForm.name.trim(), editForm.description.trim(), editForm.status, editForm.horizon, editForm.color, editForm.end_date || null, id]
      )
    } catch {
      // end_date column may not exist yet — save without it
      await window.electronAPI.db.run(
        'UPDATE epics SET name = ?, description = ?, status = ?, horizon = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [editForm.name.trim(), editForm.description.trim(), editForm.status, editForm.horizon, editForm.color, id]
      )
    }
    setEditing(false)
    await load()
  }

  async function markComplete() {
    if (epic.status === 'done') return
    await window.electronAPI.db.run(
      "UPDATE epics SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    )
    const result = await awardXp(50)
    setConfetti(c => c + 1)
    if (result?.levelUp) setConfetti(c => c + 1)
    await load()
  }

  async function deleteEpic() {
    if (!window.confirm(`Delete "${epic.name}"? This will also delete all its tasks.`)) return
    await window.electronAPI.db.run('DELETE FROM epics WHERE id = ?', [id])
    navigate('/epics')
  }

  if (!epic) return <div className="text-text-muted text-[13px] p-8">Loading…</div>

  const done  = tasks.filter(t => t.status === 'done').length
  const total = tasks.length
  const color = epic.color || 'teal'
  const C     = RETRO_BORDER[color] || RETRO_BORDER.teal

  return (
    <div className="page-enter max-w-[700px]">
      <ConfettiCelebration trigger={confetti} />

      {/* Back */}
      <button
        onClick={() => navigate('/epics')}
        className="flex items-center gap-1 text-[11px] font-bold text-text-muted hover:text-teal-dark mb-5 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Epics
      </button>

      {/* Epic header — retro card with dynamic color */}
      <div
        className={`p-6 mb-6 ${RETRO_CARD_CLASS[color] || 'retro-card'}`}
        style={{ background: C.bg }}
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="text-[18px] font-extrabold leading-tight" style={{ color: C.text }}>{epic.name}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusPill status={epic.status} />
            {/* Edit */}
            <button
              onClick={openEdit}
              className="p-1.5 rounded transition-colors hover:bg-black/5"
              title="Edit epic"
              style={{ color: C.text, opacity: 0.6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            {/* Delete */}
            <button
              onClick={deleteEpic}
              className="p-1.5 rounded transition-colors hover:bg-red-50"
              title="Delete epic"
              style={{ color: '#b91c1c', opacity: 0.55 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        </div>

        {epic.description && (
          <p className="text-[12px] leading-relaxed mb-4" style={{ color: C.text, opacity: 0.7 }}>{epic.description}</p>
        )}

        <ProgressBar value={epic.progress} color={color} className="mb-2" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px]" style={{ color: C.text, opacity: 0.6 }}>{done}/{total} tasks</span>
          <span className="text-[12px] font-extrabold" style={{ color: C.text }}>{epic.progress}%</span>
        </div>

        {/* Deadline row */}
        {epic.status !== 'done' && (() => {
          const deadline = getHorizonDeadline(epic.horizon, epic.end_date)
          if (!deadline) return null
          const days  = daysUntil(deadline)
          const color = deadlineColor(days)
          let rangeLabel = ''
          if (epic.horizon === 'quarter') {
            const qEnd = getQuarterLabel(deadline)
            const qStart = new Date(deadline.getFullYear(), Math.floor(deadline.getMonth() / 3) * 3, 1)
            rangeLabel = `${qEnd}  ·  ${fmtDate(qStart)} → ${fmtDate(deadline)}`
          } else if (epic.horizon === 'year') {
            rangeLabel = `${deadline.getFullYear()}  ·  Jan 1 → Dec 31`
          } else {
            rangeLabel = `Long Term  ·  target ${fmtDateFull(deadline)}`
          }
          const daysLabel = days < 0 ? `${Math.abs(days)} days overdue!` : days === 0 ? 'Due today!' : `${days} days remaining`
          return (
            <div className="flex items-center gap-3 flex-wrap mt-1 pt-2" style={{ borderTop: `1px solid ${color}30` }}>
              <span className="text-[10px] font-bold" style={{ color: C.text, opacity: 0.5 }}>{rangeLabel}</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: color + '1a', color }}>
                ⏱ {daysLabel}
              </span>
            </div>
          )
        })()}

        {/* Mark complete button */}
        {epic.status !== 'done' && (
          <button
            onClick={markComplete}
            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white game-btn"
            style={{ background: C.border, border: `2px solid ${C.shadow}`, boxShadow: `3px 3px 0 ${C.shadow}`, borderRadius: 4 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Mark Epic Complete (+50 XP)
          </button>
        )}
        {epic.status === 'done' && (
          <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: C.text }}>
            <span>🏆</span> Epic completed!
          </div>
        )}
      </div>

      {/* Tasks section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-extrabold text-teal-dark">Tasks</h2>
        <button
          onClick={() => setAddingTask(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold game-btn"
          style={{
            color: '#1D9E75',
            background: '#eefaf4',
            border: '2px solid #b3e8d3',
            boxShadow: '2px 2px 0 rgba(8,80,65,0.15)',
            borderRadius: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add task
        </button>
      </div>

      {/* XP hint */}
      {tasks.length > 0 && (
        <p className="text-[10px] text-text-hint mb-2">Click a task's circle to cycle status · completing awards +15 XP</p>
      )}

      <div className="flex flex-col gap-1.5">
        {tasks.map(task => (
          <SubTaskItem
            key={task.id}
            task={task}
            onStatusChange={changeStatus}
            onDelete={deleteTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="py-10 flex flex-col items-center gap-2">
            <span className="text-[32px] select-none opacity-25">📋</span>
            <p className="text-[12px] text-text-hint">No tasks yet. Break this epic into steps!</p>
          </div>
        )}
      </div>

      {/* Add task modal */}
      <Modal open={addingTask} onClose={() => { setAddingTask(false); setNewTitle(''); setNewDueDate('') }} title="Add Task" width={420}>
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Task title…"
            className="w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border outline-none focus:border-primary text-text-pri placeholder:text-text-hint"
            style={{ borderRadius: 4 }}
          />
          <div>
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Due Date <span className="font-normal normal-case">(optional)</span></label>
            <input
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className="w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border outline-none focus:border-primary text-text-pri"
              style={{ borderRadius: 4 }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => { setAddingTask(false); setNewTitle(''); setNewDueDate('') }}
            className="px-4 py-2 text-[12px] font-bold text-text-muted hover:text-teal-dark transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={addTask}
            disabled={!newTitle.trim()}
            className="px-4 py-2 text-[12px] font-bold text-white game-btn disabled:opacity-40"
            style={{ background: '#1D9E75', border: '2px solid #085041', boxShadow: '3px 3px 0 #085041', borderRadius: 4 }}
          >
            Add Task
          </button>
        </div>
      </Modal>

      {/* Edit epic modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Epic">
        <div className="flex flex-col gap-4">
          <Field label="Name *">
            <input
              autoFocus
              value={editForm.name || ''}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={editForm.description || ''}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="What does success look like?"
              className={inputCls + ' resize-none'}
            />
          </Field>
          <Field label="Timeframe">
            <TimeframePicker
              endDate={editForm.end_date || ''}
              onChange={(end_date, horizon) => setEditForm(f => ({ ...f, end_date, horizon }))}
            />
          </Field>
          <Field label="Status">
            <select value={editForm.status || 'not_started'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Color">
            <div className="flex gap-3 items-center">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setEditForm(f => ({ ...f, color: c }))}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: COLOR_HEX[c],
                    border: editForm.color === c ? '3px solid #085041' : '3px solid transparent',
                    boxShadow: editForm.color === c ? '0 0 0 2px ' + COLOR_HEX[c] : 'none',
                    transform: editForm.color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                  title={c}
                />
              ))}
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setEditing(false)} className="px-4 py-2 text-[12px] font-bold text-text-muted hover:text-teal-dark transition-colors">
            Cancel
          </button>
          <button
            onClick={saveEdit}
            disabled={!editForm.name?.trim()}
            className="px-5 py-2 text-[12px] font-bold text-white game-btn disabled:opacity-40"
            style={{ background: '#1D9E75', border: '2px solid #085041', boxShadow: '3px 3px 0 #085041', borderRadius: 4 }}
          >
            Save Changes
          </button>
        </div>
      </Modal>
    </div>
  )
}

const PRESETS = ['2 weeks', '1 month', '2 months', '3 months', '6 months', '1 year', 'long term', 'custom']

function TimeframePicker({ endDate, onChange }) {
  const [selected, setSelected] = React.useState(() => {
    if (!endDate) return '3 months'
    // Try to match existing end_date to a preset
    const today = Date.now()
    const diff = Math.round((new Date(endDate) - today) / 86400000)
    if (diff >= 13 && diff <= 15) return '2 weeks'
    if (diff >= 28 && diff <= 32) return '1 month'
    if (diff >= 58 && diff <= 62) return '2 months'
    if (diff >= 88 && diff <= 92) return '3 months'
    if (diff >= 180 && diff <= 184) return '6 months'
    if (diff >= 363 && diff <= 367) return '1 year'
    if (diff > 700) return 'long term'
    return 'custom'
  })

  function pick(preset) {
    setSelected(preset)
    if (preset !== 'custom') {
      const end = presetToEndDate(preset)
      onChange(end, endDateToHorizon(end))
    }
  }

  const displayEnd = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

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

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 text-[12px] bg-teal-pale border border-teal-border outline-none focus:border-primary text-text-pri placeholder:text-text-hint transition-colors'
