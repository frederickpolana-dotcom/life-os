# 🎮 Life OS — Gamified Personal Dashboard

> *Level up your real life.*

A retro-styled desktop productivity app that turns your goals, habits, and daily grind into an actual RPG. Built with Electron + React, powered by a local SQLite database — everything runs on your machine, nothing in the cloud.

---

![Life OS Banner](logo-full.png)

---

## ✨ What is this?

Life OS is a **personal operating system** for ambitious people who think spreadsheets are boring and Notion is too slow. It gamifies the things that actually matter:

- 🏔️ **Epics** — Big goals broken into subtasks with real progress tracking
- 🔥 **Streaks** — Daily habits with a 28-day calendar grid, current streak & best streak
- ⏱️ **Time Audit** — Weekly hours breakdown across deep work, learning, admin, social, rest
- 🤝 **Network CRM** — Keep track of mentors, peers, and leads with follow-up reminders
- 📓 **Weekly Review** — Structured reflection: what worked, what didn't, what to drop
- ⚡ **Energy Log** — Daily 1–5 energy ratings with a 30-day trend chart
- 🤖 **AI Coach** — A built-in AI assistant (Claude / GPT / Gemini / Ollama) that can actually *do things* in the app — create goals, add tasks, log habits, navigate pages

Everything earns **XP**. XP fills a level bar. Leveling up triggers confetti and a chiptune sound. Because why not.

---

## 🎯 Features

### Epics — Your Big Goals
Create Epics for the things that matter most — sorted by horizon (Quarter, Year, Long-term). Each Epic has subtasks, a live progress bar, and a color-coded retro card. Completing an Epic pays out **+50 XP**.

### Streaks — Daily Habits
Track any habit with a 28-day punch card grid. The app auto-calculates your current streak and longest streak. Every log earns **+10 XP**.

### AI Coach with Real Actions
The AI panel isn't just a chatbox — it's wired directly into the database. You can say:
- *"I want to get into Google by Q3"* → AI creates the Epic with 5–8 subtasks and navigates you to it
- *"Add 'review flashcards' to my HSK epic"* → task appears instantly
- *"Log my morning run"* → streak logged, navigates to Streaks page
- *"Go to my network"* → navigates

Supports **Anthropic Claude**, **OpenAI GPT**, **Google Gemini**, and **Ollama** (local models — fully offline). API keys are XOR-encrypted before being stored in SQLite.

### XP & Leveling System

| Action | XP |
|---|---|
| Log a streak habit | +10 |
| Complete a subtask | +15 |
| Create a new Epic | +20 |
| Submit a Weekly Review | +25 |
| Complete an entire Epic | +50 |

| Level | XP Required |
|---|---|
| 1 | 0 |
| 2 | 200 |
| 3 | 500 |
| 4 | 1 000 |
| 5 | 2 000 |

Level-up = confetti + toast notification.

---

## 🖥️ Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Electron 31 |
| UI | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| Database | better-sqlite3 (local, no server) |
| Charts | Recharts |
| Icons | Tabler Icons |
| Router | React Router v6 (MemoryRouter for Electron) |
| Confetti | canvas-confetti |
| AI | Anthropic / OpenAI / Gemini / Ollama APIs |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [Git](https://git-scm.com/)
- (Optional) [Ollama](https://ollama.ai/) for local AI

### Install & Run

```bash
git clone https://github.com/frederickpolana-dotcom/bolobolo123.git
cd bolobolo123
npm install
npm run dev
```

The app opens as an Electron window. Vite hot-reloads the renderer on file changes.

### Build to `.exe` (Windows)

```bash
npm run build:win
```

Installer outputs to `dist-electron/Life OS Setup 1.0.0.exe`.

---

## 🤖 AI Setup

Go to **Settings → AI Provider** and pick your backend:

| Provider | How to get a key |
|---|---|
| Claude (Anthropic) | [console.anthropic.com](https://console.anthropic.com) |
| GPT (OpenAI) | [platform.openai.com](https://platform.openai.com) |
| Gemini | [aistudio.google.com](https://aistudio.google.com) |
| Ollama | Run locally — no key needed |

**Recommended Ollama model:** `gemma4:31b-cloud` (runs via Ollama's cloud relay, no GPU required)

```bash
ollama pull gemma4:31b-cloud
```

---

## 📁 Project Structure

```
life-os/
├── src/
│   ├── main/
│   │   ├── main.js          # Electron main process + IPC handlers
│   │   ├── preload.js       # Context bridge (window.electronAPI)
│   │   ├── database.js      # SQLite schema, seed, helpers
│   │   └── aiHandler.js     # AI provider routing
│   └── renderer/
│       ├── App.jsx           # Root layout + MemoryRouter
│       ├── components/       # Sidebar, Topbar, AIPanel, XPToast...
│       ├── pages/            # Dashboard, Epics, Streaks, TimeAudit...
│       └── styles/
│           └── globals.css   # Tailwind + retro card animations
├── public/
│   └── icons/win/icon.ico   # App icon
├── scripts/
│   └── afterPack.js         # Embeds icon into .exe post-build
├── electron-builder.yml
├── vite.config.js
└── tailwind.config.js
```

---

## 🎨 Design System

The UI follows a **retro game aesthetic** — dark chrome bezel + bright content screen, pixel-art shadows, and a custom color palette:

| Token | Color | Usage |
|---|---|---|
| Primary teal | `#1D9E75` | CTAs, active states, XP bar |
| Teal dark | `#085041` | Headings, hard shadows |
| Amber | `#EF9F27` | Warnings, XP coins, accent cards |
| Purple | `#7F77DD` | Alternative accent |
| Game chrome | `#061710` | Sidebar + Topbar background |
| Content bg | `#f4fdf8` | Main content area |

Retro cards have a `3px 3px 0` hard drop shadow (no blur) — pure pixel-art energy.

---

## 🔒 Security

- AI API keys are **never exposed in the renderer process** — all AI calls go through Electron's main process via IPC
- Keys are **XOR-encrypted** using a machine-specific salt (hostname + username) before writing to SQLite
- The local database is stored in `%APPDATA%/life-os/lifeos.db` — only accessible by the current user

---

## 🗺️ Roadmap

- [ ] Mobile companion app (view streaks + log habits on the go)
- [ ] Calendar integration (sync due dates with Google Calendar)
- [ ] Pomodoro timer with deep work session logging
- [ ] Export to PDF (weekly review reports)
- [ ] Themes (dark mode, high contrast, custom palettes)

---

## 👤 Author

**Frederick Polana**
- GitHub: [@frederickpolana-dotcom](https://github.com/frederickpolana-dotcom)
- Email: frederick.polana@gmail.com

---

## 📄 License

MIT — do whatever you want with it, just don't claim you built it from scratch.

---

<div align="center">
  <sub>Built as a personal tool. Shared in case it helps someone else level up too.</sub>
</div>
