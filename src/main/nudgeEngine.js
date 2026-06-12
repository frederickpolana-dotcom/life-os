'use strict'
/**
 * Nudge Engine — sends native desktop notifications at smart moments.
 *
 * Four nudge types:
 *   morning       08:00 daily — sends the daily brief text
 *   streak_risk   20:00 daily — one per unlogged habit streak
 *   idle          after 2h with no task completions
 *   deadline_7d   one-time when an epic enters ≤7d window with <20% progress
 *
 * Each sent nudge is recorded in nudge_log (unique key) to prevent duplicates.
 * All nudges respect the nudge_dnd setting (when 'true', all notifications skip).
 */

const { Notification } = require('electron')

let mainWindowRef  = null
let lastActivityAt = Date.now()   // reset on task completion via recordActivity()

function today() {
  return new Date().toISOString().slice(0, 10)
}

function openApp() {
  if (!mainWindowRef) return
  if (mainWindowRef.isMinimized()) mainWindowRef.restore()
  mainWindowRef.show()
  mainWindowRef.focus()
}

function isDndOn(db) {
  return db.prepare("SELECT value FROM settings WHERE key = 'nudge_dnd'").get()?.value === 'true'
}

function alreadySent(db, key) {
  return !!db.prepare('SELECT id FROM nudge_log WHERE nudge_key = ?').get(key)
}

function markSent(db, key) {
  db.prepare('INSERT OR IGNORE INTO nudge_log (nudge_key) VALUES (?)').run(key)
}

function send(title, body, onClick) {
  if (!Notification.isSupported()) return
  const n = new Notification({ title, body })
  n.on('click', onClick || openApp)
  n.show()
}

// ── (1) Morning nudge ────────────────────────────────────────────────────────
function checkMorning(db) {
  if (isDndOn(db)) return
  if (new Date().getHours() !== 8) return

  const key = `morning_${today()}`
  if (alreadySent(db, key)) return

  const brief = db.prepare("SELECT value FROM settings WHERE key = 'daily_brief_text'").get()?.value
  send(
    'Life OS — Good morning',
    brief || "Here's your day. Open Life OS to see what matters most.",
    openApp,
  )
  markSent(db, key)
}

// ── (2) Streak risk nudge ────────────────────────────────────────────────────
function checkStreakRisk(db) {
  if (isDndOn(db)) return
  if (new Date().getHours() < 20) return

  const habits = db.prepare('SELECT id, name FROM streak_habits').all()
  const loggedToday = new Set(
    db.prepare("SELECT habit_id FROM streak_logs WHERE logged_date = date('now')").all()
      .map(r => r.habit_id)
  )

  for (const habit of habits) {
    if (loggedToday.has(habit.id)) continue

    const key = `streak_risk_${habit.id}_${today()}`
    if (alreadySent(db, key)) continue

    send(
      'Life OS — Streak at risk',
      `Your ${habit.name} streak needs a check-in before midnight.`,
      openApp,
    )
    markSent(db, key)
  }
}

// ── (3) Idle nudge ───────────────────────────────────────────────────────────
function checkIdle(db) {
  if (isDndOn(db)) return

  const idleMs = Date.now() - lastActivityAt
  if (idleMs < 2 * 60 * 60 * 1000) return  // less than 2 hours idle

  // Bucket into 4-hour windows so the nudge can resurface after they act
  const bucket = Math.floor(Date.now() / (4 * 60 * 60 * 1000))
  const key    = `idle_${bucket}`
  if (alreadySent(db, key)) return

  send(
    'Life OS — Still there?',
    "You've been at it for 2 hours — want to log a task?",
    openApp,
  )
  markSent(db, key)
}

// ── (4) Deadline nudge ───────────────────────────────────────────────────────
function checkDeadlines(db) {
  if (isDndOn(db)) return

  const approaching = db.prepare(`
    SELECT id, name, progress,
      CAST(julianday(end_date) - julianday('now') AS INTEGER) AS days_left
    FROM epics
    WHERE end_date  IS NOT NULL
      AND status    != 'done'
      AND progress  <  20
      AND CAST(julianday(end_date) - julianday('now') AS INTEGER) BETWEEN 0 AND 7
  `).all()

  for (const epic of approaching) {
    const key = `deadline_7d_${epic.id}`
    if (alreadySent(db, key)) continue

    const d = epic.days_left
    send(
      'Life OS — Deadline approaching',
      `"${epic.name}" is in ${d} day${d === 1 ? '' : 's'} and you're at ${epic.progress}% progress.`,
      openApp,
    )
    markSent(db, key)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Call from the xp:award IPC handler whenever the user completes a task. */
function recordActivity() {
  lastActivityAt = Date.now()
}

/** Sets up the 1-minute heartbeat and wires the main window reference. */
function initNudgeEngine(db, mainWindow) {
  mainWindowRef  = mainWindow
  lastActivityAt = Date.now()

  function run() {
    try {
      checkMorning(db)
      checkStreakRisk(db)
      checkIdle(db)
      checkDeadlines(db)
    } catch (err) {
      console.error('[nudgeEngine]', err.message)
    }
  }

  // Slight delay on startup so the window is fully ready
  setTimeout(run, 8_000)
  setInterval(run, 60_000)
}

module.exports = { initNudgeEngine, recordActivity }
