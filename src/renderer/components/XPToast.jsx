import React, { useEffect, useState } from 'react'

export default function XPToast({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-28 right-20 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDone={() => onRemove(t.id)} />)}
    </div>
  )
}

function ToastItem({ toast, onDone }) {
  const [phase, setPhase] = useState('idle')

  useEffect(() => {
    // idle → enter on next frame so CSS transition has a start state to animate from
    const raf = requestAnimationFrame(() => setPhase('enter'))
    const t1  = setTimeout(() => setPhase('exit'), 1700)
    const t2  = setTimeout(() => onDone(), 2000)
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const COLOR = {
    xp:     'bg-primary text-white',
    streak: 'bg-amber text-white',
    level:  'bg-purple text-white',
  }[toast.type] || 'bg-primary text-white'

  const STYLES = {
    idle:  { opacity: 0, transform: 'scale(0.6) translateY(10px)' },
    enter: { opacity: 1, transform: 'scale(1) translateY(0)' },
    exit:  { opacity: 0, transform: 'scale(0.85) translateY(-8px)' },
  }

  return (
    <div
      className={`px-3 py-1.5 rounded-full text-[12px] font-extrabold shadow-lg ${COLOR}`}
      style={{
        transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        transformOrigin: 'center bottom',
        ...STYLES[phase],
      }}
    >
      {toast.text}
    </div>
  )
}
