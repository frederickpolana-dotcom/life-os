# Life OS — Gamified Electron Desktop App

A personal productivity operating system built as an Electron desktop app. Gamifies life management: Epics (big goals), daily Streaks (habits), Time Audit, Network CRM, Weekly Review, and Energy Log — all tied to an XP / leveling system with retro game aesthetics.

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Runtime | Electron 31 |
| UI framework | React 18 |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Database | better-sqlite3 |
| Charts | Recharts |
| Confetti | canvas-confetti |
| Icons | Tabler Icons (SVG via JSX) |
| Router | React Router v6 (MemoryRouter — required for Electron file:// protocol) |

---

## Design System

### Colors (Tailwind custom tokens + raw hex)

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#1D9E75` | Primary teal, CTAs, active states |
| `teal-dark` | `#085041` | Dark teal text, headings |
| `teal-med` | `#2a8a67` | Medium teal, hover states |
| `teal-border` | `#b3e8d3` | Light teal borders |
| `teal-light` | `#e8f8f1` | Very light teal backgrounds |
| `amber` | `#EF9F27` | Amber accent (warnings, XP coins) |
| `amber-dark` | `#a65c00` | Dark amber shadows/text |
| `purple` | `#7F77DD` | Purple accent |
| `purple-dark` | `#3d3a9e` | Dark purple shadows/text |
| `green-done` | `#22c55e` | Completed states |
| `text-muted` | `#4a7060` | Secondary text |
| `text-hint` | `#9bbdaa` | Hint / placeholder text |
| Game chrome bg | `#061710` | Sidebar + Topbar dark background |
| App outer bg | `#0d1f14` | Outermost shell background |
| Content bg | `#f4fdf8` | Main content area (light) |

### Typography
- Font: **Nunito** (Google Fonts, loaded in `index.html`)
- Base: 14px, line-height 1.6

### Retro card style (`.retro-card`)
- `border: 2px solid #1D9E75`
- `box-shadow: 3px 3px 0 #085041` (hard drop shadow, no blur = pixel-art look)
- Hover: `translate(-1px, -1px)` + shadow expands to `4px 4px 0`
- Amber variant: `.retro-card-amber` (`#EF9F27` / `#a65c00`)
- Purple variant: `.retro-card-purple` (`#7F77DD` / `#3d3a9e`)

### Game chrome pattern
- Sidebar + Topbar: dark `#061710` (the "bezel")
- Content area: light `#f4fdf8` (the "screen")
- `.game-bg`: radial dot pattern `rgba(29,158,117,0.07)` on content area

---

## SQLite Schema (all 9 tables)

```sql
CREATE TABLE IF NOT EXISTS epics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'bolt',
  color TEXT DEFAULT 'teal',           -- 'teal' | 'amber' | 'purple'
  horizon TEXT DEFAULT 'quarter',      -- 'quarter' | 'year' | 'longterm'
  status TEXT DEFAULT 'not_started',   -- 'not_started' | 'in_progress' | 'done'
  progress INTEGER DEFAULT 0,          -- 0–100, recalculated from subtasks
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
  status TEXT DEFAULT 'not_started',   -- 'not_started' | 'in_progress' | 'done'
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
  relationship_type TEXT DEFAULT 'other',  -- 'mentor' | 'peer' | 'lead' | 'other'
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
  energy_rating INTEGER,               -- 1–5
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS energy_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_date DATE NOT NULL UNIQUE,
  energy_rating INTEGER NOT NULL,      -- 1–5
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Bonus tables (added during Phase 3 / AI work):
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  messages TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,                  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Created at runtime by their owning page (CREATE TABLE IF NOT EXISTS via IPC):

-- subtasks gains is_recurring=1 for "Daily Checklist" tasks; one row per day they're ticked:
CREATE TABLE IF NOT EXISTS recurring_completions (   -- EpicDetail.jsx / Dashboard.jsx
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  UNIQUE(subtask_id, completed_date)
);

CREATE TABLE IF NOT EXISTS journal_entries (         -- Journal.jsx
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date DATE NOT NULL UNIQUE,
  content TEXT,
  mood INTEGER,                       -- 1–5
  highlight TEXT, gratitude TEXT, challenge TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_reflections (     -- Journal.jsx (cached AI recaps)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  range_type TEXT NOT NULL,           -- '7' | '30'
  end_date DATE NOT NULL,
  narrative TEXT, mood_arc TEXT, patterns TEXT, insight TEXT,
  fingerprint TEXT,                   -- cache key; regenerate only when entries change
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(range_type, end_date)
);

CREATE TABLE IF NOT EXISTS daily_schedules (         -- Daily.jsx ("Generate my day")
  schedule_date DATE PRIMARY KEY,
  blocks TEXT NOT NULL                -- JSON array of time blocks
);

CREATE TABLE IF NOT EXISTS weekly_ai_reviews (       -- WeeklyReview.jsx (cached AI review)
  week_start DATE PRIMARY KEY,
  summary TEXT, biggest_win TEXT, biggest_gap TEXT, reflective_questions TEXT,
  data_fingerprint TEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Settings keys (seeded defaults)

| Key | Default | Notes |
|---|---|---|
| `user_name` | `'Polana'` | Display name |
| `user_initials` | `'PK'` | Avatar initials |
| `ai_provider` | `'anthropic'` | `'anthropic'` \| `'openai'` \| `'gemini'` \| `'ollama'` |
| `ai_model` | `'claude-sonnet-4-20250514'` | |
| `ai_api_key` | `''` | XOR-encrypted at rest |
| `ollama_endpoint` | `'http://localhost:11434'` | |
| `ollama_model` | `'llama3'` | |
| `openai_api_key` | `''` | XOR-encrypted |
| `gemini_api_key` | `''` | XOR-encrypted |
| `launch_on_startup` | `'true'` | |
| `start_minimized` | `'false'` | |
| `weekly_review_reminder` | `'true'` | |
| `reminder_time` | `'20:00'` | |
| `xp_total` | `'0'` | Cumulative XP |
| `xp_level` | `'1'` | Current level 1–5 |

---

## XP Gamification Rules

### Earning XP

| Action | XP |
|---|---|
| Log a daily streak habit | +10 XP |
| Complete a subtask | +15 XP |
| Create a new Epic | +20 XP |
| Complete an entire Epic | +50 XP |
| Submit a Weekly Review | +25 XP |
| Log energy for the day | +5 XP |
| Write a journal entry (first per day) | +8 XP |
| Check off a daily epic task | +10 XP |

### Level thresholds

| Level | XP required |
|---|---|
| 1 | 0 |
| 2 | 200 |
| 3 | 500 |
| 4 | 1 000 |
| 5 | 2 000 |

Level-up triggers canvas-confetti + a level-up toast. Calculated in `src/main/main.js` → `calcLevel()`.

### XP bar display
- Shown in Topbar as an HP-style segmented fill
- Colour shifts green → yellow → red based on % toward next level
- Tick marks divide the bar into segments

---

## Project Structure

```
d:\Dashboard\
├── src/
│   ├── main/
│   │   ├── main.js          # Electron main process, IPC handlers
│   │   ├── preload.js       # Context bridge — exposes window.electronAPI
│   │   ├── database.js      # better-sqlite3 init, schema, seed, helpers
│   │   └── aiHandler.js     # AI provider routing (Anthropic / OpenAI / Gemini / Ollama)
│   └── renderer/
│       ├── index.html
│       ├── main.jsx
│       ├── App.jsx          # Root: MemoryRouter, layout shell, AI panel toggle
│       ├── styles/
│       │   └── globals.css  # Tailwind + custom animations + retro-card classes
│       ├── components/
│       │   ├── Sidebar.jsx
│       │   ├── Topbar.jsx
│       │   ├── AIPanel.jsx       # Slide-in AI chat with persistent memory
│       │   ├── MarioSprite.jsx   # Pixel-art walking Mario + MarioFaceIcon
│       │   ├── EpicCard.jsx
│       │   ├── ProgressBar.jsx
│       │   ├── StatusPill.jsx
│       │   ├── XPToast.jsx
│       │   └── ConfettiCelebration.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Daily.jsx        # Daily Planner + "Generate my day" AI schedule
│       │   ├── Journal.jsx      # Daily diary (mood + free-write) + AI 7/30-day reflections
│       │   ├── Calendar.jsx
│       │   ├── Epics.jsx
│       │   ├── EpicDetail.jsx   # Milestones + recurring Daily Checklist per epic
│       │   ├── Streaks.jsx
│       │   ├── TimeAudit.jsx
│       │   ├── NetworkCRM.jsx
│       │   ├── WeeklyReview.jsx # Auto-generated AI weekly review
│       │   ├── EnergyLog.jsx
│       │   ├── Welcome.jsx      # 4-step first-run onboarding
│       │   └── Settings.jsx
│       └── hooks/
│           └── useAudio.js
├── public/
│   └── icon.png
├── package.json
├── vite.config.js
├── tailwind.config.js
└── CLAUDE.md               ← this file
```

---

## IPC API (`window.electronAPI`)

```js
window.electronAPI.db.query(sql, params)     // SELECT → array
window.electronAPI.db.run(sql, params)       // INSERT/UPDATE/DELETE → { lastInsertRowid, changes }
window.electronAPI.db.get(sql, params)       // SELECT one → object | undefined

window.electronAPI.settings.get(key)         // → string | null
window.electronAPI.settings.set(key, value)  // → true
window.electronAPI.settings.getApiKey(provider)     // decrypted string
window.electronAPI.settings.setApiKey(provider, key) // encrypts + stores

window.electronAPI.xp.award(amount)          // → { xp, level, levelUp }

window.electronAPI.ai.chat({ messages, provider, model, ollamaEndpoint, systemPrompt })

window.electronAPI.system.setLoginItem(bool)
window.electronAPI.system.exportData()       // → { ok, filePath? }
```

---

## Security Constraints

- **AI API keys must NEVER be exposed in renderer** — all AI calls go through main process IPC
- API keys are **XOR-encrypted** using a machine-specific key (hostname + username) before writing to SQLite
- `ELECTRON_RUN_AS_NODE=1` must NOT be set when running the app (causes Electron to run as Node, not as a window)

---

## Development

```powershell
# Kill any stale processes first:
Get-Process -Name node, electron -ErrorAction SilentlyContinue | Stop-Process -Force

# Clear the env var if accidentally set:
[System.Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $null, 'Process')

npm run dev
```

Vite dev server: `http://localhost:5173`  
Electron loads that URL in dev mode; `dist/index.html` in production.

---

## All Phases

### ✅ Phase 1 — Main process + DB
- Electron main process skeleton
- `database.js`: schema for all 9 tables, seed data, XOR-encrypted API key storage
- `preload.js`: context bridge exposing `window.electronAPI`
- IPC handlers: db CRUD, settings, XP award, AI chat, system tray, export

### ✅ Phase 2 — React shell + routing
- `App.jsx`: MemoryRouter with all routes
- `Sidebar.jsx`: dark game-chrome nav
- `Topbar.jsx`: greeting, XP bar, level badge, coin
- Stub pages for all routes

### ✅ Phase 3 — Dashboard + gamification + AI
- `Dashboard.jsx`: stat cards, Epic cards with horizon tabs, daily streak log
- `MarioSprite.jsx`: pixel-art walking Mario (RAF loop), interactive hover/click
- `AIPanel.jsx`: slide-in chat panel with persistent `ai_messages` DB memory
- `EpicCard.jsx`: retro-card style
- `XPToast.jsx`, `ConfettiCelebration.jsx`: XP feedback
- `useAudio.js`: chiptune sound effects
- Full retro visual overhaul (dark chrome, retro cards, `globals.css` animations)

### ✅ Phase 4 — Epics full CRUD + detail page
- `Epics.jsx`: list all epics, create new epic modal (name, description, icon, color, horizon)
- `EpicDetail.jsx`: view/edit epic, add/complete/delete subtasks, progress recalc, mark epic complete (+50 XP)

### ✅ Phase 5 — Streaks page
- `Streaks.jsx`: create/delete habits, today's progress bar, XP award (+10)
- `StreakCard.jsx`: 28-day calendar grid (4×7), logged count, streak + best streak display

### ✅ Phase 6 — AI chat panel (enhancements)
- Context injection: live epics, streaks, today's logs, XP, level injected as system prompt
- Persistent memory via `ai_messages` table (from Phase 3)

### ✅ Phase 7 — Remaining pages
- `TimeAudit.jsx`: weekly hours logger (deep work, learning, admin, social, rest) + Recharts bar
- `NetworkCRM.jsx`: contacts table, add/edit/delete, search, overdue follow-up indicators
- `WeeklyReview.jsx`: form (what worked, what didn't, dropping, next focus, energy rating) + +25 XP on first submit per week
- `EnergyLog.jsx`: daily energy rating (1–5) with 30-day trend chart + +5 XP on first log per day

### ✅ Phase 8 — Settings page
- `Settings.jsx`: user profile, AI provider switcher (Anthropic / OpenAI / Gemini / Ollama), API key input (encrypted), startup settings, data export

### ✅ Phase 9 — Package to .exe
- `electron-builder.yml`: NSIS config, `win.icon: public/icon.png` (auto-converted to .ico)
- `npm run build:win` → `dist-electron/Life OS Setup.exe`

### ✅ Phase 10 — AI deepening + product polish
- Shared `utils/systemPrompt.js`: provider-agnostic personality layer (`buildSystemPrompt` + `fetchMemories`) used by every LLM call
- `Daily.jsx`: "Generate my day" — AI builds a JSON time-block schedule, drag-to-reorder, cached in `daily_schedules`
- `WeeklyReview.jsx`: auto-generated AI review ([SUMMARY]/[WIN]/[GAP]/[QUESTIONS]), cached by data fingerprint
- `EpicDetail.jsx`: epics split into **Milestones** (one-time, +15 XP) and a recurring **Daily Checklist** (+10 XP/day via `recurring_completions`); progress % counts milestones only. Dashboard shows a "Daily Grind" sidebar of all recurring tasks
- `Welcome.jsx`: 4-step first-run onboarding (name → first epic → first habit → XP intro); shown when DB has no epics
- `AIPanel.jsx`: full task-aware context (subtask IDs + daily/done state) and 13 action types — `move_to_daily`, `move_to_milestone`, `complete_task`, `log_daily_epic_task`, `delete_task`, `update_epic`, `add_daily_task`, `journal_entry`, plus navigate/add_task/log_streak/add_habit/add_contact/create_goal. All XP routed through App's `awardXp` (toasts + confetti)

### ✅ Phase 11 — Journal + AI reflections
- `Journal.jsx`: three tabs — **Write** (mood 1–5 + free-write + optional highlight/gratitude/challenge, rotating daily prompt, +8 XP first entry per day), **AI Reflections** (7- or 30-day narrative / emotional arc / patterns / insight via the shared provider layer, cached in `journal_reflections` by fingerprint), **History** (month calendar heatmap coloured by mood + recent-entry list)
- Journaling streak badge; `journal_entry` AI action lets the assistant write/append entries on command
