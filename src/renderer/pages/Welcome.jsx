import React, { useState, useEffect, useRef } from 'react'

const C = {
  bg:        '#061710',
  primary:   '#1D9E75',
  tealDark:  '#085041',
  amber:     '#EF9F27',
  amberDark: '#a65c00',
  content:   '#f4fdf8',
  muted:     '#4a7060',
  hint:      '#9bbdaa',
  purple:    '#7F77DD',
}

// ── Shared primitives ─────────────────────────────────────────────────────────

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

function RetroInput({ autoFocus, value, onChange, onKeyDown, placeholder, maxLength, type = 'text', min }) {
  const ref = useRef(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 150)
      return () => clearTimeout(t)
    }
  }, [autoFocus])

  return (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      maxLength={maxLength}
      min={min}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.35)',
        border: `2px solid ${focused ? C.primary : 'rgba(255,255,255,0.12)'}`,
        boxShadow: focused ? `0 0 14px ${C.primary}44` : 'none',
        borderRadius: 4, padding: '12px 14px',
        fontSize: type === 'text' ? 18 : 14,
        fontWeight: 700, color: C.content,
        fontFamily: 'Nunito, sans-serif', outline: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        caretColor: C.primary,
        colorScheme: 'dark',
      }}
    />
  )
}

function NavButton({ onClick, disabled, primary, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: primary ? 1 : 0,
        background: disabled ? 'rgba(255,255,255,0.06)'
          : primary ? C.primary : 'transparent',
        color: disabled ? C.muted
          : primary ? C.tealDark : C.hint,
        border: `2px solid ${disabled ? 'rgba(255,255,255,0.1)'
          : primary ? C.primary : 'rgba(255,255,255,0.15)'}`,
        boxShadow: disabled ? '2px 2px 0 rgba(0,0,0,0.3)'
          : primary ? `4px 4px 0 ${C.tealDark}` : 'none',
        padding: primary ? '14px' : '14px 20px',
        fontSize: 13, fontWeight: 900, letterSpacing: 3,
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'Nunito, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function Card({ children, width = 440 }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `2px solid ${C.primary}`,
      boxShadow: `6px 6px 0 ${C.tealDark}`,
      borderRadius: 8, padding: '40px 48px',
      width, boxSizing: 'border-box',
    }}>
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: 4, color: C.hint,
      fontWeight: 700, marginBottom: 10, textTransform: 'uppercase',
    }}>
      {children}
    </div>
  )
}

function StepHeader({ step, label, sub }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 36 }}>
      <div style={{ fontSize: 9, letterSpacing: 6, color: C.hint, marginBottom: 10 }}>
        STEP {step} OF 4
      </div>
      <div style={{
        fontSize: 24, fontWeight: 900, color: C.content,
        textShadow: `3px 3px 0 ${C.tealDark}`, letterSpacing: 2,
      }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: C.hint, marginTop: 8, letterSpacing: 1 }}>{sub}</div>
      )}
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
          width: s.size, height: s.size, borderRadius: '50%',
          background: C.primary,
          animation: `starTwinkle ${s.dur}s ${s.delay}s infinite ease-in-out`,
        }} />
      ))}

      <div style={{
        background: `${C.primary}14`,
        border: `3px solid ${C.primary}`,
        boxShadow: `0 0 40px ${C.primary}44, 6px 6px 0 ${C.tealDark}`,
        borderRadius: 8, padding: '44px 72px',
        textAlign: 'center', position: 'relative',
      }}>
        {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy], i) => (
          <div key={i} style={{
            position: 'absolute', width: 8, height: 8, background: C.primary,
            top: dy < 0 ? -4 : 'auto', bottom: dy > 0 ? -4 : 'auto',
            left: dx < 0 ? -4 : 'auto', right: dx > 0 ? -4 : 'auto',
          }} />
        ))}

        <div style={{
          fontSize: 64, fontWeight: 900, letterSpacing: 6, color: C.content,
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

// ── Step 1: Name ──────────────────────────────────────────────────────────────

function StepName({ name, initials, onNameChange, onNext }) {
  const canNext = name.trim().length > 0

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 40px',
    }}>
      <StepHeader step={1} label="WHAT'S YOUR NAME?" sub="This is how Life OS will address you." />

      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <PixelAvatar initials={initials || '??'} size={72} />
        </div>

        <FieldLabel>Your name</FieldLabel>
        <div style={{ marginBottom: 28 }}>
          <RetroInput
            autoFocus
            value={name}
            onChange={e => onNameChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canNext && onNext()}
            placeholder="e.g. Frederick"
            maxLength={32}
          />
          {initials && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: 10, fontSize: 10, color: C.hint, letterSpacing: 2,
            }}>
              <span>INITIALS:</span>
              <span style={{
                background: `${C.primary}22`, border: `1px solid ${C.primary}`,
                borderRadius: 2, padding: '2px 10px',
                color: C.primary, fontWeight: 900, fontSize: 12,
              }}>
                {initials}
              </span>
            </div>
          )}
        </div>

        <NavButton primary onClick={onNext} disabled={!canNext}>
          NEXT →
        </NavButton>
      </Card>
    </div>
  )
}

// ── Step 2: Epic ──────────────────────────────────────────────────────────────

function StepEpic({ epicName, epicDeadline, onEpicNameChange, onDeadlineChange, onNext, onBack }) {
  const canNext = epicName.trim().length > 0
  const today   = new Date().toISOString().slice(0, 10)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 40px',
    }}>
      <StepHeader
        step={2}
        label="YOUR BIGGEST GOAL"
        sub="What are you working toward this quarter?"
      />

      <Card>
        <FieldLabel>Goal name</FieldLabel>
        <div style={{ marginBottom: 24 }}>
          <RetroInput
            autoFocus
            value={epicName}
            onChange={e => onEpicNameChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canNext && onNext()}
            placeholder="e.g. Land my first internship"
            maxLength={80}
          />
        </div>

        <FieldLabel>
          Target deadline&nbsp;
          <span style={{ color: C.muted, fontSize: 9, letterSpacing: 1 }}>(optional)</span>
        </FieldLabel>
        <div style={{ marginBottom: 28 }}>
          <RetroInput
            type="date"
            value={epicDeadline}
            onChange={e => onDeadlineChange(e.target.value)}
            min={today}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <NavButton onClick={onBack}>← BACK</NavButton>
          <NavButton primary onClick={onNext} disabled={!canNext}>NEXT →</NavButton>
        </div>
      </Card>
    </div>
  )
}

// ── Step 3: Streak ────────────────────────────────────────────────────────────

const HABIT_EXAMPLES = ['Mandarin study', 'Morning run', 'Cold outreach', 'Gym session', 'Deep work block']

function StepStreak({ habitName, onHabitNameChange, onNext, onBack }) {
  const canNext = habitName.trim().length > 0

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 40px',
    }}>
      <StepHeader
        step={3}
        label="YOUR FIRST HABIT"
        sub="Pick one daily habit to build a streak from day one."
      />

      <Card>
        <FieldLabel>Habit name</FieldLabel>
        <div style={{ marginBottom: 16 }}>
          <RetroInput
            autoFocus
            value={habitName}
            onChange={e => onHabitNameChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canNext && onNext()}
            placeholder="e.g. Morning run"
            maxLength={60}
          />
        </div>

        {/* Quick-fill chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
          {HABIT_EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => onHabitNameChange(ex)}
              style={{
                background: habitName === ex ? `${C.primary}28` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${habitName === ex ? C.primary : 'rgba(255,255,255,0.12)'}`,
                color: habitName === ex ? C.primary : C.hint,
                borderRadius: 3, padding: '4px 10px',
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                cursor: 'pointer', fontFamily: 'Nunito, sans-serif',
                transition: 'all 0.1s',
              }}
            >
              {ex}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <NavButton onClick={onBack}>← BACK</NavButton>
          <NavButton primary onClick={onNext} disabled={!canNext}>NEXT →</NavButton>
        </div>
      </Card>
    </div>
  )
}

// ── Step 4: XP intro ──────────────────────────────────────────────────────────

const XP_TABLE = [
  { icon: '✅', label: 'Complete a task',   xp: 15 },
  { icon: '🔥', label: 'Log a streak',       xp: 10 },
  { icon: '🎯', label: 'Create an epic',     xp: 20 },
  { icon: '📝', label: 'Submit a review',    xp: 25 },
  { icon: '⚡', label: 'Log daily energy',   xp:  5 },
]

const LEVELS = [1, 2, 3, 4, 5]
const LEVEL_XP = { 1: 0, 2: 200, 3: 500, 4: 1000, 5: 2000 }

function StepXPIntro({ onComplete, onBack }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 40px',
    }}>
      <StepHeader
        step={4}
        label="EARN XP. LEVEL UP."
        sub="Here's how the game works."
      />

      <Card width={460}>
        {/* XP earning table */}
        <div style={{
          background: 'rgba(0,0,0,0.25)', borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden', marginBottom: 20,
        }}>
          {XP_TABLE.map((row, i) => (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: i < XP_TABLE.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <span style={{ fontSize: 13, color: C.content, fontWeight: 600 }}>
                {row.icon}&nbsp; {row.label}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 900, letterSpacing: 1,
                color: C.amber,
                textShadow: `0 0 8px ${C.amber}66`,
              }}>
                +{row.xp} XP
              </span>
            </div>
          ))}
        </div>

        {/* Level ladder */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: C.hint, marginBottom: 12, fontWeight: 700 }}>
            LEVEL THRESHOLDS
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {LEVELS.map((lv, i) => (
              <React.Fragment key={lv}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 4,
                    background: lv === 1 ? `${C.primary}30` : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${lv === 1 ? C.primary : 'rgba(255,255,255,0.12)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, color: lv === 1 ? C.primary : C.muted,
                  }}>
                    {lv}
                  </div>
                  <span style={{ fontSize: 9, color: C.hint, letterSpacing: 1, fontWeight: 700 }}>
                    {LEVEL_XP[lv]}
                  </span>
                </div>
                {i < LEVELS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, marginBottom: 14,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 1,
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div style={{
          fontSize: 11, color: C.hint, letterSpacing: 1,
          marginBottom: 24, lineHeight: 1.6,
          borderLeft: `3px solid ${C.primary}`,
          paddingLeft: 12,
        }}>
          You just earned <span style={{ color: C.amber, fontWeight: 900 }}>+20 XP</span> for setting your first goal.
          Keep going — every action counts.
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <NavButton onClick={onBack}>← BACK</NavButton>
          <NavButton primary onClick={onComplete}>GOT IT, LET'S GO! →</NavButton>
        </div>
      </Card>
    </div>
  )
}

// ── Step 5: Ready ─────────────────────────────────────────────────────────────

function StepReady({ name, initials }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 450)
    const t2 = setTimeout(() => setPhase(2), 950)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const lines = ['SAVING PROFILE…', 'BUILDING YOUR WORLD…', 'PLAYER 1 READY!']

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 28,
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
  const [step,         setStep]         = useState(0)
  const [name,         setName]         = useState('')
  const [initials,     setInitials]     = useState('')
  const [epicName,     setEpicName]     = useState('')
  const [epicDeadline, setEpicDeadline] = useState('')
  const [habitName,    setHabitName]    = useState('')

  // Derive initials from name
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

  async function handleComplete() {
    setStep(5)
    try {
      // Save profile
      await Promise.all([
        window.electronAPI.settings.set('user_name',           name.trim() || 'Player'),
        window.electronAPI.settings.set('user_initials',       initials    || 'ME'),
        window.electronAPI.settings.set('onboarding_complete', 'true'),
      ])

      // Create the first epic
      const cols   = epicDeadline
        ? 'name,description,icon,color,horizon,status,progress,end_date'
        : 'name,description,icon,color,horizon,status,progress'
      const marks  = epicDeadline ? '?,?,?,?,?,?,?,?' : '?,?,?,?,?,?,?'
      const params = [epicName.trim() || 'My first goal', '', 'bolt', 'teal', 'quarter', 'not_started', 0]
      if (epicDeadline) params.push(epicDeadline)
      await window.electronAPI.db.run(
        `INSERT INTO epics (${cols}) VALUES (${marks})`,
        params
      )

      // Award XP for epic creation (+20)
      await window.electronAPI.xp.award(20).catch(() => {})

      // Create the first habit
      if (habitName.trim()) {
        await window.electronAPI.db.run(
          'INSERT INTO streak_habits (name,description,icon,current_streak,longest_streak) VALUES (?,?,?,0,0)',
          [habitName.trim(), '', 'flame']
        )
      }
    } catch (e) {
      console.error('[onboarding] save error:', e)
    }
    // Short pause on the "PLAYER 1 READY!" screen before dismissing
    setTimeout(onComplete, 2100)
  }

  // Progress dots for content steps 1–4
  const contentStep = step - 1  // 0-based index within the 4 content steps

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
      {/* Scanlines overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
      }} />
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `radial-gradient(circle, ${C.primary}10 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
      }} />

      {/* Top accent bar */}
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${C.tealDark}, ${C.primary}, ${C.tealDark})`,
        flexShrink: 0,
        zIndex: 2,
      }} />

      {/* Progress indicator — visible on content steps 1–4 */}
      {step >= 1 && step <= 4 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8,
          padding: '14px 0', zIndex: 2, flexShrink: 0,
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              height: 5, borderRadius: 2,
              width: i === contentStep ? 32 : 14,
              background: i <= contentStep ? C.primary : 'rgba(255,255,255,0.12)',
              transition: 'width 0.25s, background 0.25s',
            }} />
          ))}
        </div>
      )}

      {/* Step content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2, overflow: 'auto' }}>
        {step === 0 && <StepSplash    onNext={() => setStep(1)} />}
        {step === 1 && (
          <StepName
            name={name} initials={initials}
            onNameChange={setName}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepEpic
            epicName={epicName} epicDeadline={epicDeadline}
            onEpicNameChange={setEpicName}
            onDeadlineChange={setEpicDeadline}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <StepStreak
            habitName={habitName}
            onHabitNameChange={setHabitName}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <StepXPIntro
            onComplete={handleComplete}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && <StepReady name={name || 'Player'} initials={initials} />}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 24px', flexShrink: 0, zIndex: 2,
        display: 'flex', justifyContent: 'space-between',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <span style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>LIFE OS v1.0</span>
        <span style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>
          {step === 0 ? 'WELCOME'
            : step === 1 ? 'PLAYER SETUP'
            : step === 2 ? 'FIRST GOAL'
            : step === 3 ? 'DAILY HABIT'
            : step === 4 ? 'HOW IT WORKS'
            : 'LOADING...'}
        </span>
      </div>

      <style>{`
        @keyframes starTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50%       { opacity: 0.9; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
