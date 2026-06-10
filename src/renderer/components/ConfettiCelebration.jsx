import React, { useEffect } from 'react'

export default function ConfettiCelebration({ trigger }) {
  useEffect(() => {
    if (!trigger) return
    let confetti
    import('canvas-confetti').then(mod => {
      confetti = mod.default
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#1D9E75', '#EF9F27', '#7F77DD', '#085041', '#E1F5EE'],
      })
    })
  }, [trigger])

  return null
}
