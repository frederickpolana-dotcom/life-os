import React, { useState } from 'react'

const STATUS_CYCLE = { not_started: 'in_progress', in_progress: 'done', done: 'not_started' }
const STATUS_COLOR = {
  not_started: 'border-text-hint',
  in_progress: 'border-primary bg-teal-light/50',
  done:        'border-green-done bg-green-done/10',
}

export default function SubTaskItem({ task, onStatusChange, onDelete }) {
  const [animating, setAnimating] = useState(false)

  async function toggle() {
    const next = STATUS_CYCLE[task.status] || 'not_started'
    setAnimating(true)
    setTimeout(() => setAnimating(false), 200)
    await onStatusChange(task.id, next)
  }

  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-sm border ${STATUS_COLOR[task.status]} transition-colors group`}>
      {/* Toggle button */}
      <button
        onClick={toggle}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          task.status === 'done'
            ? 'bg-green-done border-green-done check-animate'
            : task.status === 'in_progress'
            ? 'border-primary'
            : 'border-text-hint'
        } ${animating ? 'check-animate' : ''}`}
      >
        {task.status === 'done' && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {task.status === 'in_progress' && (
          <div className="w-2 h-2 rounded-full bg-primary" />
        )}
      </button>

      <span className={`flex-1 text-[12px] font-medium ${
        task.status === 'done' ? 'line-through text-text-muted' : 'text-text-pri'
      }`}>
        {task.title}
      </span>

      {onDelete && (
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-text-hint hover:text-red-500 transition-all p-0.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}
