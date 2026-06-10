import React, { useEffect, useState } from 'react'

export default function XPToast({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-28 right-20 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDone={() => onRemove(t.id)} />)}
    </div>
  )
}

function ToastItem({ toast, onDone }) {
  const [phase, setPhase] = useState('enter')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('exit'), 800)
    const t2 = setTimeout(() => onDone(), 1100)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const COLOR = {
    xp:     'bg-primary text-white',
    streak: 'bg-amber text-white',
    level:  'bg-purple text-white',
  }[toast.type] || 'bg-primary text-white'

  return (
    <div
      className={`px-3 py-1.5 rounded-full text-[12px] font-extrabold shadow-lg ${COLOR} transition-all duration-300 ${
        phase === 'enter' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
      style={{ transform: phase === 'enter' ? 'translateY(0)' : 'translateY(-16px)' }}
    >
      {toast.text}
    </div>
  )
}
