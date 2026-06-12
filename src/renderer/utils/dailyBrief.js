/**
 * Daily brief generation — two modes:
 *   generateBriefTemplate  template fallback (no AI required)
 *   generateBriefWithAI    calls window.electronAPI.ai.chat; throws on failure
 */

function daysUntil(dateStr) {
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000))
}

function timeLabel() {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

export function generateBriefTemplate(topTasks, zeroStreaks, urgentEpics) {
  const sentences = []

  if (urgentEpics.length > 0) {
    const ep   = urgentEpics[0]
    const days = daysUntil(ep.end_date)
    sentences.push(
      `${ep.name} deadline is in ${days} day${days === 1 ? '' : 's'} and you haven't started.`
    )
  }

  if (zeroStreaks.length > 0 && sentences.length < 2) {
    sentences.push(
      `Your ${zeroStreaks[0].name.toLowerCase()} streak needs a check-in today.`
    )
  }

  if (sentences.length === 0) {
    if (topTasks.length > 0) {
      sentences.push(`Your top priority right now: ${topTasks[0].title}.`)
    } else {
      return `Good ${timeLabel()}. Your slate is clear — use it well.`
    }
  }

  sentences.push("Here's what matters most right now.")
  return sentences.slice(0, 3).join(' ')
}

export async function generateBriefWithAI(topTasks, zeroStreaks, urgentEpics, provider, model, ollamaEndpoint) {
  const lines = [`Time of day: ${timeLabel()}.`]

  if (urgentEpics.length > 0) {
    lines.push(
      'Epics nearing deadline with 0% progress: ' +
      urgentEpics.map(e => `"${e.name}" (${daysUntil(e.end_date)}d left)`).join('; ') + '.'
    )
  }

  if (zeroStreaks.length > 0) {
    lines.push(`Habit streaks at 0 today: ${zeroStreaks.map(s => s.name).join(', ')}.`)
  }

  if (topTasks.length > 0) {
    lines.push(
      'Top priority tasks: ' +
      topTasks.map((t, i) => `${i + 1}. "${t.title}" (${t.epic_name})`).join('; ') + '.'
    )
  }

  const text = await window.electronAPI.ai.chat(
    [{ role: 'user', content: lines.join('\n') }],
    provider,
    model,
    ollamaEndpoint || null,
    'You are writing a daily brief for a personal productivity dashboard. Based on the context below, write exactly 2-3 short sentences. Rules: punchy and direct, conversational tone, no bullet points, no markdown, do NOT start with a greeting like "Good morning", plain text only, focus on what is most urgent and actionable.',
  )

  const clean = (text || '').trim()
  if (!clean) throw new Error('empty AI response')
  return clean
}
