import React from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from './ProgressBar'
import StatusPill from './StatusPill'
import { getHorizonDeadline, getQuarterLabel, daysUntil, fmtDate, deadlineColor } from '../utils/dates'

function DeadlineBadge({ horizon, endDate }) {
  if (horizon === 'done') return null
  const deadline = getHorizonDeadline(horizon, endDate)
  if (!deadline) return null
  const days  = daysUntil(deadline)
  const color = deadlineColor(days)

  let label = ''
  if (horizon === 'quarter') label = getQuarterLabel(deadline)
  else if (horizon === 'year') label = `${deadline.getFullYear()}`
  else label = 'Long Term'

  const daysLabel = days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0
    ? 'due today'
    : `${days}d left`

  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: color + '18', color }}>
        {label}
      </span>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: color + '18', color }}>
        {fmtDate(deadline)} · {daysLabel}
      </span>
    </div>
  )
}

export default function EpicCard({ epic }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(`/epics/${epic.id}`)}
      className="bg-white p-5 cursor-pointer group retro-card"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-teal-dark truncate group-hover:text-primary transition-colors">{epic.name}</p>
          {epic.description && (
            <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">{epic.description}</p>
          )}
        </div>
        <StatusPill status={epic.status} />
      </div>

      <ProgressBar value={epic.progress} color={epic.color} className="mb-2" />

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold text-primary">{epic.progress}%</span>
      </div>

      {epic.status !== 'done' && <DeadlineBadge horizon={epic.horizon} endDate={epic.end_date} />}
      {epic.status === 'done' && (
        <span className="text-[10px] font-bold text-green-done mt-1.5 inline-block">🏆 Completed</span>
      )}
    </div>
  )
}
