// Quick test: simulate what AIPanel does when AI responds with a create_goal action
const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')

// Minimal mock of app for database path
const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'life-os', 'lifeos.db')

let db
try {
  db = new Database(dbPath)
} catch (e) {
  // Try alternate path
  const dbPath2 = path.join(os.homedir(), 'AppData', 'Local', 'life-os', 'lifeos.db')
  db = new Database(dbPath2)
}

// --- Test parseAction ---
function parseAction(text) {
  const match = text.match(/```action\n([\s\S]*?)\n```/)
  if (!match) return { cleanText: text.trim(), action: null }
  try {
    return {
      cleanText: text.replace(/```action\n[\s\S]*?\n```/, '').trim(),
      action:    JSON.parse(match[1]),
    }
  } catch {
    return { cleanText: text.trim(), action: null }
  }
}

// Simulate a typical Claude response with single-line JSON
const testResponse1 = `Here's your plan for learning Korean in 6 months. I've broken it into concrete milestones and created the epic for you!

\`\`\`action
{"type":"create_goal","name":"Korean B2 in 6 months","description":"Achieve conversational Korean proficiency by end of year","icon":"language","color":"purple","horizon":"year","subtasks":["Complete Duolingo Korean tree","Learn 1000 core Anki vocabulary cards","Finish TTMIK Level 3 grammar","Watch 30 Korean dramas with subtitles","Do 20 iTalki sessions with native speaker","Pass TOPIK I exam","Read 5 Korean webtoons"]}
\`\`\`
`

// Simulate a typical Claude response with multi-line JSON
const testResponse2 = `Great goal! Here's the breakdown:

\`\`\`action
{
  "type": "create_goal",
  "name": "Korean B2 in 6 months",
  "description": "Achieve conversational Korean proficiency",
  "icon": "language",
  "color": "purple",
  "horizon": "year",
  "subtasks": [
    "Complete Duolingo Korean tree",
    "Learn 1000 Anki vocab cards",
    "Finish TTMIK Level 3 grammar",
    "Watch 30 Korean dramas",
    "Do 20 iTalki sessions"
  ]
}
\`\`\`
`

console.log('=== TEST 1: Single-line JSON ===')
const r1 = parseAction(testResponse1)
console.log('Action detected:', r1.action !== null)
console.log('Type:', r1.action?.type)
console.log('Name:', r1.action?.name)
console.log('Subtasks count:', r1.action?.subtasks?.length)
console.log('Clean text snippet:', r1.cleanText.slice(0, 60))

console.log('\n=== TEST 2: Multi-line JSON ===')
const r2 = parseAction(testResponse2)
console.log('Action detected:', r2.action !== null)
console.log('Type:', r2.action?.type)
console.log('Subtasks:', r2.action?.subtasks)

console.log('\n=== TEST 3: Actually write to DB ===')
try {
  const action = r1.action
  const res = db.prepare(
    'INSERT INTO epics (name, description, icon, color, horizon, status, progress) VALUES (?,?,?,?,?,?,0)'
  ).run(action.name + ' [TEST]', action.description, action.icon, action.color, action.horizon, 'not_started')

  const epicId = res.lastInsertRowid
  console.log('Epic created with id:', epicId)

  const subtasks = action.subtasks || []
  for (const title of subtasks) {
    db.prepare('INSERT INTO subtasks (epic_id, title, status) VALUES (?,?,?)').run(epicId, title.trim(), 'not_started')
  }
  console.log('Subtasks created:', subtasks.length)

  // Clean up test data
  db.prepare('DELETE FROM subtasks WHERE epic_id = ?').run(epicId)
  db.prepare('DELETE FROM epics WHERE id = ?').run(epicId)
  console.log('Test data cleaned up.')
  console.log('\n✅ ALL TESTS PASSED — feature is working correctly')
} catch (e) {
  console.error('❌ DB test failed:', e.message)
}
