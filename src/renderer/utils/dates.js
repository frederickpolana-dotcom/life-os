// Pass epic.end_date as first arg (takes priority), fall back to horizon computation
export function getHorizonDeadline(horizon, endDate) {
  if (endDate) return new Date(endDate)

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-indexed

  if (horizon === 'quarter') {
    const qEndMonth = [2, 2, 2, 5, 5, 5, 8, 8, 8, 11, 11, 11][m]
    return new Date(y, qEndMonth + 1, 0)
  }
  if (horizon === 'year') {
    return new Date(y, 11, 31)
  }
  if (horizon === 'longterm') {
    return new Date(y + 3, m, now.getDate())
  }
  return null
}

// Compute end_date string from preset label (e.g. "2 months" → "2026-08-11")
export function presetToEndDate(preset) {
  const DAYS = { '2 weeks': 14, '1 month': 30, '2 months': 60, '3 months': 90, '6 months': 182, '1 year': 365, 'long term': 1095 }
  const days = DAYS[preset]
  if (!days) return ''
  const d = new Date(Date.now() + days * 86400000)
  return d.toISOString().split('T')[0]
}

// Derive horizon category from an end_date string
export function endDateToHorizon(endDateStr) {
  if (!endDateStr) return 'quarter'
  const days = daysUntil(new Date(endDateStr))
  if (days <= 120) return 'quarter'
  if (days <= 400) return 'year'
  return 'longterm'
}

export function getQuarterLabel(date) {
  const d = new Date(date)
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
}

export function daysUntil(date) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const d   = new Date(date); d.setHours(0, 0, 0, 0)
  return Math.ceil((d - now) / 86400000)
}

export function fmtDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtDateFull(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Returns hex color based on urgency
export function deadlineColor(days) {
  if (days < 0)   return '#ef4444' // overdue
  if (days <= 7)  return '#ef4444' // < 1 week
  if (days <= 30) return '#EF9F27' // < 1 month
  return '#1D9E75'                 // healthy
}
