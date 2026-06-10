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

// Test 1: single-line JSON
const t1 = 'Here is your plan!\n```action\n{"type":"create_goal","name":"Learn Korean","subtasks":["Task A","Task B","Task C"]}\n```\n'
const r1 = parseAction(t1)
console.log('Test 1 (single-line):', r1.action !== null ? '✅' : '❌', '| type:', r1.action?.type, '| subtasks:', r1.action?.subtasks?.length)

// Test 2: multi-line JSON
const t2 = 'Plan:\n```action\n{\n  "type": "create_goal",\n  "name": "Learn Korean",\n  "subtasks": ["Task A","Task B"]\n}\n```'
const r2 = parseAction(t2)
console.log('Test 2 (multi-line):', r2.action !== null ? '✅' : '❌', '| subtasks:', r2.action?.subtasks)

// Test 3: no action block
const r3 = parseAction('Just a normal reply.')
console.log('Test 3 (no action):', r3.action === null ? '✅' : '❌')

// Test 4: full realistic Claude response
const t4 = `Breaking down "I want to get fit" into 6 concrete milestones. Creating your epic now!

\`\`\`action
{"type":"create_goal","name":"Get Fit by December","description":"Build a consistent workout habit and reach target body composition","icon":"flame","color":"amber","horizon":"year","subtasks":["Join a gym or set up home workout space","Complete 30-day beginner workout program","Hit 3x/week gym consistency for 8 weeks","Learn basic nutrition and track macros for 2 weeks","Run 5km without stopping","Reach target weight/body fat goal","Maintain 90-day streak on fitness habits"]}
\`\`\`

I've also navigated you to the new epic page so you can see all the tasks!`

const r4 = parseAction(t4)
console.log('Test 4 (realistic):', r4.action !== null ? '✅' : '❌', '| name:', r4.action?.name, '| subtasks:', r4.action?.subtasks?.length)
console.log('  Clean text:', r4.cleanText.slice(0, 80) + '...')
