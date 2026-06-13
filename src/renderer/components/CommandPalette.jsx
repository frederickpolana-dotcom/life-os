import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Fuzzy matching ────────────────────────────────────────────────────────────────

function fuzzyScore(query, text) {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (t.includes(q)) return 100 - t.indexOf(q) // prioritise earlier matches
  // subsequence fallback
  let qi = 0, score = 0, streak = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { qi++; streak++; score += streak } else streak = 0
  }
  return qi === q.length ? score : -1
}

// ── Static commands ────────────────────────────────────────────────────────────────

const NAV_COMMANDS = [
  { id: 'nav-dashboard', icon: '🏠', label: 'Dashboard',      sub: 'Go to overview',        to: '/dashboard' },
  { id: 'nav-daily',     icon: '☀️', label: 'Daily Planner',   sub: 'Plan today',            to: '/daily' },
  { id: 'nav-journal',   icon: '📖', label: 'Journal',         sub: 'Write or reflect',      to: '/journal' },
  { id: 'nav-insights',  icon: '📊', label: 'Insights',        sub: 'Your stats & trends',   to: '/insights' },
  { id: 'nav-epics',     icon: '🚀', label: 'My Epics',        sub: 'All goals',             to: '/epics' },
  { id: 'nav-streaks',   icon: '🔥', label: 'Streaks',         sub: 'Daily habits',          to: '/streaks' },
  { id: 'nav-calendar',  icon: '📅', label: 'Calendar',        sub: 'Schedule view',         to: '/calendar' },
  { id: 'nav-time',      icon: '⏱️', label: 'Time Audit',      sub: 'Weekly hours',          to: '/time-audit' },
  { id: 'nav-network',   icon: '🤝', label: 'Network CRM',     sub: 'Contacts',              to: '/network' },
  { id: 'nav-weekly',    icon: '🗓️', label: 'Weekly Review',   sub: 'Reflect on the week',   to: '/weekly' },
  { id: 'nav-energy',    icon: '⚡', label: 'Energy Log',      sub: 'Track energy',          to: '/energy' },
  { id: 'nav-settings',  icon: '⚙️', label: 'Settings',        sub: 'Preferences & AI',      to: '/settings' },
]

// ── Component ──────────────────────────────────────────────────────────────────────

export default function CommandPalette({ open, onClose, onOpenAI, awardXp }) {
  const navigate = useNavigate()
  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const [epics, setEpics]   = useState([])
  const [habits, setHabits] = useState([])
  const [todayLogged, setTodayLogged] = useState(new Set())
  const [flash, setFlash]   = useState(null) // transient confirmation toast
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  // Load dynamic data when opened
  useEffect(() => {
    if (!open) return
    setQuery(''); setActive(0)
    setTimeout(() => inputRef.current?.focus(), 40)
    if (!window.electronAPI) return
    ;(async () => {
      try {
        const [ep, hb, logs] = await Promise.all([
          window.electronAPI.db.query("SELECT id, name, color, progress FROM epics WHERE status!='done' ORDER BY updated_at DESC", []),
          window.electronAPI.db.query('SELECT id, name, current_streak FROM streak_habits ORDER BY current_streak DESC', []),
          window.electronAPI.db.query("SELECT habit_id FROM streak_logs WHERE logged_date = date('now')", []),
        ])
        setEpics(ep || [])
        setHabits(hb || [])
        setTodayLogged(new Set((logs || []).map(r => r.habit_id)))
      } catch {}
    })()
  }, [open])

  // ── Build command list ──
  const allCommands = useMemo(() => {
    const quickActions = [
      { id: 'qa-ai',       icon: '🤖', label: 'Ask the AI assistant',    sub: 'Open chat',            group: 'Actions', run: () => { onOpenAI?.() } },
      { id: 'qa-newepic',  icon: '✨', label: 'Create a new epic',        sub: 'Define a goal',         group: 'Actions', run: () => navigate('/epics?new=1') },
      { id: 'qa-day',      icon: '🗓️', label: 'Generate my day',          sub: 'AI daily schedule',     group: 'Actions', run: () => navigate('/daily') },
      { id: 'qa-journal',  icon: '✍️', label: "Write today's journal",    sub: 'New diary entry',       group: 'Actions', run: () => navigate('/journal') },
      { id: 'qa-energy',   icon: '⚡', label: 'Log my energy',            sub: 'Daily energy rating',   group: 'Actions', run: () => navigate('/energy') },
      { id: 'qa-reflect',  icon: '🔮', label: 'Reflect on my week',       sub: 'AI journal reflection', group: 'Actions', run: () => navigate('/journal') },
    ]

    const navCmds = NAV_COMMANDS.map(c => ({ ...c, group: 'Navigate', run: () => navigate(c.to) }))

    const epicCmds = epics.map(e => ({
      id: `epic-${e.id}`, icon: '🎯', label: e.name, sub: `Epic · ${e.progress}% complete`,
      group: 'Epics', run: () => navigate(`/epics/${e.id}`),
    }))

    const habitCmds = habits.map(h => ({
      id: `habit-${h.id}`, icon: todayLogged.has(h.id) ? '✅' : '🔥',
      label: `Log: ${h.name}`,
      sub: todayLogged.has(h.id) ? 'Already logged today' : `🔥 ${h.current_streak} day streak · +10 XP`,
      group: 'Log a streak',
      disabled: todayLogged.has(h.id),
      run: async () => {
        if (todayLogged.has(h.id)) return
        try {
          await window.electronAPI.db.run(
            "INSERT OR IGNORE INTO streak_logs (habit_id, logged_date, completed) VALUES (?, date('now'), 1)", [h.id]
          )
          const ns = (h.current_streak || 0) + 1
          await window.electronAPI.db.run(
            'UPDATE streak_habits SET current_streak=?, longest_streak=MAX(longest_streak,?) WHERE id=?',
            [ns, ns, h.id]
          )
          await awardXp?.(10)
          setTodayLogged(prev => new Set([...prev, h.id]))
          setFlash(`🔥 Logged "${h.name}" — ${ns} day streak!`)
          setTimeout(() => setFlash(null), 1800)
        } catch {}
      },
      keepOpen: true,
    }))

    return [...quickActions, ...navCmds, ...epicCmds, ...habitCmds]
  }, [epics, habits, todayLogged, navigate, onOpenAI, awardXp])

  // ── Filter + group ──
  const filtered = useMemo(() => {
    const scored = allCommands
      .map(c => ({ c, score: fuzzyScore(query, c.label + ' ' + (c.sub || '')) }))
      .filter(x => x.score >= 0)
    // Keep stable-ish order: by score desc when querying, else original
    if (query) scored.sort((a, b) => b.score - a.score)
    return scored.map(x => x.c).slice(0, 40)
  }, [allCommands, query])

  // Clamp active index
  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    if (active >= filtered.length) setActive(Math.max(0, filtered.length - 1))
  }, [filtered, active])

  // Scroll active into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function execute(cmd) {
    if (!cmd || cmd.disabled) return
    cmd.run?.()
    if (!cmd.keepOpen) onClose?.()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); execute(filtered[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose?.() }
  }

  if (!open) return null

  // Group for rendering while keeping a flat index for keyboard nav
  let flatIdx = -1
  const groups = []
  const order = ['Actions', 'Navigate', 'Epics', 'Log a streak']
  const seen = new Set()
  const ordered = [
    ...order.flatMap(g => filtered.filter(c => c.group === g)),
    ...filtered.filter(c => !order.includes(c.group)),
  ]
  let lastGroup = null
  for (const cmd of ordered) {
    if (cmd.group !== lastGroup) { groups.push({ header: cmd.group, items: [] }); lastGroup = cmd.group }
    groups[groups.length - 1].items.push(cmd)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center"
      style={{ background: 'rgba(6,23,16,0.55)', backdropFilter: 'blur(4px)', paddingTop: '12vh' }}
      onMouseDown={onClose}
    >
      <div
        className="w-[600px] max-w-[92vw] bg-white overflow-hidden flex flex-col"
        style={{ borderRadius: 14, border: '2px solid #1D9E75', boxShadow: '0 24px 60px rgba(4,35,26,0.45), 5px 5px 0 #085041', maxHeight: '70vh', animation: 'popIn 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Search row */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1.5px solid #e8f5ee' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, epics, habits, or run an action…"
            className="flex-1 text-[14px] font-semibold outline-none text-text-pri placeholder:text-text-hint bg-transparent"
          />
          <kbd className="text-[9px] font-bold px-1.5 py-1 rounded" style={{ background: '#e8f5ee', color: '#4a7060', border: '1px solid #b3e8d3' }}>ESC</kbd>
        </div>

        {/* Flash confirmation */}
        {flash && (
          <div className="px-4 py-2 text-[11px] font-bold" style={{ background: '#eafaf2', color: '#085041', borderBottom: '1px solid #d4f0e6' }}>
            {flash}
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <span className="text-[26px] block mb-2 opacity-40">🔍</span>
              <p className="text-[12px] text-text-hint">No matches for "<span className="font-bold text-text-muted">{query}</span>"</p>
            </div>
          ) : (
            groups.map((grp, gi) => (
              <div key={gi} className="mb-1">
                <p className="px-4 pt-2 pb-1 text-[9px] font-extrabold uppercase tracking-widest text-text-hint">{grp.header}</p>
                {grp.items.map(cmd => {
                  flatIdx++
                  const idx = flatIdx
                  const isActive = idx === active
                  return (
                    <button
                      key={cmd.id}
                      data-idx={idx}
                      disabled={cmd.disabled}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => execute(cmd)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      style={{
                        background: isActive ? '#eafaf2' : 'transparent',
                        borderLeft: isActive ? '3px solid #1D9E75' : '3px solid transparent',
                        opacity: cmd.disabled ? 0.45 : 1,
                        cursor: cmd.disabled ? 'default' : 'pointer',
                      }}
                    >
                      <span className="text-[16px] w-6 text-center flex-shrink-0">{cmd.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-teal-dark truncate">{cmd.label}</p>
                        {cmd.sub && <p className="text-[10px] text-text-hint truncate">{cmd.sub}</p>}
                      </div>
                      {isActive && !cmd.disabled && (
                        <kbd className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#fff', color: '#1D9E75', border: '1px solid #b3e8d3' }}>↵</kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1.5px solid #e8f5ee', background: '#f8fdfb' }}>
          <div className="flex items-center gap-3">
            <FooterHint k="↑↓" label="navigate" />
            <FooterHint k="↵" label="select" />
          </div>
          <span className="text-[9px] font-bold text-text-hint flex items-center gap-1">
            <span className="text-primary">⌘</span> Life OS Command Center
          </span>
        </div>
      </div>
    </div>
  )
}

function FooterHint({ k, label }) {
  return (
    <span className="flex items-center gap-1 text-[9px] font-bold text-text-hint">
      <kbd className="px-1 py-0.5 rounded" style={{ background: '#e8f5ee', color: '#4a7060', border: '1px solid #b3e8d3' }}>{k}</kbd>
      {label}
    </span>
  )
}
