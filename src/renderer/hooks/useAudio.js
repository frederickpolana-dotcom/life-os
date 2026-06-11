import { useRef, useCallback } from 'react'

// ── Frequencies ───────────────────────────────────────────────────────────────
const [C4,D4,E4,F4,G4,A4,Bb4,B4] = [261.63,293.66,329.63,349.23,392.00,440.00,466.16,493.88]
const [C5,Cs5,D5,E5,F5,Fs5,G5,A5,B5] = [523.25,554.37,587.33,659.25,698.46,739.99,783.99,880.00,987.77]
// Bass register
const E2=82.41,G2=98.00,A2=110.00,B2=123.47,C3=130.81,D3=146.83,E3=164.81,F3=174.61,G3=196.00,A3=220.00

// ── Timing (BPM 188) ─────────────────────────────────────────────────────────
const BPM = 188
const Q = 60 / BPM   // quarter note = 0.319s
const E = Q / 2      // eighth
const H = Q * 2      // half
const DQ = Q * 1.5   // dotted quarter
const DE = E * 1.5   // dotted eighth

// ── Song definitions ─────────────────────────────────────────────────────────
// Each note: [frequency, duration] — 0 = rest

const SONGS = [
  {
    // ── Super Mario Bros. Overworld ──
    label: 'Mario',
    melody: [
      [E5,E],[0,E*.5],[E5,E],[0,E],[E5,E],[0,E],[C5,E],[E5,Q],
      [G5,Q],[0,Q],[G4,Q],[0,Q],
      [C5,DE],[0,E*.5],[G4,E],[0,E],[E4,DE],[0,E*.5],
      [A4,E],[0,E*.5],[B4,E],[0,E*.5],[Bb4,E],[A4,Q],
      [G4,DE],[E5,DE],[G5,DE],[A5,Q],[F5,E],[G5,Q],
      [0,E],[E5,Q],[C5,E],[D5,E],[B4,DE],[0,E*.5],
    ],
    bass: [
      [E2,Q],[0,Q+E],[E2,E],[0,E],[E2,Q],   // bar 1
      [G2,Q],[0,Q],[G2,Q],[0,Q],             // bar 2
      [C3,DQ],[0,E],[G2,Q],[0,Q],            // bar 3
      [A2,Q],[0,Q],[E2,Q+E],[0,E],           // bar 4
      [G2,Q],[E2,Q],[C3,Q],[0,Q],            // bar 5
      [C3,Q],[0,Q],[G2,Q],[D3,Q],            // bar 6
    ],
    // kick beats (in quarter-note offsets per bar of 4)
    kick: [0, 2],
    hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    bars: 6,
  },
  {
    // ── Tetris Theme (Korobeiniki) ──
    label: 'Tetris',
    melody: [
      [E5,Q],[B4,E],[C5,E],[D5,Q],[C5,E],[B4,E],
      [A4,Q],[A4,E],[C5,E],[E5,Q],[D5,E],[C5,E],
      [B4,DQ],[0,E],[C5,E],[D5,Q],[E5,Q],
      [C5,Q],[A4,Q],[A4,H],
      [0,Q],[D5,Q],[F5,Q],[A5,Q],
      [G5,Q],[F5,E],[E5,E],[C5,Q],[E5,Q],
      [D5,Q],[C5,E],[B4,E],[B4,E],[C5,E],[D5,Q],
      [E5,Q],[C5,Q],[A4,Q],[A4,Q],
    ],
    bass: [
      [A2,Q],[0,Q],[E3,Q],[0,Q],
      [A2,Q],[0,Q],[E3,Q],[0,Q],
      [G3,Q],[0,Q],[D3,Q],[0,Q],
      [A2,Q],[0,Q],[A2,H],
      [D3,Q],[0,Q],[F3,Q],[0,Q],
      [A2,Q],[0,Q],[C3,Q],[0,Q],
      [E3,Q],[0,Q],[E3,Q],[0,Q],
      [A2,Q],[0,Q],[A2,H],
    ],
    kick: [0, 2],
    hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    bars: 8,
  },
  {
    // ── Zelda — Fairy Fountain Waltz (3/4 arpeggio) ──
    label: 'Zelda',
    melody: [
      // C major waltz arpeggios: each group = 3 eighth notes (one 3/4 bar)
      [G5,E],[E5,E],[C5,E],  [E5,E],[G5,E],[C5,E],
      [A5,E],[F5,E],[C5,E],  [F5,E],[A5,E],[C5,E],
      [G5,E],[D5,E],[B4,E],  [D5,E],[G5,E],[B4,E],
      [E5,E],[C5,E],[G4,E],  [C5,E],[E5,E],[G4,E],
      // Am section
      [F5,E],[C5,E],[A4,E],  [C5,E],[F5,E],[A4,E],
      [G5,E],[D5,E],[B4,E],  [D5,E],[G5,E],[B4,E],
      [E5,E],[C5,E],[G4,E],  [G5,E],[E5,E],[C5,E],
      [G5,E],[E5,E],[C5,E],  [0,E],[0,E],[0,E],
    ],
    bass: [
      [C3,Q+E],[0,E],[C3,Q+E],[0,E],
      [F3,Q+E],[0,E],[F3,Q+E],[0,E],
      [G3,Q+E],[0,E],[G3,Q+E],[0,E],
      [C3,Q+E],[0,E],[C3,Q+E],[0,E],
      [A2,Q+E],[0,E],[A2,Q+E],[0,E],
      [G2,Q+E],[0,E],[G2,Q+E],[0,E],
      [C3,Q+E],[0,E],[G2,Q+E],[0,E],
      [C3,Q+E],[0,E],[C3,Q+E],[0,E],
    ],
    kick: [0, 1.5],      // waltz: beats 1 and 2.5 (light)
    hihat: [0, 0.5, 1, 1.5, 2, 2.5],  // 6/8 feel
    bars: 8,
    barLen: Q * 3,       // 3/4 time — override bar length
  },
]

// ── Engine ────────────────────────────────────────────────────────────────────

export function useAudio() {
  const ctxRef        = useRef(null)
  const bgmActiveRef  = useRef(false)
  const bgmTimerRef   = useRef(null)
  const songIndexRef  = useRef(0)
  const masterGainRef = useRef(null)

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  // Build shared delay node for echo
  function makeDelay(ctx, dest) {
    const delay    = ctx.createDelay(0.5)
    const feedback = ctx.createGain()
    const wet      = ctx.createGain()
    delay.delayTime.value  = 0.22
    feedback.gain.value    = 0.25
    wet.gain.value         = 0.35
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    wet.connect(dest)
    return delay
  }

  // Schedule one note on a given destination
  function scheduleNote(ctx, dest, freq, dur, startTime, wave = 'triangle', gain = 0.18) {
    if (!freq || freq <= 0 || dur <= 0) return
    const osc = ctx.createOscillator()
    const g   = ctx.createGain()
    osc.connect(g)
    g.connect(dest)
    osc.type = wave
    osc.frequency.value = freq

    // soft attack + decay
    g.gain.setValueAtTime(0, startTime)
    g.gain.linearRampToValueAtTime(gain, startTime + Math.min(0.015, dur * 0.1))
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur * 0.88)
    osc.start(startTime)
    osc.stop(startTime + dur * 0.9)
  }

  // Kick drum: sine sweep 160Hz → 45Hz
  function scheduleKick(ctx, dest, time) {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(dest)
    osc.frequency.setValueAtTime(160, time)
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.1)
    gain.gain.setValueAtTime(0.7, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14)
    osc.start(time); osc.stop(time + 0.15)
  }

  // Hi-hat: white noise burst
  function scheduleHihat(ctx, dest, time, gain = 0.12) {
    const bufLen = Math.floor(ctx.sampleRate * 0.04)
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data   = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

    const src    = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const g      = ctx.createGain()

    src.buffer = buf
    filter.type = 'highpass'
    filter.frequency.value = 8000
    src.connect(filter); filter.connect(g); g.connect(dest)

    g.gain.setValueAtTime(gain, time)
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.035)
    src.start(time); src.stop(time + 0.04)
  }

  // Schedule one full song and return how long it takes
  function scheduleSong(song, master, startTime) {
    const ctx = getCtx()

    // Routing: melody → delay → master, bass/drums → master directly
    const melodyDest = ctx.createGain()
    melodyDest.gain.value = 1
    melodyDest.connect(master)
    const delayNode = makeDelay(ctx, master)
    const melodyWithDelay = ctx.createGain()
    melodyWithDelay.gain.value = 1
    melodyWithDelay.connect(melodyDest)
    melodyWithDelay.connect(delayNode)

    // Schedule melody
    let t = startTime
    for (const [freq, dur] of song.melody) {
      scheduleNote(ctx, melodyWithDelay, freq, dur, t, 'triangle', 0.20)
      t += dur
    }
    const melodyDuration = t - startTime

    // Schedule bass (sine, softer)
    let bt = startTime
    for (const [freq, dur] of song.bass) {
      scheduleNote(ctx, master, freq, dur, bt, 'sine', 0.22)
      bt += dur
    }

    // Schedule drums: tile across melody duration
    const barLen = song.barLen || (Q * 4)
    const numBars = Math.ceil(melodyDuration / barLen)
    for (let bar = 0; bar < numBars; bar++) {
      const barStart = startTime + bar * barLen
      for (const beat of (song.kick  || [])) scheduleKick  (ctx, master, barStart + beat * Q)
      for (const beat of (song.hihat || [])) scheduleHihat (ctx, master, barStart + beat * Q, 0.09)
    }

    return melodyDuration
  }

  // ── BGM loop ─────────────────────────────────────────────────────────────────

  const startBGM = useCallback(() => {
    if (bgmActiveRef.current) return
    bgmActiveRef.current = true

    const ctx    = getCtx()
    const master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
    masterGainRef.current = master
    songIndexRef.current  = 0

    function playNext() {
      if (!bgmActiveRef.current) return
      const song     = SONGS[songIndexRef.current % SONGS.length]
      const duration = scheduleSong(song, master, ctx.currentTime + 0.05)
      songIndexRef.current++
      // Schedule next song slightly before this one ends (overlap for seamless loop)
      bgmTimerRef.current = setTimeout(playNext, (duration - 0.15) * 1000)
    }
    playNext()
  }, [])

  const stopBGM = useCallback(() => {
    bgmActiveRef.current = false
    if (bgmTimerRef.current) { clearTimeout(bgmTimerRef.current); bgmTimerRef.current = null }
    if (masterGainRef.current) {
      try {
        const ctx = getCtx()
        masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime)
        masterGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
      } catch {}
      masterGainRef.current = null
    }
  }, [])

  // ── Sound effects ─────────────────────────────────────────────────────────────

  function sfx(freq, dur, wave = 'square', gain = 0.14, offset = 0) {
    if (!freq) return
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const g   = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = wave; osc.frequency.value = freq
    const t = ctx.currentTime + offset
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9)
    osc.start(t); osc.stop(t + dur)
  }

  const playComplete  = useCallback(() => {
    sfx(988,  0.06, 'square', 0.18, 0)
    sfx(1319, 0.20, 'square', 0.18, 0.07)
  }, [])

  const playStreakLog = useCallback(() => {
    sfx(440, 0.07, 'triangle', 0.15, 0)
    sfx(554, 0.07, 'triangle', 0.15, 0.07)
    sfx(659, 0.16, 'triangle', 0.15, 0.14)
  }, [])

  const playLevelUp = useCallback(() => {
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => sfx(f, 0.16, 'square', 0.10, i * 0.13))
  }, [])

  const playMessage   = useCallback(() => sfx(880, 0.04, 'sine', 0.06), [])
  const playEpicCreate = useCallback(() => {
    [392, 523, 659, 784].forEach((f, i) => sfx(f, 0.12, 'square', 0.10, i * 0.10))
  }, [])

  // UI interaction sounds
  const playClick  = useCallback(() => sfx(880, 0.028, 'square', 0.055), [])
  const playNav    = useCallback(() => {
    sfx(659, 0.035, 'square', 0.065, 0)
    sfx(784, 0.055, 'square', 0.065, 0.038)
  }, [])
  const playDelete = useCallback(() => {
    sfx(370, 0.045, 'square', 0.09, 0)
    sfx(220, 0.10,  'square', 0.09, 0.048)
  }, [])
  const playOpen   = useCallback(() => {
    sfx(523, 0.04, 'square', 0.07, 0)
    sfx(659, 0.06, 'square', 0.07, 0.04)
  }, [])

  return { playComplete, playStreakLog, playLevelUp, playMessage, playEpicCreate, playClick, playNav, playDelete, playOpen, startBGM, stopBGM }
}
