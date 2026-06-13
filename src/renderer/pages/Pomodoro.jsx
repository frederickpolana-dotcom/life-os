import React, { useEffect, useState, useRef } from 'react'

// ── Audio chime on session complete ───────────────────────────────────────────
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35)
      osc.start(ctx.currentTime + i * 0.18)
      osc.stop(ctx.currentTime + i * 0.18 + 0.36)
    })
  } catch {}
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MODES = {
  work:        { label: 'Focus Time',  defaultMin: 25, color: '#1D9E75', dark: '#085041' },
  short_break: { label: 'Short Break', defaultMin: 5,  color: '#EF9F27', dark: '#a65c00' },
  long_break:  { label: 'Long Break',  defaultMin: 15, color: '#7F77DD', dark: '#3d3a9e' },
}
const CYCLE            = 4   // work sessions before long break
const XP_PER_POMODORO  = 20
const XP_CYCLE_BONUS   = 30

// ── Ring ─────────────────────────────────────────────────────────────────────
const R    = 108
const CX   = 140
const CY   = 140
const CIRC = 2 * Math.PI * R

function Ring({ pct, color }) {
  const offset = CIRC * (1 - Math.min(1, Math.max(0, pct)))
  return (
    <svg
      width="280" height="280" viewBox="0 0 280 280"
      style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}
    >
      <circle cx={CX} cy={CY} r={R} fill="none"
        stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
      <circle cx={CX} cy={CY} r={R} fill="none"
        stroke={color} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={CIRC} strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease',
          filter: `drop-shadow(0 0 8px ${color}70)`,
        }}
      />
    </svg>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Pomodoro({ awardXp }) {
  const [mode, setMode]             = useState('work')
  const [durations, setDurations]   = useState({ work: 25, short_break: 5, long_break: 15 })
  const [timeLeft, setTimeLeft]     = useState(25 * 60)
  const [running, setRunning]       = useState(false)
  const [cycleDot, setCycleDot]     = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [todayMins, setTodayMins]   = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [sessionDone, setSessionDone]   = useState(false)

  const ivRef   = useRef(null)
  const modeRef = useRef(mode)
  const durRef  = useRef(durations)
  const dotRef  = useRef(cycleDot)

  useEffect(() => { modeRef.current = mode },      [mode])
  useEffect(() => { durRef.current = durations },  [durations])
  useEffect(() => { dotRef.current = cycleDot },   [cycleDot])

  useEffect(() => {
    async function init() {
      if (!window.electronAPI) return
      await window.electronAPI.db.run(`
        CREATE TABLE IF NOT EXISTS pomodoro_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_date DATE NOT NULL,
          duration_minutes INTEGER NOT NULL,
          session_type TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).catch(() => {})
      const rows = await window.electronAPI.db.query(
        `SELECT session_type, duration_minutes FROM pomodoro_sessions WHERE session_date = date('now')`, []
      ).catch(() => [])
      const work = rows.filter(r => r.session_type === 'work')
      setTodayCount(work.length)
      setTodayMins(work.reduce((s, r) => s + r.duration_minutes, 0))
    }
    init()
    return () => clearInterval(ivRef.current)
  }, [])

  // Session-end handler — runs after state settles to avoid stale closure issues
  useEffect(() => {
    if (!sessionDone) return
    setSessionDone(false)

    const m   = modeRef.current
    const d   = durRef.current
    const dot = dotRef.current

    chime()

    if (m === 'work') {
      awardXp?.(XP_PER_POMODORO)
      setTodayCount(c => c + 1)
      setTodayMins(prev => prev + d.work)
      window.electronAPI?.db.run(
        `INSERT INTO pomodoro_sessions (session_date, duration_minutes, session_type) VALUES (date('now'), ?, 'work')`,
        [d.work]
      ).catch(() => {})

      const nextDot = dot + 1
      if (nextDot >= CYCLE) {
        awardXp?.(XP_CYCLE_BONUS)
        setCycleDot(0)
        setMode('long_break')
        setTimeLeft(d.long_break * 60)
      } else {
        setCycleDot(nextDot)
        setMode('short_break')
        setTimeLeft(d.short_break * 60)
      }
    } else {
      setMode('work')
      setTimeLeft(d.work * 60)
    }
  }, [sessionDone]) // eslint-disable-line

  const totalSecs = (durations[mode] || 25) * 60
  const pct       = totalSecs > 0 ? timeLeft / totalSecs : 0
  const cfg       = MODES[mode]
  const mins      = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs      = String(timeLeft % 60).padStart(2, '0')

  function toggleTimer() {
    if (running) {
      clearInterval(ivRef.current)
      setRunning(false)
      return
    }
    setRunning(true)
    ivRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(ivRef.current)
          setRunning(false)
          setSessionDone(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function reset() {
    clearInterval(ivRef.current)
    setRunning(false)
    setTimeLeft(durations[mode] * 60)
  }

  function skip() {
    clearInterval(ivRef.current)
    setRunning(false)
    setSessionDone(true)
  }

  function switchMode(newMode) {
    clearInterval(ivRef.current)
    setRunning(false)
    setMode(newMode)
    setTimeLeft(durations[newMode] * 60)
  }

  function updateDuration(key, val) {
    const v = Math.max(1, Math.min(99, Number(val) || 1))
    setDurations(prev => {
      const next = { ...prev, [key]: v }
      if (key === mode && !running) setTimeLeft(v * 60)
      return next
    })
  }

  const isLastWork = mode === 'work' && cycleDot === CYCLE - 1

  return (
    <div className="page-enter max-w-[640px]">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-teal-dark">Pomodoro Timer</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Deep work in focused intervals</p>
        </div>

        <div className="flex items-center gap-3">
          <StatChip value={todayCount} label="Sessions" color="#1D9E75" soft="#e8f8f1" border="#b3e8d3" />
          <StatChip value={`${todayMins}m`} label="Focus time" color="#EF9F27" soft="#fff8ec" border="#EF9F2750" />
          <button
            onClick={() => setShowSettings(s => !s)}
            title="Timer settings"
            className="w-9 h-9 flex items-center justify-center transition-all hover:scale-105 game-btn"
            style={{
              background: showSettings ? '#1D9E75' : 'rgba(29,158,117,0.08)',
              border: `2px solid ${showSettings ? '#085041' : 'rgba(29,158,117,0.25)'}`,
              borderRadius: 4,
              color: showSettings ? '#fff' : '#1D9E75',
              boxShadow: showSettings ? '2px 2px 0 #085041' : 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        {Object.entries(MODES).map(([key, c]) => (
          <button
            key={key}
            onClick={() => switchMode(key)}
            className="px-4 py-1.5 text-[11px] font-bold transition-all game-btn"
            style={{
              background: mode === key ? c.color : 'transparent',
              color:      mode === key ? '#fff' : '#4a7060',
              border:     `2px solid ${mode === key ? c.dark : '#d4f0e6'}`,
              boxShadow:  mode === key ? `2px 2px 0 ${c.dark}` : 'none',
              borderRadius: 4,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Main timer card */}
      <div
        className="p-8 mb-6 flex flex-col items-center bounce-in"
        style={{
          background: '#061710',
          border: `2px solid ${cfg.color}35`,
          borderRadius: 8,
          boxShadow: `4px 4px 0 #020e07, 0 0 50px ${cfg.color}0d`,
          transition: 'border-color 0.4s, box-shadow 0.4s',
        }}
      >
        {/* Ring + time display */}
        <div
          className="relative flex items-center justify-center mb-5"
          style={{ width: 280, height: 280 }}
        >
          <Ring pct={pct} color={cfg.color} />

          {/* Inner content */}
          <div className="absolute flex flex-col items-center gap-1.5">
            <span
              className="font-extrabold font-mono tracking-tight"
              style={{
                fontSize: 54,
                lineHeight: 1,
                color: '#f0fff8',
                textShadow: `0 0 30px ${cfg.color}50`,
              }}
            >
              {mins}:{secs}
            </span>
            <span
              className="text-[11px] font-bold tracking-[4px] uppercase"
              style={{ color: cfg.color }}
            >
              {cfg.label}
            </span>
            {running && (
              <span className="text-[9px] font-semibold animate-pulse" style={{ color: '#1a4032' }}>
                in progress
              </span>
            )}
          </div>
        </div>

        {/* Cycle dots */}
        <div className="flex items-center gap-3 mb-7">
          {Array.from({ length: CYCLE }).map((_, i) => (
            <div
              key={i}
              className="transition-all duration-300"
              style={{
                width: 12, height: 12,
                borderRadius: '50%',
                background:   i < cycleDot ? cfg.color : 'rgba(255,255,255,0.07)',
                border:       `1.5px solid ${i < cycleDot ? cfg.dark : 'rgba(255,255,255,0.1)'}`,
                boxShadow:    i < cycleDot ? `0 0 8px ${cfg.color}80` : 'none',
                transform:    i < cycleDot ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
          <span className="text-[10px] font-bold ml-1" style={{ color: '#2a5c40' }}>
            {cycleDot}/{CYCLE}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <CtrlBtn onClick={reset} title="Reset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </CtrlBtn>

          {/* Primary play/pause */}
          <button
            onClick={toggleTimer}
            className="flex items-center gap-2 px-10 py-3 text-[14px] font-extrabold text-white game-btn transition-all hover:scale-[1.03]"
            style={{
              background:  cfg.color,
              border:      `2.5px solid ${cfg.dark}`,
              boxShadow:   `3px 3px 0 ${cfg.dark}, 0 0 20px ${cfg.color}35`,
              borderRadius: 6,
              minWidth: 150,
              justifyContent: 'center',
            }}
          >
            {running ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                {timeLeft < totalSecs && timeLeft > 0 ? 'Resume' : 'Start'}
              </>
            )}
          </button>

          <CtrlBtn onClick={skip} title="Skip to next session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"/>
              <line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </CtrlBtn>
        </div>

        {/* XP hint */}
        <p className="mt-5 text-[10px] font-semibold text-center" style={{ color: '#1a4032' }}>
          Complete a focus session to earn{' '}
          <span style={{ color: '#EF9F27' }}>+{XP_PER_POMODORO} XP</span>
          {isLastWork && (
            <span style={{ color: '#7F77DD' }}> + {XP_CYCLE_BONUS} cycle bonus</span>
          )}
        </p>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className="p-5 mb-6 bounce-in"
          style={{
            background: '#f4fdf8',
            border: '2px solid #d4f0e6',
            borderRadius: 6,
            boxShadow: '3px 3px 0 rgba(8,80,65,0.1)',
          }}
        >
          <p className="text-[12px] font-extrabold text-teal-dark uppercase tracking-wide mb-4">
            Duration Settings
          </p>
          <div className="grid grid-cols-3 gap-5">
            {Object.entries(MODES).map(([key, c]) => (
              <div key={key}>
                <label
                  className="block text-[10px] font-bold uppercase tracking-wide mb-1.5"
                  style={{ color: c.color }}
                >
                  {c.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={99}
                    value={durations[key]}
                    onChange={e => updateDuration(key, e.target.value)}
                    className="w-16 px-2 py-1.5 text-[14px] font-extrabold font-mono text-center outline-none"
                    style={{
                      background: '#fff',
                      border: `2px solid ${c.color}40`,
                      borderRadius: 4,
                      color: '#085041',
                    }}
                  />
                  <span className="text-[11px] text-text-muted">min</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-text-hint mt-4">
            Changes take effect when the current session resets or ends.
          </p>
        </div>
      )}

      {/* How it works */}
      <div
        className="px-5 py-4"
        style={{
          background: '#f4fdf8',
          border: '1px solid #d4f0e6',
          borderRadius: 6,
        }}
      >
        <p className="text-[11px] font-extrabold text-teal-dark mb-3">How the Pomodoro Technique works</p>
        <div className="flex items-center gap-2 flex-wrap">
          <FlowStep n={1} label={`${durations.work}m Focus`}      color="#1D9E75" />
          <Arrow />
          <FlowStep n={2} label={`${durations.short_break}m Break`} color="#EF9F27" />
          <Arrow />
          <FlowStep n={3} label={`Repeat x${CYCLE}`}              color="#7F77DD" />
          <Arrow />
          <FlowStep n={4} label={`${durations.long_break}m Rest`}  color="#1D9E75" />
        </div>
        <p className="text-[10px] text-text-hint mt-3">
          After {CYCLE} focus sessions you earn a long break and a <span style={{ color: '#7F77DD', fontWeight: 700 }}>+{XP_CYCLE_BONUS} XP</span> cycle bonus.
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatChip({ value, label, color, soft, border }) {
  return (
    <div
      className="px-3 py-2 text-center"
      style={{
        background: soft,
        border: `2px solid ${border}`,
        borderRadius: 4,
        boxShadow: '2px 2px 0 rgba(8,80,65,0.06)',
        minWidth: 64,
      }}
    >
      <p className="text-[18px] font-extrabold font-mono leading-none" style={{ color }}>{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted mt-0.5">{label}</p>
    </div>
  )
}

function CtrlBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-10 h-10 flex items-center justify-center transition-all hover:scale-105 game-btn"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1.5px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        color: '#4a7060',
      }}
    >
      {children}
    </button>
  )
}

function FlowStep({ n, label, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white flex-shrink-0"
        style={{ background: color }}
      >
        {n}
      </span>
      <span className="text-[10px] font-semibold text-text-muted whitespace-nowrap">{label}</span>
    </div>
  )
}

function Arrow() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 5h12M9 1l4 4-4 4" stroke="#b3e8d3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
