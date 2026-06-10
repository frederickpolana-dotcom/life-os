const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')
const { app } = require('electron')

let db = null

function getMachineKey() {
  const raw = `${os.hostname()}-${os.userInfo().username}`
  return Buffer.from(raw)
}

function xorEncrypt(text) {
  if (!text) return ''
  const key = getMachineKey()
  const buf = Buffer.from(text, 'utf8')
  const out = Buffer.alloc(buf.length)
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ key[i % key.length]
  }
  return out.toString('base64')
}

function xorDecrypt(encoded) {
  if (!encoded) return ''
  try {
    const buf = Buffer.from(encoded, 'base64')
    const key = getMachineKey()
    const out = Buffer.alloc(buf.length)
    for (let i = 0; i < buf.length; i++) {
      out[i] = buf[i] ^ key[i % key.length]
    }
    return out.toString('utf8')
  } catch {
    return ''
  }
}

function getDb() {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'lifeos.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS epics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'bolt',
      color TEXT DEFAULT 'teal',
      horizon TEXT DEFAULT 'quarter',
      status TEXT DEFAULT 'not_started',
      progress INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      epic_id INTEGER REFERENCES epics(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurrence TEXT,
      status TEXT DEFAULT 'not_started',
      due_date DATE,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS streak_habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'flame',
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS streak_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER REFERENCES streak_habits(id) ON DELETE CASCADE,
      logged_date DATE NOT NULL,
      completed INTEGER DEFAULT 1,
      UNIQUE(habit_id, logged_date)
    );

    CREATE TABLE IF NOT EXISTS time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start DATE NOT NULL UNIQUE,
      deep_work_hours REAL DEFAULT 0,
      learning_hours REAL DEFAULT 0,
      admin_hours REAL DEFAULT 0,
      social_hours REAL DEFAULT 0,
      rest_hours REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      company TEXT,
      relationship_type TEXT DEFAULT 'other',
      last_contact_date DATE,
      next_action TEXT,
      next_action_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weekly_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start DATE NOT NULL UNIQUE,
      what_worked TEXT,
      what_didnt TEXT,
      dropping_this_week TEXT,
      focus_next_week TEXT,
      energy_rating INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS energy_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_date DATE NOT NULL UNIQUE,
      energy_rating INTEGER NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      messages TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  seedIfEmpty()
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM settings').get()
  if (count.c > 0) return

  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
  const defaults = [
    ['user_name',              ''],
    ['user_initials',          ''],
    ['ai_provider',            'anthropic'],
    ['ai_model',               'claude-sonnet-4-20250514'],
    ['ai_api_key',             ''],
    ['ollama_endpoint',        'http://localhost:11434'],
    ['ollama_model',           'llama3'],
    ['openai_api_key',         ''],
    ['gemini_api_key',         ''],
    ['launch_on_startup',      'true'],
    ['start_minimized',        'true'],
    ['weekly_review_reminder', 'true'],
    ['reminder_time',          '20:00'],
    ['xp_total',               '0'],
    ['xp_level',               '1'],
    ['onboarding_complete',    'false'],
  ]
  const seedSettings = db.transaction(() => {
    for (const [k, v] of defaults) insertSetting.run(k, v)
  })
  seedSettings()

  db.exec(`
    INSERT INTO streak_habits (name, description, icon, current_streak, longest_streak) VALUES
      ('Mandarin study',    '1 hour of HSK study per day',                        'language',  14, 14),
      ('IDX market review', 'Daily review of Indonesian equity positions',          'chart-bar',  7,  7),
      ('Cold outreach',     'Send at least 1 networking message per day',           'mail',       3,  3);

    INSERT INTO epics (name, description, icon, color, horizon, status, progress) VALUES
      ('HSK 5 before Dec 2026',        'Achieve HSK 5 certification to unlock Mandarin-language career opportunities in China', 'language',  'teal',   'year',    'in_progress',  42),
      ('Land finance internship Q3',   'Secure a finance/IB internship in Jakarta or Shanghai by end of Q3 2026',               'briefcase', 'amber',  'quarter', 'in_progress',  28),
      ('TaniRantai next funding round','Prepare pitch deck and approach seed investors for TaniRantai Series A',                 'plant-2',   'purple', 'year',    'not_started',   0);
  `)

  const epicIds = db.prepare('SELECT id, name FROM epics').all()
  const hsk  = epicIds.find(e => e.name.startsWith('HSK'))
  const ib   = epicIds.find(e => e.name.startsWith('Land'))
  const tani = epicIds.find(e => e.name.startsWith('TaniRantai'))

  const insertSubtask = db.prepare(
    `INSERT INTO subtasks (epic_id, title, status) VALUES (?, ?, ?)`
  )
  const seedSubtasks = db.transaction(() => {
    insertSubtask.run(hsk.id,  'Complete HSK 5 vocab deck (2500 words)', 'in_progress')
    insertSubtask.run(hsk.id,  'Finish grammar workbook chapters 1-10',  'done')
    insertSubtask.run(hsk.id,  'Weekly 1hr iTalki session',              'in_progress')
    insertSubtask.run(hsk.id,  'Mock exam every 4 weeks',                'not_started')

    insertSubtask.run(ib.id,   'Research 20 target firms in Jakarta/Shanghai', 'done')
    insertSubtask.run(ib.id,   'Send 5 cold emails per week',                  'in_progress')
    insertSubtask.run(ib.id,   'Prepare STAR story answers',                   'in_progress')
    insertSubtask.run(ib.id,   'Polish resume + LinkedIn',                     'not_started')

    insertSubtask.run(tani.id, 'Define Series A thesis',                       'not_started')
    insertSubtask.run(tani.id, 'Build financial model',                        'not_started')
    insertSubtask.run(tani.id, 'Identify 10 seed investors',                   'not_started')
  })
  seedSubtasks()

  recalcAllProgress()
}

function recalcAllProgress() {
  const epics = db.prepare('SELECT id FROM epics').all()
  const update = db.prepare('UPDATE epics SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  const count  = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done FROM subtasks WHERE epic_id = ? AND parent_id IS NULL")

  const recalc = db.transaction(() => {
    for (const epic of epics) {
      const row = count.get(epic.id)
      const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0
      update.run(pct, epic.id)
    }
  })
  recalc()
}

// ─── Public API (called from IPC handlers) ────────────────────────────────

function query(sql, params = []) {
  return getDb().prepare(sql).all(...params)
}

function run(sql, params = []) {
  const result = getDb().prepare(sql).run(...params)
  return { lastInsertRowid: result.lastInsertRowid, changes: result.changes }
}

function get(sql, params = []) {
  return getDb().prepare(sql).get(...params)
}

function getSetting(key) {
  const row = get('SELECT value FROM settings WHERE key = ?', [key])
  return row ? row.value : null
}

function setSetting(key, value) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value])
}

function getDecryptedApiKey(provider) {
  const keyMap = { anthropic: 'ai_api_key', openai: 'openai_api_key', gemini: 'gemini_api_key' }
  const settingKey = keyMap[provider]
  if (!settingKey) return ''
  const encrypted = getSetting(settingKey)
  return xorDecrypt(encrypted)
}

function setEncryptedApiKey(provider, plaintext) {
  const keyMap = { anthropic: 'ai_api_key', openai: 'openai_api_key', gemini: 'gemini_api_key' }
  const settingKey = keyMap[provider]
  if (!settingKey) return
  setSetting(settingKey, xorEncrypt(plaintext))
}

function exportAllData() {
  const d = getDb()
  return {
    epics:          d.prepare('SELECT * FROM epics').all(),
    subtasks:       d.prepare('SELECT * FROM subtasks').all(),
    streak_habits:  d.prepare('SELECT * FROM streak_habits').all(),
    streak_logs:    d.prepare('SELECT * FROM streak_logs').all(),
    time_logs:      d.prepare('SELECT * FROM time_logs').all(),
    contacts:       d.prepare('SELECT * FROM contacts').all(),
    weekly_reviews: d.prepare('SELECT * FROM weekly_reviews').all(),
    energy_logs:    d.prepare('SELECT * FROM energy_logs').all(),
    settings:       d.prepare("SELECT key, value FROM settings WHERE key NOT LIKE '%api_key%'").all(),
    exported_at:    new Date().toISOString(),
  }
}

module.exports = {
  getDb,
  query,
  run,
  get,
  getSetting,
  setSetting,
  getDecryptedApiKey,
  setEncryptedApiKey,
  exportAllData,
  xorEncrypt,
  recalcAllProgress,
}
