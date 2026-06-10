import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

// ── Design tokens (mirrors CLAUDE.md palette) ───────────────────────────────
const C = {
  chrome:     '#061710',
  chromeMid:  '#0a2318',
  primary:    '#1D9E75',
  tealDark:   '#085041',
  tealMed:    '#2a8a67',
  tealBorder: '#b3e8d3',
  tealLight:  '#e8f8f1',
  tealPale:   '#f0faf6',
  amber:      '#EF9F27',
  amberDark:  '#a65c00',
  purple:     '#7F77DD',
  content:    '#f4fdf8',
  textPri:    '#1a3a2a',
  textMuted:  '#4a7060',
  textHint:   '#9bbdaa',
  done:       '#22c55e',
  red:        '#ef4444',
}

const LEVEL_XP    = [0, 200, 500, 1000, 2000]
const ENERGY_EMOJI = { 1: '😩', 2: '😕', 3: '😐', 4: '😊', 5: '🔥' }
const ICON_MAP    = { flame: '🔥', bolt: '⚡', star: '⭐', book: '📚', heart: '💚', run: '🏃', water: '💧', moon: '🌙', sun: '☀️', dumbbell: '🏋️' }

// ── Helper components ────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{ padding: '8px 10px 6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 9, fontWeight: 900, color: C.textHint, letterSpacing: '0.12em' }}>{label}</span>
        <div style={{ flex: 1, height: 1, background: C.tealBorder, marginLeft: 7 }} />
      </div>
      {children}
    </div>
  )
}

function WinBtn({ children, onClick, color, hoverBg = 'rgba(255,255,255,0.12)', title }) {
  const [hov, setHov] = useState(false)
  return (
    <button title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 22, height: 22, borderRadius: 4, border: 'none', cursor: 'pointer',
        background: hov ? hoverBg : 'transparent',
        color, fontSize: 14, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.1s', WebkitAppRegion: 'no-drag', padding: 0,
      }}>
      {children}
    </button>
  )
}

// ── Main widget component ────────────────────────────────────────────────────
function Widget() {
  const [habits, setHabits]     = useState([])
  const [logged, setLogged]     = useState(new Set())
  const [epic, setEpic]         = useState(null)
  const [xp, setXp]             = useState(0)
  const [level, setLevel]       = useState(1)
  const [energy, setEnergy]     = useState(null)
  const [pinned, setPinned]     = useState(false)
  const [flash, setFlash]       = useState(null)   // habit id that just got XP

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { if (window.electronAPI) load() }, [])

  async function load() {
    try {
      const [habitRows, logRows, epicRows, xpVal, lvlVal, energyRow, pinnedVal] = await Promise.all([
        window.electronAPI.db.query('SELECT * FROM streak_habits ORDER BY id', []),
        window.electronAPI.db.query('SELECT habit_id FROM streak_logs WHERE logged_date = ?', [today]),
        window.electronAPI.db.query(
          "SELECT * FROM epics WHERE status IN ('in_progress','not_started') ORDER BY status DESC, updated_at DESC LIMIT 1", []
        ),
        window.electronAPI.settings.get('xp_total'),
        window.electronAPI.settings.get('xp_level'),
        window.electronAPI.db.get('SELECT energy_rating FROM energy_logs WHERE log_date = ?', [today]),
        window.electronAPI.settings.get('widget_pinned'),
      ])
      setHabits(habitRows)
      setLogged(new Set(logRows.map(r => r.habit_id)))
      setEpic(epicRows[0] || null)
      setXp(Number(xpVal || 0))
      setLevel(Number(lvlVal || 1))
      setEnergy(energyRow?.energy_rating ?? null)
      setPinned(pinnedVal === 'true')
    } catch (err) { console.error('Widget load error:', err) }
  }

  async function tickHabit(habit) {
    if (logged.has(habit.id)) return
    try {
      await window.electronAPI.db.run(
        'INSERT OR IGNORE INTO streak_logs (habit_id, logged_date, completed) VALUES (?,?,1)',
        [habit.id, today]
      )
      const result = await window.electronAPI.xp.award(10)
      setXp(result.xp)
      setLevel(result.level)
      setLogged(prev => new Set([...prev, habit.id]))
      setFlash(habit.id)
      setTimeout(() => setFlash(null), 800)
    } catch {}
  }

  async function tapEnergy(rating) {
    const isNew = energy === null
    setEnergy(rating)
    try {
      await window.electronAPI.db.run(
        `INSERT INTO energy_logs (log_date, energy_rating) VALUES (?,?)
         ON CONFLICT(log_date) DO UPDATE SET energy_rating=excluded.energy_rating`,
        [today, rating]
      )
      if (isNew) {
        const result = await window.electronAPI.xp.award(5)
        setXp(result.xp)
        setLevel(result.level)
      }
    } catch {}
  }

  function togglePin() {
    const next = !pinned
    setPinned(next)
    window.electronAPI.widget.setAlwaysOnTop(next)
    window.electronAPI.settings.set('widget_pinned', String(next))
  }

  // XP progress toward next level
  const capLevel   = Math.min(level, 5)
  const prevXp     = LEVEL_XP[capLevel - 1] || 0
  const nextXp     = LEVEL_XP[capLevel] || LEVEL_XP[4]
  const xpPct      = capLevel >= 5 ? 100 : Math.min(100, Math.round(((xp - prevXp) / (nextXp - prevXp)) * 100))
  const doneCount  = habits.filter(h => logged.has(h.id)).length
  const allDone    = habits.length > 0 && doneCount === habits.length

  return (
    <div style={{
      width: 280,
      background: C.content,
      border: `2px solid ${C.primary}`,
      boxShadow: `4px 4px 0 ${C.tealDark}`,
      borderRadius: 6,
      overflow: 'hidden',
      fontFamily: "'Nunito', sans-serif",
      userSelect: 'none',
    }}>

      {/* ── Header (drag handle) ─────────────────────────────────────── */}
      <div style={{
        background: C.chrome,
        padding: '7px 8px 7px 12px',
        display: 'flex', alignItems: 'center',
        WebkitAppRegion: 'drag', cursor: 'grab',
      }}>
        <span style={{ fontSize: 15, marginRight: 7 }}>🎮</span>
        <span style={{ color: C.primary, fontWeight: 900, fontSize: 12, letterSpacing: '0.08em', flex: 1 }}>LIFE OS</span>
        <div style={{ display: 'flex', gap: 3, WebkitAppRegion: 'no-drag' }}>
          <WinBtn
            title={pinned ? 'Unpin (floating)' : 'Pin (always on top)'}
            color={pinned ? C.amber : C.textHint}
            onClick={togglePin}
          >
            📌
          </WinBtn>
          <WinBtn title="Minimise" color={C.textHint} onClick={() => window.electronAPI.widget.minimize()}>
            <span style={{ fontSize: 16, lineHeight: 1, marginBottom: 4 }}>−</span>
          </WinBtn>
          <WinBtn title="Hide widget" color={C.red} hoverBg="rgba(239,68,68,0.18)" onClick={() => window.electronAPI.widget.hide()}>
            <span style={{ fontSize: 13 }}>✕</span>
          </WinBtn>
        </div>
      </div>

      {/* ── XP bar ───────────────────────────────────────────────────── */}
      <div style={{
        background: C.tealDark,
        padding: '6px 10px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          background: C.primary, color: 'white', fontWeight: 900, fontSize: 10,
          padding: '2px 8px', borderRadius: 3, letterSpacing: '0.06em', flexShrink: 0,
          border: `1px solid ${C.tealMed}`, boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
        }}>
          LV.{level}
        </div>
        {/* segmented XP bar */}
        <div style={{ flex: 1, position: 'relative', height: 9, borderRadius: 2, overflow: 'hidden', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(29,158,117,0.25)' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${xpPct}%`,
            background: xpPct > 75 ? C.done : xpPct > 40 ? C.primary : C.amber,
            transition: 'width 0.5s ease',
          }} />
          {/* tick marks */}
          {[25, 50, 75].map(t => (
            <div key={t} style={{ position: 'absolute', left: `${t}%`, top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,0.25)' }} />
          ))}
        </div>
        <span style={{ color: C.tealBorder, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{xp} XP</span>
      </div>

      {/* ── Today's quests ───────────────────────────────────────────── */}
      <Section label={`TODAY'S QUESTS  ${doneCount}/${habits.length}`}>
        {habits.length === 0 ? (
          <p style={{ fontSize: 11, color: C.textHint, textAlign: 'center', padding: '6px 0 2px' }}>
            Add habits in the Streaks page
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {habits.map(h => {
              const done = logged.has(h.id)
              const isFlashing = flash === h.id
              const icon = ICON_MAP[h.icon] || '⚡'
              return (
                <button
                  key={h.id}
                  onClick={() => tickHabit(h)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                    borderRadius: 4, border: `1.5px solid ${done ? '#86efac' : C.tealBorder}`,
                    background: isFlashing ? '#d1fae5' : done ? '#f0fdf4' : 'white',
                    cursor: done ? 'default' : 'pointer',
                    textAlign: 'left', WebkitAppRegion: 'no-drag',
                    transition: 'all 0.15s', transform: isFlashing ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  {/* checkbox */}
                  <div style={{
                    width: 17, height: 17, borderRadius: 3, flexShrink: 0,
                    border: `2px solid ${done ? C.done : C.primary}`,
                    background: done ? C.done : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {done && <span style={{ color: 'white', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, flex: 1,
                    color: done ? C.textMuted : C.tealDark,
                    textDecoration: done ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {h.name}
                  </span>
                  {isFlashing
                    ? <span style={{ fontSize: 10, color: C.amber, fontWeight: 900 }}>+10✨</span>
                    : done
                    ? <span style={{ fontSize: 11 }}>⚡</span>
                    : <span style={{ fontSize: 9, color: C.amber, fontWeight: 800 }}>+10 XP</span>
                  }
                </button>
              )
            })}
          </div>
        )}
        {allDone && (
          <div style={{ marginTop: 7, textAlign: 'center', fontSize: 11, fontWeight: 800, color: C.done }}>
            🎉 All quests done today!
          </div>
        )}
      </Section>

      {/* ── Active epic ──────────────────────────────────────────────── */}
      {epic && (
        <Section label="ACTIVE EPIC">
          <div style={{
            background: 'white', border: `1.5px solid ${C.tealBorder}`,
            borderRadius: 4, padding: '7px 10px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.tealDark, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>⚔</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epic.name}</span>
            </div>
            <div style={{ height: 7, background: C.tealLight, borderRadius: 2, overflow: 'hidden', border: `1px solid ${C.tealBorder}` }}>
              <div style={{ width: `${epic.progress}%`, height: '100%', background: C.primary, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 10, color: C.textHint, marginTop: 3, textAlign: 'right', fontWeight: 700 }}>
              {epic.progress}% complete
            </div>
          </div>
        </Section>
      )}

      {/* ── Energy today ─────────────────────────────────────────────── */}
      <Section label="ENERGY TODAY">
        <div style={{ display: 'flex', gap: 4, WebkitAppRegion: 'no-drag' }}>
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              onClick={() => tapEnergy(n)}
              title={`Energy: ${n}`}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 4, fontSize: 16, cursor: 'pointer',
                border: `2px solid ${energy === n ? C.primary : C.tealBorder}`,
                background: energy === n ? C.tealLight : 'white',
                boxShadow: energy === n ? `0 2px 0 ${C.tealDark}` : 'none',
                transform: energy === n ? 'translateY(-1px)' : 'none',
                transition: 'all 0.12s', WebkitAppRegion: 'no-drag',
              }}
            >
              {ENERGY_EMOJI[n]}
            </button>
          ))}
        </div>
        {energy !== null && (
          <p style={{ fontSize: 10, color: C.textHint, textAlign: 'center', marginTop: 5, fontWeight: 700 }}>
            Logged {ENERGY_EMOJI[energy]} · {energy < 3 ? 'hang in there 💚' : energy === 3 ? 'steady on 🌿' : 'crushing it! ⚡'}
          </p>
        )}
      </Section>

      {/* ── Open app button ──────────────────────────────────────────── */}
      <div style={{ padding: '4px 10px 12px', WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => window.electronAPI.widget.openMain()}
          onMouseDown={e => { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = `0 0 0 ${C.tealDark}` }}
          onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 3px 0 ${C.tealDark}` }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 3px 0 ${C.tealDark}` }}
          style={{
            width: '100%', padding: '9px', borderRadius: 4, cursor: 'pointer',
            background: C.primary, color: 'white', fontWeight: 900, fontSize: 12,
            border: `2px solid ${C.tealDark}`, boxShadow: `0 3px 0 ${C.tealDark}`,
            letterSpacing: '0.08em', transition: 'all 0.08s',
          }}
        >
          ▶ OPEN LIFE OS
        </button>
      </div>
    </div>
  )
}

// ── Mount ────────────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')).render(<Widget />)
