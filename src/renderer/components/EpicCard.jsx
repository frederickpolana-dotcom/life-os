import React from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from './ProgressBar'
import StatusPill from './StatusPill'

const HORIZON_LABELS = { quarter: 'This Quarter', year: 'This Year', longterm: 'Long Term' }

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
        <span className="text-[11px] text-text-hint font-medium">{HORIZON_LABELS[epic.horizon] || epic.horizon}</span>
        <span className="text-[11px] font-extrabold text-primary">{epic.progress}%</span>
      </div>
    </div>
  )
}
