import React from 'react'

const COLOR_MAP = {
  teal:   'bg-primary',
  amber:  'bg-amber',
  purple: 'bg-purple',
}

export default function ProgressBar({ value = 0, color = 'teal', className = '' }) {
  const barColor = COLOR_MAP[color] || 'bg-primary'
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={`w-full ${className}`}>
      <div className="w-full h-2 bg-teal-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full progress-fill ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct === 0 && (
        <span className="text-[10px] font-bold text-text-hint mt-0.5 block">0%</span>
      )}
    </div>
  )
}
