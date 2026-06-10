import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

// Icons inherit color from parent text via currentColor
function makeIcon(d) {
  return function Icon({ size = 16 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {d}
      </svg>
    )
  }
}

const IconGrid = makeIcon(<>
  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
  <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
</>)

const IconRocket = makeIcon(<>
  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
</>)

const IconFlame = makeIcon(
  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
)

const IconClock = makeIcon(<>
  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
</>)

const IconUsers = makeIcon(<>
  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
  <circle cx="9" cy="7" r="4" />
  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
</>)

const IconCalendar = makeIcon(<>
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
  <line x1="3" y1="10" x2="21" y2="10" />
</>)

const IconBolt = makeIcon(
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
)

const IconSettings = makeIcon(<>
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
</>)

const NAV_MAIN = [
  { to: '/dashboard', label: 'Dashboard',    Icon: IconGrid },
  { to: '/epics',     label: 'My Epics',     Icon: IconRocket },
  { to: '/streaks',   label: 'Streaks',      Icon: IconFlame },
]

const NAV_TOOLS = [
  { to: '/time-audit', label: 'Time Audit',    Icon: IconClock },
  { to: '/network',    label: 'Network CRM',   Icon: IconUsers },
  { to: '/weekly',     label: 'Weekly Review', Icon: IconCalendar },
  { to: '/energy',     label: 'Energy Log',    Icon: IconBolt },
]

const NAV_ACCOUNT = [
  { to: '/settings', label: 'Settings', Icon: IconSettings },
]

export default function Sidebar() {
  const [streaks, setStreaks] = useState([])

  useEffect(() => {
    async function load() {
      if (!window.electronAPI) return
      try {
        const rows = await window.electronAPI.db.query(
          'SELECT id, name, current_streak FROM streak_habits ORDER BY current_streak DESC LIMIT 3',
          []
        )
        setStreaks(rows)
      } catch {}
    }
    load()
  }, [])

  return (
    <aside
      className="w-[200px] min-w-[200px] h-screen flex flex-col select-none"
      style={{ background: '#061710', borderRight: '1px solid rgba(29,158,117,0.18)' }}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
        <div
          className="w-8 h-8 flex items-center justify-center flex-shrink-0"
          style={{
            background: '#1D9E75',
            borderRadius: 4,
            boxShadow: '2px 2px 0 #085041',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div>
          <div className="font-extrabold text-[15px] tracking-tight" style={{ color: '#4dffb0' }}>Life OS</div>
          <div className="text-[8px] font-bold tracking-widest uppercase" style={{ color: '#2a5c40' }}>LEVEL UP YOUR LIFE</div>
        </div>
      </div>

      <nav className="flex-1 px-2 overflow-y-auto">
        <NavSection>
          {NAV_MAIN.map(item => <SideNavItem key={item.to} {...item} />)}
        </NavSection>
        <NavSection label="Tools">
          {NAV_TOOLS.map(item => <SideNavItem key={item.to} {...item} />)}
        </NavSection>
        <NavSection label="Account">
          {NAV_ACCOUNT.map(item => <SideNavItem key={item.to} {...item} />)}
        </NavSection>
      </nav>

      {/* Streak mini-widget */}
      {streaks.length > 0 && (
        <div
          className="mx-3 mb-4 px-3 py-3 rounded"
          style={{ background: 'rgba(29,158,117,0.07)', border: '1px solid rgba(29,158,117,0.18)' }}
        >
          <p className="text-[9px] font-extrabold uppercase tracking-widest mb-2" style={{ color: '#EF9F27' }}>
            🔥 Streaks
          </p>
          <div className="flex flex-col gap-1.5">
            {streaks.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold truncate" style={{ color: '#7dc4a4' }}>{s.name}</span>
                <span className="text-[11px] font-extrabold whitespace-nowrap font-mono" style={{ color: '#4dffb0' }}>
                  {s.current_streak}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

function NavSection({ label, children }) {
  return (
    <div className="mb-1">
      {label && (
        <p
          className="px-3 pt-4 pb-1 text-[9px] font-extrabold uppercase tracking-widest"
          style={{ color: '#EF9F27' }}
        >
          {label}
        </p>
      )}
      <div className="flex flex-col gap-0">{children}</div>
    </div>
  )
}

function SideNavItem({ to, label, Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 py-[9px] text-[12px] font-bold transition-colors ${
          isActive ? 'text-[#4dffb0]' : 'text-[#3d7058] hover:text-[#a8e8c8]'
        }`
      }
      style={({ isActive }) => ({
        borderLeft: isActive ? '3px solid #1D9E75' : '3px solid transparent',
        paddingLeft: isActive ? 9 : 12,
        paddingRight: 12,
        background: isActive ? 'rgba(29,158,117,0.1)' : 'transparent',
      })}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span style={{ fontSize: 8, lineHeight: 1, opacity: 0.85 }}>▶</span>
          )}
          <Icon size={14} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}
