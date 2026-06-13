import React from 'react'

const LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000]
function xpForLevel(level) {
  return LEVEL_THRESHOLDS[level - 1] ?? 0
}
function xpForNextLevel(level) {
  return LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// Inline refresh SVG — circular arrow
function RefreshIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6"/>
      <path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  )
}

export default function Topbar({ userName, userInitials, xp, level, musicOn, onToggleMusic, brief, briefLoading, onRefreshBrief, onOpenCommand }) {
  const current = xp - xpForLevel(level)
  const needed  = xpForNextLevel(level) - xpForLevel(level)
  const pct     = level >= 5 ? 100 : Math.min(100, Math.round((current / needed) * 100))

  return (
    <header
      className="h-[70px] min-h-[70px] flex items-center justify-between px-8"
      style={{ background: '#061710', borderBottom: '1px solid rgba(29,158,117,0.22)' }}
    >
      {/* Left: daily brief + date */}
      <div className="flex flex-col justify-center gap-0.5 max-w-[520px] min-w-0">
        {briefLoading ? (
          <span className="text-[11px] font-medium animate-pulse" style={{ color: '#2a5c40' }}>
            Generating daily brief…
          </span>
        ) : (
          <p
            className="text-[11px] font-semibold line-clamp-3 leading-snug"
            style={{ color: '#4dffb0' }}
          >
            {brief || <span style={{ color: '#2a5c40' }}>Loading…</span>}
          </p>
        )}
        <span className="text-[10px] font-medium" style={{ color: '#2a5c40' }}>{formatDate()}</span>
      </div>

      {/* Right: command + music + XP bar + level badge + avatar */}
      <div className="flex items-center gap-4">

        {/* Command palette trigger (⌘K) */}
        <button
          onClick={onOpenCommand}
          title="Command palette (Ctrl+K)"
          className="flex items-center gap-2 h-7 pl-2.5 pr-2 transition-all hover:scale-[1.03]"
          style={{
            background: 'rgba(29,158,117,0.08)',
            border: '1px solid rgba(29,158,117,0.22)',
            borderRadius: 5,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4dffb0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-[10px] font-bold" style={{ color: '#2a5c40' }}>Search</span>
          <kbd className="text-[8px] font-extrabold px-1 py-0.5 rounded" style={{ background: 'rgba(29,158,117,0.15)', color: '#4dffb0', border: '1px solid rgba(29,158,117,0.25)' }}>
            ⌘K
          </kbd>
        </button>

        {/* Brief refresh */}
        <button
          onClick={onRefreshBrief}
          disabled={briefLoading}
          title="Refresh daily brief"
          className="w-7 h-7 flex items-center justify-center transition-all hover:scale-110 disabled:opacity-30"
          style={{
            background: 'rgba(29,158,117,0.08)',
            border: '1px solid rgba(29,158,117,0.2)',
            borderRadius: 4,
            color: '#4dffb0',
          }}
        >
          <RefreshIcon />
        </button>

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
          <span className="text-[10px] font-extrabold font-mono whitespace-nowrap" style={{ color: '#4dffb0' }}>
            {level >= 5
              ? `Level ${level} · ${xp} XP · MAX`
              : `Level ${level} · ${xp} / ${xpForNextLevel(level)} XP`}
          </span>
          {/* HP-style segmented bar */}
          <div
            className="relative w-[140px] overflow-hidden"
            style={{
              height: 8,
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
