import React, { useEffect, useState, useCallback } from 'react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import AIPanel from './components/AIPanel'
import XPToast from './components/XPToast'
import ConfettiCelebration from './components/ConfettiCelebration'
import Dashboard from './pages/Dashboard'
import Daily from './pages/Daily'
import Calendar from './pages/Calendar'
import Epics from './pages/Epics'
import EpicDetail from './pages/EpicDetail'
import Streaks from './pages/Streaks'
import TimeAudit from './pages/TimeAudit'
import NetworkCRM from './pages/NetworkCRM'
import WeeklyReview from './pages/WeeklyReview'
import EnergyLog from './pages/EnergyLog'
import Settings from './pages/Settings'
import Welcome from './pages/Welcome'
import { useAudio } from './hooks/useAudio'
import { MarioFaceIcon } from './components/MarioSprite'
import { computeBg } from './utils/themes'

let toastId = 0

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState(null) // null=loading
  const [xp, setXp]                   = useState(0)
  const [level, setLevel]             = useState(1)
  const [userName, setUserName]       = useState('You')
  const [userInitials, setUserInitials] = useState('ME')
  const [aiOpen, setAiOpen]           = useState(false)
  const [toasts, setToasts]           = useState([])
  const [confetti, setConfetti]       = useState(0)
  const [musicOn, setMusicOn]         = useState(false)
  const [appTheme, setAppTheme]       = useState('dynamic')
  const [bg, setBg]                   = useState(() => computeBg('dynamic'))

  const audio = useAudio()

  async function loadProfile() {
    try {
      const [name, initials, xpVal, lvlVal, onboarded, theme] = await Promise.all([
        window.electronAPI.settings.get('user_name'),
        window.electronAPI.settings.get('user_initials'),
        window.electronAPI.settings.get('xp_total'),
        window.electronAPI.settings.get('xp_level'),
        window.electronAPI.settings.get('onboarding_complete'),
        window.electronAPI.settings.get('app_theme'),
      ])
      if (name)     setUserName(name)
      if (initials) setUserInitials(initials)
      if (xpVal)    setXp(Number(xpVal))
      if (lvlVal)   setLevel(Number(lvlVal))
      // show welcome unless explicitly completed
      setOnboardingDone(onboarded === 'true')
      const t = theme || 'dynamic'
      setAppTheme(t)
      setBg(computeBg(t))
    } catch {
      setOnboardingDone(true)
    }
  }

  function handleThemeChange(themeId) {
    setAppTheme(themeId)
    setBg(computeBg(themeId))
    window.electronAPI?.settings.set('app_theme', themeId).catch(() => {})
  }

  useEffect(() => {
    if (!window.electronAPI) return
    // Runtime migration — safe to run every startup, errors mean column already exists
    window.electronAPI.db.run('ALTER TABLE epics ADD COLUMN end_date DATE').catch(() => {})
    loadProfile()
  }, [])

  // Re-evaluate time-of-day background every 10 minutes (only when dynamic theme is active)
  useEffect(() => {
    if (appTheme !== 'dynamic') return
    const id = setInterval(() => setBg(computeBg('dynamic')), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [appTheme])

  // Global click sound + ripple on every button press
  useEffect(() => {
    function onMouseDown(e) {
      const el = e.target.closest('button, [role="button"]')
      if (!el || el.disabled) return

      // Ripple
      const rect = el.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.8
      const x    = e.clientX - rect.left  - size / 2
      const y    = e.clientY - rect.top   - size / 2
      const span = document.createElement('span')
      span.className = 'ripple-span'
      span.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`
      el.appendChild(span)
      setTimeout(() => span.remove(), 600)

      // Click sound (skip on music toggle to avoid interrupting BGM flow)
      if (!el.dataset.noclick) audio.playClick?.()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [audio])

  function addToast(text, type = 'xp') {
    const id = ++toastId
    setToasts(prev => [...prev, { id, text, type }])
  }

  function removeToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const awardXp = useCallback(async (amount, soundType = 'complete') => {
    if (!window.electronAPI) return
    try {
      const result = await window.electronAPI.xp.award(amount)
      setXp(result.xp)
      setLevel(result.level)
      addToast(`+${amount} XP ✨`, 'xp')
      if (soundType === 'streak') audio.playStreakLog()
      else if (soundType === 'epic') audio.playEpicCreate()
      else audio.playComplete()
      if (result.levelUp) {
        setConfetti(c => c + 1)
        audio.playLevelUp()
        addToast(`Level up! → Lv ${result.level} 🎉`, 'level')
      }
      return result
    } catch {}
  }, [audio])

  function playSound(type) {
    if      (type === 'message')  audio.playMessage()
    else if (type === 'complete') audio.playComplete()
    else if (type === 'streak')   audio.playStreakLog()
    else if (type === 'delete')   audio.playDelete()
    else if (type === 'nav')      audio.playNav()
    else if (type === 'open')     audio.playOpen()
  }

  function toggleMusic() {
    if (musicOn) {
      audio.stopBGM()
      setMusicOn(false)
    } else {
      audio.startBGM()
      setMusicOn(true)
    }
  }

  // Loading splash while checking onboarding status
  if (onboardingDone === null) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#061710',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Nunito, sans-serif',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: '#4a7060' }}>LOADING...</div>
      </div>
    )
  }

  if (onboardingDone === false) {
    return (
      <Welcome onComplete={() => { setOnboardingDone(true); loadProfile() }} />
    )
  }

  return (
    <MemoryRouter initialEntries={['/dashboard']}>
      <div className="flex h-screen w-screen overflow-hidden" style={{ background: bg.shell, transition: 'background-color 2.5s ease' }}>
        <Sidebar />

        <div className="flex flex-col flex-1 min-w-0" style={{ background: bg.content, transition: 'background-color 2.5s ease' }}>
          <Topbar
            userName={userName}
            userInitials={userInitials}
            xp={xp}
            level={level}
            musicOn={musicOn}
            onToggleMusic={toggleMusic}
          />

          <main
            className="flex-1 overflow-y-auto px-8 py-6"
            style={{
              backgroundImage: bg.bgImage || 'none',
              backgroundSize: bg.bgSize || '24px 24px',
            }}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"  element={<Dashboard awardXp={(n) => awardXp(n, 'streak')} onOpenAI={() => setAiOpen(true)} />} />
              <Route path="/daily"      element={<Daily     awardXp={(n) => awardXp(n, 'streak')} />} />
              <Route path="/calendar"  element={<Calendar  awardXp={(n) => awardXp(n, 'streak')} />} />
              <Route path="/epics"      element={<Epics awardXp={(n) => awardXp(n, 'epic')} />} />
              <Route path="/epics/:id"  element={<EpicDetail awardXp={(n) => awardXp(n, 'complete')} />} />
              <Route path="/streaks"    element={<Streaks awardXp={(n) => awardXp(n, 'streak')} />} />
              <Route path="/time-audit" element={<TimeAudit />} />
              <Route path="/network"    element={<NetworkCRM />} />
              <Route path="/weekly"     element={<WeeklyReview awardXp={(n) => awardXp(n, 'complete')} />} />
              <Route path="/energy"     element={<EnergyLog    awardXp={(n) => awardXp(n, 'complete')} />} />
              <Route path="/settings"   element={<Settings onProfileUpdate={(n, i) => { setUserName(n); setUserInitials(i) }} appTheme={appTheme} xp={xp} onThemeChange={handleThemeChange} />} />
            </Routes>
          </main>
        </div>

        {/* AI Panel */}
        <AIPanel open={aiOpen} onClose={() => setAiOpen(false)} playSound={playSound} />

        {/* Floating AI button — Mario face */}
        <button
          onClick={() => setAiOpen(o => !o)}
          className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center game-btn ${
            aiOpen ? 'bg-teal-dark' : 'bg-primary mario-bob'
          }`}
          title="AI Assistant"
        >
          {aiOpen
            ? <span className="text-white text-[20px] font-bold leading-none">✕</span>
            : <MarioFaceIcon px={5} />
          }
        </button>

        {/* XP toasts */}
        <XPToast toasts={toasts} onRemove={removeToast} />

        {/* Confetti for level-ups */}
        <ConfettiCelebration trigger={confetti} />
      </div>
    </MemoryRouter>
  )
}
