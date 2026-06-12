/**
 * Priority Scoring Engine
 *
 * Scores every open subtask and writes the result back to subtasks.priority_score.
 * Call runScoringEngine(db) on app load and every 30 minutes.
 *
 * Score components (all additive):
 *   Deadline  0–100  Linear decay over 90 days; overdue = 100; no deadline = 0
 *   ZeroEpic   +20   Parent epic has 0% progress and is not done
 *   StreakDead +10   Any habit streak is currently at 0 (low-momentum signal)
 *   XP factor  0–N   xp_value / 15 * 10  (default task = 10 pts)
 */

function scoreRow(row, anyStreakAtZero) {
  // ── Deadline score ──────────────────────────────────────────────────────
  let deadlineScore = 0
  const endDate = row.end_date

  if (endDate) {
    const msRemaining  = new Date(endDate).getTime() - Date.now()
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
    deadlineScore = daysRemaining <= 0
      ? 100
      : Math.max(0, Math.round(100 - (daysRemaining / 90) * 100))
  } else {
    // Fallback: estimate days from horizon when end_date is not set
    const horizonEst = { quarter: 45, year: 180, longterm: 365 }
    const est = horizonEst[row.horizon] ?? 365
    deadlineScore = Math.max(0, Math.round(100 - (est / 90) * 100))
  }

  // ── Zero-progress epic boost ────────────────────────────────────────────
  const zeroProgressBoost = (row.epic_progress === 0 && row.epic_status !== 'done') ? 20 : 0

  // ── Streak-at-zero boost ────────────────────────────────────────────────
  const streakBoost = anyStreakAtZero ? 10 : 0

  // ── XP factor ───────────────────────────────────────────────────────────
  const xpValue = row.xp_value ?? 15
  const xpFactor = Math.round((xpValue / 15) * 10)

  return deadlineScore + zeroProgressBoost + streakBoost + xpFactor
}

function runScoringEngine(db) {
  try {
    const openTasks = db.prepare(`
      SELECT
        s.id,
        COALESCE(s.xp_value, 15) AS xp_value,
        e.progress  AS epic_progress,
        e.status    AS epic_status,
        e.end_date  AS end_date,
        e.horizon   AS horizon
      FROM subtasks s
      JOIN epics e ON e.id = s.epic_id
      WHERE s.status != 'done'
        AND e.status  != 'done'
    `).all()

    const anyStreakAtZero = db.prepare(
      `SELECT COUNT(*) AS c FROM streak_habits WHERE current_streak = 0`
    ).get().c > 0

    const updateScore = db.prepare(
      `UPDATE subtasks SET priority_score = ? WHERE id = ?`
    )

    const applyScores = db.transaction(() => {
      for (const row of openTasks) {
        updateScore.run(scoreRow(row, anyStreakAtZero), row.id)
      }
    })
    applyScores()
  } catch (err) {
    // Non-fatal — scoring is best-effort
    console.error('[scoringEngine] error:', err.message)
  }
}

/**
 * Returns the top N open tasks sorted by priority_score descending.
 * Each row includes task fields plus parent epic name, color, deadline, and progress.
 */
function getTopTasks(db, n = 5) {
  try {
    return db.prepare(`
      SELECT
        s.id,
        s.title,
        s.status,
        s.due_date,
        s.priority_score,
        COALESCE(s.xp_value, 15) AS xp_value,
        e.id       AS epic_id,
        e.name     AS epic_name,
        e.color    AS epic_color,
        e.end_date AS end_date,
        e.horizon  AS horizon,
        e.progress AS epic_progress,
        e.status   AS epic_status
      FROM subtasks s
      JOIN epics e ON e.id = s.epic_id
      WHERE s.status  != 'done'
        AND s.parent_id IS NULL
        AND e.status  != 'done'
      ORDER BY s.priority_score DESC
      LIMIT ?
    `).all(n)
  } catch (err) {
    console.error('[scoringEngine] getTopTasks error:', err.message)
    return []
  }
}

module.exports = { runScoringEngine, getTopTasks }
