import React from 'react'

const COLOR_MAP = {
  teal:   'bg-primary',
  amber:  'bg-amber',
  purple: 'bg-purple',
}

export default function ProgressBar({ value = 0, color = 'teal', className = '' }) {
  const barColor = COLOR_MAP[color] || 'bg-primary'
  return (
    <div className={`w-full h-2 bg-teal-light rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full progress-fill ${barColor}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
