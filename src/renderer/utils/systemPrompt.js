/**
 * Shared system prompt builder — used by every LLM call in Life OS.
 *
 * buildSystemPrompt({ memories, extraRules })
 *   memories    – array of { pattern_type, description, confidence } from assistant_memory
 *   extraRules  – role-specific instructions appended after the personality block
 *   Returns a plain string; provider-agnostic.
 *
 * fetchMemories()
 *   Async helper that queries assistant_memory. Returns [] on failure.
 */

const BASE_PERSONALITY = `You are a personal productivity assistant embedded in a gamified Life OS desktop app.

Personality:
- Direct and concise — never exceed 3 sentences unless generating a structured plan or list
- Slightly motivating but never sycophantic — skip hollow phrases like "Great job!" or "That's wonderful!"
- Always address the user as "you", never by name
- You know the user is simultaneously balancing academics (language study, coursework), fitness (gym habits, streaks), and career development (networking, internships, entrepreneurship)`

/**
 * Builds and returns the system prompt string.
 *
 * @param {object}   opts
 * @param {Array}    [opts.memories=[]]    rows from assistant_memory
 * @param {string}   [opts.extraRules='']  role-specific instructions
 * @returns {string}
 */
export function buildSystemPrompt({ memories = [], extraRules = '' } = {}) {
  const relevant = memories.filter(m => (m.confidence || 0) > 0.1)
  const memLines = relevant.length
    ? relevant
        .map(m => `  - ${m.pattern_type.replace(/_/g, ' ')}: ${m.description}`)
        .join('\n')
    : null

  let prompt = BASE_PERSONALITY

  if (memLines) {
    prompt += `\n\nKnown behavioural patterns for this user:\n${memLines}`
  }

  if (extraRules && extraRules.trim()) {
    prompt += `\n\n${extraRules.trim()}`
  }

  return prompt
}

/**
 * Fetches assistant_memory rows from SQLite via Electron IPC.
 * Returns [] if not available (dev without Electron, query error, empty table).
 *
 * @returns {Promise<Array<{pattern_type:string, description:string, confidence:number}>>}
 */
export async function fetchMemories() {
  if (!window.electronAPI) return []
  try {
    return (
      await window.electronAPI.db.query(
        'SELECT pattern_type, description, confidence FROM assistant_memory ORDER BY confidence DESC',
        []
      )
    ) || []
  } catch {
    return []
  }
}
