'use strict'

/**
 * Assistant Memory — behavioral pattern detector.
 *
 * Detects three patterns from existing task/habit data and writes them to
 * the assistant_memory table. Runs once per calendar day on app open.
 *
 * Patterns:
 *   productive_hour    — hour of day when tasks are most often completed
 *   workout_skip_day   — weekday most often skipped for workout habits (if any exist)
 *   deadline_start_lead — avg days before epic deadline the user first completes a task
 */

const WORKOUT_KEYWORDS = [
  'workout', 'exercise', 'gym', 'run', 'running', 'fitness',
  'training', 'yoga', 'swim', 'sport', 'lift', 'cardio', 'jog', 'walk', 'hike',
]

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function isWorkoutRelated(name) {
  const lower = (name || '').toLowerCase()
  return WORKOUT_KEYWORDS.some(kw => lower.includes(kw))
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// Upsert a pattern row. first_observed is set only on first INSERT and preserved after.
function upsert(db, patternType, description, confidence, occurrenceCount) {
  const now = today()
  db.prepare(`
    INSERT INTO assistant_memory
      (pattern_type, description, confidence, first_observed, last_observed, occurrence_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(pattern_type) DO UPDATE SET
      description      = excluded.description,
      confidence       = excluded.confidence,
      last_observed    = excluded.last_observed,
      occurrence_count = excluded.occurrence_count
  `).run(patternType, description, confidence, now, now, occurrenceCount)
}

// ── Pattern 1: Most productive hour ─────────────────────────────────────────
function detectProductiveHour(db) {
  const best = db.prepare(`
    SELECT strftime('%H', completed_at) AS hour, COUNT(*) AS cnt
    FROM subtasks
    WHERE completed_at IS NOT NULL
    GROUP BY hour
    ORDER BY cnt DESC
    LIMIT 1
  `).get()

  if (!best) return

  const total = db.prepare(
    `SELECT COUNT(*) AS c FROM subtasks WHERE completed_at IS NOT NULL`
  ).get().c

  const h     = parseInt(best.hour, 10)
  const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
  const conf  = parseFloat(Math.min(1.0, total / 20).toFixed(2))

  upsert(
    db,
    'productive_hour',
    `Tasks are most frequently completed around ${label} (${best.cnt} of ${total} completions)`,
    conf,
    total,
  )
}

// ── Pattern 2: Most common skip day for workout habits ───────────────────────
function detectWorkoutSkipDay(db) {
  const habits = db.prepare('SELECT id, name FROM streak_habits').all()
  const workoutHabits = habits.filter(h => isWorkoutRelated(h.name))

  if (workoutHabits.length === 0) return // no workout data — skip per spec

  const ids          = workoutHabits.map(h => h.id)
  const placeholders = ids.map(() => '?').join(',')

  // Count completions per day-of-week across all workout habits
  const byDow = db.prepare(`
    SELECT strftime('%w', logged_date) AS dow, COUNT(*) AS cnt
    FROM streak_logs
    WHERE habit_id IN (${placeholders})
      AND completed = 1
    GROUP BY dow
  `).all(...ids)

  const totalLogs = byDow.reduce((s, r) => s + r.cnt, 0)
  if (totalLogs === 0) return

  // Build a full map 0–6 (fill missing days with 0)
  const dowMap = {}
  for (let d = 0; d <= 6; d++) dowMap[d] = 0
  for (const r of byDow) dowMap[parseInt(r.dow, 10)] = r.cnt

  // The day with the fewest entries is the most skipped
  let minDay = 0
  let minCnt = Infinity
  for (let d = 0; d <= 6; d++) {
    if (dowMap[d] < minCnt) { minCnt = dowMap[d]; minDay = d }
  }

  const conf = parseFloat(Math.min(1.0, totalLogs / 30).toFixed(2))

  upsert(
    db,
    'workout_skip_day',
    `${DOW_NAMES[minDay]} is the most frequently skipped day for workout habits (${minCnt} logged vs ${Math.round(totalLogs / 7)} avg per weekday)`,
    conf,
    totalLogs,
  )
}

// ── Pattern 3: Average lead-time before epic deadline ────────────────────────
function detectDeadlineStartLead(db) {
  // For each epic that has an end_date and at least one completed task,
  // compute: end_date - MIN(completed_at)  (days before deadline user first acted)
  const rows = db.prepare(`
    SELECT
      e.id,
      CAST(julianday(e.end_date) - julianday(MIN(s.completed_at)) AS INTEGER) AS days_before
    FROM epics e
    JOIN subtasks s ON s.epic_id = e.id
    WHERE e.end_date      IS NOT NULL
      AND s.completed_at  IS NOT NULL
    GROUP BY e.id
    HAVING days_before > 0
  `).all()

  if (rows.length === 0) return

  const avg     = rows.reduce((s, r) => s + r.days_before, 0) / rows.length
  const rounded = Math.round(avg)
  const conf    = parseFloat(Math.min(1.0, rows.length / 5).toFixed(2))

  upsert(
    db,
    'deadline_start_lead',
    `On average you begin making progress ${rounded} day${rounded === 1 ? '' : 's'} before an epic deadline (based on ${rows.length} epic${rows.length === 1 ? '' : 's'})`,
    conf,
    rows.length,
  )
}

// ── Public API ───────────────────────────────────────────────────────────────

function updatePatterns(db) {
  detectProductiveHour(db)
  detectWorkoutSkipDay(db)
  detectDeadlineStartLead(db)
}

/**
 * Checks whether the patterns have already been updated today (via the
 * last_memory_update settings key). If not, runs all detectors and stamps today.
 */
function runDailyMemoryUpdate(db) {
  try {
    const stamp = db.prepare(
      `SELECT value FROM settings WHERE key = 'last_memory_update'`
    ).get()

    if (stamp?.value === today()) return // already ran today

    updatePatterns(db)

    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('last_memory_update', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(today())
  } catch (err) {
    console.error('[assistantMemory] runDailyMemoryUpdate error:', err.message)
  }
}

module.exports = { runDailyMemoryUpdate, updatePatterns }
