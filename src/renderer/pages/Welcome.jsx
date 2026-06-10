import React, { useState, useEffect, useRef } from 'react'

const C = {
  bg:         '#061710',
  primary:    '#1D9E75',
  tealDark:   '#085041',
  amber:      '#EF9F27',
  amberDark:  '#a65c00',
  content:    '#f4fdf8',
  muted:      '#4a7060',
  hint:       '#9bbdaa',
}

function PixelAvatar({ initials, size = 72 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 4,
      background: `${C.primary}22`,
      border: `3px solid ${C.primary}`,
      boxShadow: `3px 3px 0 ${C.tealDark}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 900, color: C.primary,
      fontFamily: 'Nunito, sans-serif',
      userSelect: 'none',
    }}>
      {initials || '??'}
    </div>
  )
}

// ── Step 0: Splash ────────────────────────────────────────────────────────────
function StepSplash({ onNext }) {
  const [blink, setBlink] = useState(true)
  const [stars] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      delay: Math.random() * 3,
      dur: Math.random() * 2 + 1.5,
    }))
  )

  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 600)
    return () => clearInterval(t)
  }, [])

  return (
    <div
      onClick={onNext}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute',
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: '50%',
          background: C.primary,
          animation: `starTwinkle ${s.dur}s ${s.delay}s infinite ease-in-out`,
        }} />
      ))}

      <div style={{
        background: `${C.primary}14`,
        border: `3px solid ${C.primary}`,
        boxShadow: `0 0 40px ${C.primary}44, 6px 6px 0 ${C.tealDark}`,
        borderRadius: 8,
        padding: '44px 72px',
        textAlign: 'center',
        position: 'relative',
      }}>
        {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy], i) => (
          <div key={i} style={{
            position: 'absolute',
            width: 8, height: 8, background: C.primary,
            top: dy < 0 ? -4 : 'auto', bottom: dy > 0 ? -4 : 'auto',
            left: dx < 0 ? -4 : 'auto', right: dx > 0 ? -4 : 'auto',
          }} />
        ))}

        <div style={{
          fontSize: 64, fontWeight: 900, letterSpacing: 6,
          color: C.content,
          textShadow: `0 0 20px ${C.primary}, 0 0 40px ${C.primary}66, 4px 4px 0 ${C.tealDark}`,
          lineHeight: 1,
        }}>
          LIFE OS
        </div>

        <div style={{
          fontSize: 12, letterSpacing: 8, marginTop: 14,
          color: C.hint, fontWeight: 700, textTransform: 'uppercase',
        }}>
          YOUR LIFE. GAMIFIED.
        </div>

        <div style={{
          marginTop: 44, fontSize: 13, letterSpacing: 4,
          color: blink ? C.amber : 'transparent',
          fontWeight: 900,
          textShadow: blink ? `0 0 12px ${C.amber}` : 'none',
          transition: 'color 0.08s',
        }}>
          ▶ PRESS START
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 10, color: C.muted, letterSpacing: 2 }}>
        CLICK ANYWHERE TO CONTINUE
      </div>
    </div>
  )
}

// ── Step 1: Name entry ────────────────────────────────────────────────────────
function StepNameEntry({ name, initials, onNameChange, onConfirm }) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const canConfirm = name.trim().length > 0

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [])

  function handleKey(e) {
    if (e.key === 'Enter' && canConfirm) onConfirm()
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 40px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: C.hint, marginBottom: 10 }}>
          PLAYER SETUP
        </div>
        <div style={{
          fontSize: 28, fontWeight: 900, color: C.content,
          textShadow: `3px 3px 0 ${C.tealDark}`, letterSpacing: 2,
        }}>
          WHAT'S YOUR NAME?
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: `2px solid ${C.primary}`,
        boxShadow: `6px 6px 0 ${C.tealDark}`,
        borderRadius: 8,
        padding: '40px 48px',
        width: 400,
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <PixelAvatar initials={initials || '??'} size={72} />
        </div>

        <div style={{
          fontSize: 10, letterSpacing: 4, color: C.hint,
          fontWeight: 700, marginBottom: 10, textAlign: 'left',
        }}>
          YOUR NAME
        </div>

        <input
          ref={inputRef}
          value={name}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="e.g. Frederick"
          maxLength={32}
          style={{
            width: '100%',
            background: 'rgba(0,0,0,0.35)',
            border: `2px solid ${focused ? C.primary : 'rgba(255,255,255,0.12)'}`,
            boxShadow: focused ? `0 0 14px ${C.primary}44` : 'none',
            borderRadius: 4,
            padding: '14px 16px',
            fontSize: 22, fontWeight: 900,
            color: C.content,
            fontFamily: 'Nunito, sans-serif',
            outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            marginBottom: 20,
            caretColor: C.primary,
          }}
        />

        {initials && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginBottom: 28,
            fontSize: 11, color: C.hint, letterSpacing: 2,
          }}>
            <span>INITIALS:</span>
            <span style={{
              background: `${C.primary}22`, border: `1px solid ${C.primary}`,
              borderRadius: 2, padding: '2px 12px',
              color: C.primary, fontWeight: 900, fontSize: 13,
            }}>
              {initials}
            </span>
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          style={{
            width: '100%',
            background: canConfirm ? C.primary : 'rgba(255,255,255,0.06)',
            color: canConfirm ? C.tealDark : C.muted,
            border: `2px solid ${canConfirm ? C.primary : 'rgba(255,255,255,0.1)'}`,
            boxShadow: canConfirm ? `4px 4px 0 ${C.tealDark}` : '2px 2px 0 rgba(0,0,0,0.3)',
            padding: '14px',
            fontSize: 14, fontWeight: 900, letterSpacing: 3,
            borderRadius: 4, cursor: canConfirm ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          BEGIN JOURNEY →
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Ready ─────────────────────────────────────────────────────────────
function StepReady({ name, initials }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 450)
    const t2 = setTimeout(() => setPhase(2), 950)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const lines = ['SAVING PROFILE...', 'LOADING WORLD...', 'PLAYER 1 READY!']

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 28,
    }}>
      <PixelAvatar initials={initials || '??'} size={88} />

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: C.hint, marginBottom: 10 }}>
          WELCOME
        </div>
        <div style={{
          fontSize: 36, fontWeight: 900, color: C.content,
          textShadow: `4px 4px 0 ${C.tealDark}, 0 0 24px ${C.primary}66`,
          letterSpacing: 2,
        }}>
          {name.toUpperCase()}
        </div>
      </div>

      <div style={{
        fontSize: phase === 2 ? 18 : 13,
        fontWeight: 900, letterSpacing: 4,
        color: phase === 2 ? C.primary : C.hint,
        textShadow: phase === 2 ? `0 0 16px ${C.primary}` : 'none',
        transition: 'all 0.35s',
      }}>
        {lines[phase]}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Welcome({ onComplete }) {
  const [step, setStep]         = useState(0)
  const [name, setName]         = useState('')
  const [initials, setInitials] = useState('')

  useEffect(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      setInitials((parts[0][0] + parts[parts.length - 1][0]).toUpperCase())
    } else if (parts.length === 1 && parts[0].length >= 2) {
      setInitials(parts[0].slice(0, 2).toUpperCase())
    } else if (parts.length === 1) {
      setInitials((parts[0][0] || '').toUpperCase())
    } else {
      setInitials('')
    }
  }, [name])

  async function handleConfirm() {
    setStep(2)
    try {
      await Promise.all([
        window.electronAPI.settings.set('user_name', name.trim() || 'Player'),
        window.electronAPI.settings.set('user_initials', initials || 'ME'),
        window.electronAPI.settings.set('onboarding_complete', 'true'),
      ])
    } catch (e) {
      console.error('Welcome save error:', e)
    }
    setTimeout(onComplete, 2000)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Nunito, sans-serif',
      color: C.content,
      zIndex: 9999,
      overflow: 'hidden',
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`,
      }} />
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `radial-gradient(circle, ${C.primary}10 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
      }} />

      {/* Top accent bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.tealDark}, ${C.primary}, ${C.tealDark})`, flexShrink: 0 }} />

      {/* Step dots (only on name step) */}
      {step === 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px', zIndex: 2 }}>
          <div style={{ width: 32, height: 5, borderRadius: 2, background: C.primary }} />
          <div style={{ width: 32, height: 5, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
        {step === 0 && <StepSplash onNext={() => setStep(1)} />}
        {step === 1 && (
          <StepNameEntry
            name={name}
            initials={initials}
            onNameChange={setName}
            onConfirm={handleConfirm}
          />
        )}
        {step === 2 && <StepReady name={name || 'Player'} initials={initials} />}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 24px',
        display: 'flex', justifyContent: 'space-between',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        zIndex: 2, flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>LIFE OS v1.0</span>
        <span style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>
          {step === 0 ? 'WELCOME' : step === 1 ? 'PLAYER SETUP' : 'LOADING...'}
        </span>
      </div>

      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50% { opacity: 0.9; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
