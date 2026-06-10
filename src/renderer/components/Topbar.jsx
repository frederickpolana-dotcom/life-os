import React from 'react'

const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000]
const LEVEL_LABELS = ['Novice', 'Rising', 'Focused', 'Driven', 'Legendary']

function xpForLevel(level) {
  return LEVEL_THRESHOLDS[level - 1] ?? 0
}
function xpForNextLevel(level) {
  return LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function Topbar({ userName, userInitials, xp, level, musicOn, onToggleMusic }) {
  const current = xp - xpForLevel(level)
  const needed  = xpForNextLevel(level) - xpForLevel(level)
  const pct     = level >= 5 ? 100 : Math.min(100, Math.round((current / needed) * 100))

  return (
    <header
      className="h-[60px] min-h-[60px] flex items-center justify-between px-8"
      style={{ background: '#061710', borderBottom: '1px solid rgba(29,158,117,0.22)' }}
    >
      {/* Left: greeting */}
      <div className="flex flex-col leading-tight">
        <span className="text-[15px] font-extrabold" style={{ color: '#4dffb0' }}>
          {greeting()}, {userName} 👋
        </span>
        <span className="text-[11px] font-medium" style={{ color: '#2a5c40' }}>{formatDate()}</span>
      </div>

      {/* Right: music + XP bar + level badge + avatar */}
      <div className="flex items-center gap-4">

        {/* Music toggle */}
        <button
          onClick={onToggleMusic}
          title={musicOn ? 'Stop music' : 'Play BGM 🎵'}
          className="w-8 h-8 flex items-center justify-center text-[16px] transition-all hover:scale-110"
          style={{
            background: musicOn ? '#1D9E75' : 'rgba(29,158,117,0.12)',
            border: '1px solid rgba(29,158,117,0.25)',
            borderRadius: 4,
            boxShadow: musicOn ? '2px 2px 0 #085041' : 'none',
          }}
        >
          {musicOn ? '🎵' : '🎮'}
        </button>

        {/* XP bar */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#2a5c40' }}>
              {LEVEL_LABELS[level - 1]}
            </span>
            <span className="text-[10px] font-extrabold font-mono" style={{ color: '#4dffb0' }}>{xp} XP</span>
          </div>
          {/* HP-style segmented bar */}
          <div
            className="relative w-[140px] overflow-hidden"
            style={{
              height: 10,
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 2,
              border: '1px solid rgba(29,158,117,0.2)',
            }}
          >
            <div
              className="absolute inset-y-0 left-0 progress-fill"
              style={{
                width: `${pct}%`,
                borderRadius: 2,
                background: pct > 70
                  ? 'linear-gradient(90deg,#1D9E75,#2dd4a0)'
                  : pct > 35
                    ? 'linear-gradient(90deg,#EF9F27,#f5c044)'
                    : 'linear-gradient(90deg,#e52521,#f55553)',
              }}
            />
            {[25, 50, 75].map(t => (
              <div
                key={t}
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${t}%`, background: 'rgba(255,255,255,0.2)' }}
              />
            ))}
          </div>
        </div>

        {/* Level badge — gold coin */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center coin-wobble flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg,#EF9F27,#f5c842)',
            boxShadow: '0 2px 0 #b36a00, 0 0 10px rgba(239,159,39,0.4)',
          }}
        >
          <span className="text-[12px] font-extrabold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
            {level}
          </span>
        </div>

        {/* Avatar */}
        <div
          className="w-8 h-8 flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(29,158,117,0.15)',
            border: '2px solid rgba(29,158,117,0.3)',
            borderRadius: 4,
          }}
        >
          <span className="text-[11px] font-extrabold" style={{ color: '#4dffb0' }}>{userInitials}</span>
        </div>
      </div>
    </header>
  )
}
