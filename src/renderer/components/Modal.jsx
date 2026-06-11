import React, { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, width = 480 }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative bg-white flex flex-col max-h-[90vh] pop-in"
        style={{ width, border: '2px solid #1D9E75', boxShadow: '5px 5px 0 #085041', borderRadius: 4 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-teal-border">
          <h2 className="text-[15px] font-extrabold text-teal-dark">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-sec transition-colors p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
