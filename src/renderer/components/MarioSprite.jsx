import React, { useEffect, useRef, useState } from 'react'

// Palette
const C = {
  R: '#E52521',  // red hat/shirt
  S: '#F8B272',  // skin
  D: '#5C3317',  // dark brown (hair, eyes, mustache)
  B: '#0052A5',  // blue overalls
  T: '#3D1A00',  // dark brown shoes
}

// 8×8 face — used as AI button icon
const FACE = [
  '..RRRR..',
  '.RRRRRR.',
  '.DDSSDD.',
  '.SDSSDS.',
  '.SSSSSS.',
  '..DDDD..',
  '.DDDDDD.',
  '..SSS...',
]

// 12×14 walking body — two frames
const WALK = [
  // Frame 1: stride (legs wide)
  [
    '...RRRRR....',
    '..RRRRRRR...',
    '..DDSSDD....',
    '.DSDSSDD....',
    '.DSSSSSD....',
    '..SSSSS.....',
    '..DDDDD.....',
    '.RRBBRR.....',
    'RRBBBBRR....',
    '.BBBBBB.....',
    '.BB..BB.....',
    '.B....B.....',
    '.T....TT....',
    'TT....TT....',
  ],
  // Frame 2: mid-step (legs together)
  [
    '...RRRRR....',
    '..RRRRRRR...',
    '..DDSSDD....',
    '.DSDSSDD....',
    '.DSSSSSD....',
    '..SSSSS.....',
    '..DDDDD.....',
    '.RRBBRR.....',
    'RRBBBBRR....',
    '.BBBBBB.....',
    '.BB..BB.....',
    '..B..B......',
    '..TT.T......',
    '..TTTTT.....',
  ],
]

function PixelArt({ rows, px, flipX = false }) {
  const cols = rows.reduce((max, r) => Math.max(max, r.length), 0)
  const w = cols * px
  const h = rows.length * px

  const rects = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = C[row[x]]
      if (color) {
        rects.push(
          <rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={color} />
        )
      }
    }
  })

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        imageRendering: 'pixelated',
        display: 'block',
        transform: flipX ? 'scaleX(-1)' : undefined,
        transformOrigin: '50% 50%',
      }}
    >
      {rects}
    </svg>
  )
}

export function MarioFaceIcon({ px = 4 }) {
  return <PixelArt rows={FACE} px={px} />
}

export function WalkingMario({ onOpenAI }) {
  const [pos, setPos]         = useState(60)
  const [dir, setDir]         = useState(1)
  const [frame, setFrame]     = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  const stateRef   = useRef({ pos: 60, dir: 1, step: 0, last: 0 })
  const hoveredRef = useRef(false)

  useEffect(() => {
    const PX       = 3
    const SPRITE_W = 12 * PX
    const SIDEBAR  = 200

    function maxX() {
      return Math.max(40, window.innerWidth - SIDEBAR - SPRITE_W - 80)
    }

    let raf
    function tick(ts) {
      const s = stateRef.current
      // Only move when not hovered
      if (!hoveredRef.current && ts - s.last >= 80) {
        s.pos += s.dir * 1.5
        if (s.pos < 10 || s.pos > maxX()) {
          s.dir = -s.dir
          s.pos = Math.max(10, Math.min(maxX(), s.pos))
        }
        s.step++
        setPos(Math.round(s.pos))
        setDir(s.dir)
        setFrame(Math.floor(s.step / 4) % 2)
        s.last = ts
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function handleMouseEnter() {
    hoveredRef.current = true
    setIsHovered(true)
  }
  function handleMouseLeave() {
    hoveredRef.current = false
    setIsHovered(false)
  }

  const PX = 3
  const SPRITE_W = 12 * PX
  const SPRITE_H = 14 * PX

  return (
    <div
      onClick={onOpenAI}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        bottom: 4,
        left: 200 + pos,
        width: SPRITE_W,
        height: SPRITE_H,
        zIndex: 20,
        cursor: 'pointer',
        animation: isHovered ? 'confusedShake 0.35s ease-in-out infinite' : undefined,
      }}
    >
      {/* Floating "?" when confused */}
      {isHovered && (
        <div style={{
          position: 'absolute',
          top: -20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#EF9F27',
          color: '#fff',
          fontWeight: 900,
          fontSize: 11,
          lineHeight: 1,
          padding: '2px 5px',
          borderRadius: 3,
          boxShadow: '0 2px 0 #b36a00',
          animation: 'questionBob 0.7s ease-in-out infinite',
          pointerEvents: 'none',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}>?</div>
      )}

      {/* Sprite: standing (frame 0) when confused, walking otherwise */}
      <PixelArt rows={WALK[isHovered ? 0 : frame]} px={PX} flipX={dir < 0} />

      {/* Ground shadow */}
      <div style={{
        position: 'absolute',
        bottom: -2,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 20,
        height: 4,
        background: 'rgba(0,0,0,0.1)',
        borderRadius: '50%',
        filter: 'blur(2px)',
      }} />
    </div>
  )
}
