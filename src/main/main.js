const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron')
const path = require('path')
const fs   = require('fs')
const db   = require('./database')
const { routeAiChat }                    = require('./aiHandler')
const { runScoringEngine, getTopTasks }  = require('./scoringEngine')
const { runDailyMemoryUpdate }           = require('./assistantMemory')

// ── Single-instance lock ────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

let mainWindow   = null
let widgetWindow = null
let tray         = null

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

// ── Window creation ─────────────────────────────────────────────────────────
function getIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'public/icons/win/icon.ico')
    : path.join(__dirname, '../../public/icons/win/icon.ico')
}

function createWindow() {
  const iconPath = getIconPath()
  mainWindow = new BrowserWindow({
    width:     1280,
    height:    820,
    minWidth:  1200,
    minHeight: 800,
    show:      false,
    frame:     true,
    icon:      iconPath,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  } else {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  const startMinimized = db.getSetting('start_minimized') === 'true'
  mainWindow.once('ready-to-show', () => {
    if (!startMinimized) mainWindow.show()
  })

  // Close → minimize to tray
  mainWindow.on('close', (e) => {
    if (tray) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

// ── Widget window ────────────────────────────────────────────────────────────
function createWidgetWindow() {
  const { screen } = require('electron')
  const { workAreaSize } = screen.getPrimaryDisplay()
  const savedX   = parseInt(db.getSetting('widget_x')  || '-1', 10)
  const savedY   = parseInt(db.getSetting('widget_y')  || '-1', 10)
  const pinned   = db.getSetting('widget_pinned') === 'true'
  const wx = savedX >= 0 ? savedX : workAreaSize.width  - 304
  const wy = savedY >= 0 ? savedY : workAreaSize.height - 500

  widgetWindow = new BrowserWindow({
    width:        284,
    height:       500,
    x:            wx,
    y:            wy,
    frame:        false,
    transparent:  true,
    alwaysOnTop:  pinned,
    skipTaskbar:  true,
    resizable:    false,
    show:         false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  if (app.isPackaged) {
    widgetWindow.loadFile(path.join(__dirname, '../../dist/widget.html'))
  } else {
    widgetWindow.loadURL('http://localhost:5173/widget.html')
  }

  widgetWindow.once('ready-to-show', () => widgetWindow.show())

  widgetWindow.on('moved', () => {
    if (!widgetWindow) return
    const [x, y] = widgetWindow.getPosition()
    db.setSetting('widget_x', String(x))
    db.setSetting('widget_y', String(y))
  })

  // Widget stays behind other windows naturally via alwaysOnTop: false

  widgetWindow.on('closed', () => { widgetWindow = null })
}

// ── System tray ─────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = getIconPath()
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty()

  tray = new Tray(icon)
  tray.setToolTip('Life OS')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Life OS',
      click: () => { mainWindow.show(); mainWindow.focus() },
    },
    {
      label: 'Show Desktop Widget',
      click: () => {
        if (widgetWindow) {
          widgetWindow.show()
          widgetWindow.focus()
        } else {
          createWidgetWindow()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { tray = null; app.quit() },
    },
  ])
  tray.setContextMenu(menu)
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus() })
}

// ── IPC: database ───────────────────────────────────────────────────────────
ipcMain.handle('db:query', (_e, sql, params = []) => db.query(sql, params))
ipcMain.handle('db:run',   (_e, sql, params = []) => db.run(sql, params))
ipcMain.handle('db:get',   (_e, sql, params = []) => db.get(sql, params))

// ── IPC: settings ────────────────────────────────────────────────────────────
ipcMain.handle('settings:get',       (_e, key)              => db.getSetting(key))
ipcMain.handle('settings:set',       (_e, key, value)       => { db.setSetting(key, value); return true })
ipcMain.handle('settings:getApiKey', (_e, provider)         => db.getDecryptedApiKey(provider))
ipcMain.handle('settings:setApiKey', (_e, provider, plain)  => { db.setEncryptedApiKey(provider, plain); return true })

// ── IPC: AI ──────────────────────────────────────────────────────────────────
ipcMain.handle('ai:chat', async (_e, payload) => {
  const { messages, provider, model, ollamaEndpoint, systemPrompt } = payload
  const apiKey = db.getDecryptedApiKey(provider)
  return routeAiChat({ messages, provider, model, apiKey, ollamaEndpoint, systemPrompt })
})

// ── IPC: XP ──────────────────────────────────────────────────────────────────
ipcMain.handle('xp:award', (_e, amount) => {
  const current = parseInt(db.getSetting('xp_total') || '0', 10)
  const newTotal = current + amount
  db.setSetting('xp_total', String(newTotal))

  const oldLevel = parseInt(db.getSetting('xp_level') || '1', 10)
  const newLevel = calcLevel(newTotal)
  if (newLevel > oldLevel) {
    db.setSetting('xp_level', String(newLevel))
    return { xp: newTotal, level: newLevel, levelUp: true }
  }
  return { xp: newTotal, level: newLevel, levelUp: false }
})

function calcLevel(xp) {
  if (xp >= 2000) return 5
  if (xp >= 1000) return 4
  if (xp >= 500)  return 3
  if (xp >= 200)  return 2
  return 1
}

// ── IPC: system ───────────────────────────────────────────────────────────────
ipcMain.handle('system:setLoginItem', (_e, enabled) => {
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: enabled })
  }
  db.setSetting('launch_on_startup', String(enabled))
  return true
})

ipcMain.handle('system:exportData', async () => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export Life OS Data',
    defaultPath: `lifeos-export-${new Date().toISOString().slice(0, 10)}.json`,
    filters:     [{ name: 'JSON', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { ok: false }
  try {
    const data = db.exportAllData()
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    shell.showItemInFolder(filePath)
    return { ok: true, filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('files:readDocument', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title:      'Attach Document',
    properties: ['openFile'],
    filters: [
      { name: 'Text / Code', extensions: ['txt', 'md', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'xml', 'yaml', 'yml', 'log'] },
      { name: 'All Files',   extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePaths.length) return null
  const filePath = result.filePaths[0]
  try {
    const stats = fs.statSync(filePath)
    if (stats.size > 120 * 1024) {
      return { error: `File too large (${Math.round(stats.size / 1024)} KB). Max 120 KB.` }
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    return { name: path.basename(filePath), content, size: stats.size }
  } catch {
    return { error: 'Could not read file — make sure it is a plain-text file.' }
  }
})

// ── IPC: tasks ───────────────────────────────────────────────────────────────
ipcMain.handle('tasks:getTopTasks', (_e, n = 5) => getTopTasks(db.getDb(), n))
ipcMain.handle('tasks:runScoring',  ()           => runScoringEngine(db.getDb()))

// ── IPC: widget controls ──────────────────────────────────────────────────────
ipcMain.handle('widget:open-main', () => {
  mainWindow.show()
  mainWindow.focus()
})
ipcMain.handle('widget:minimize', () => {
  widgetWindow?.minimize()
})
ipcMain.handle('widget:hide', () => {
  widgetWindow?.hide()
})
ipcMain.handle('widget:set-always-on-top', (_e, val) => {
  if (!widgetWindow) return
  widgetWindow.setAlwaysOnTop(!!val)
})

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  createTray()
  createWidgetWindow()

  const launchOnStartup = db.getSetting('launch_on_startup') === 'true'
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: launchOnStartup })
  }

  // Run priority scoring engine on startup, then every 30 minutes
  runScoringEngine(db.getDb())
  setInterval(() => runScoringEngine(db.getDb()), 30 * 60 * 1000)

  // Run behavioral pattern detection once per calendar day
  runDailyMemoryUpdate(db.getDb())
})

app.on('window-all-closed', (e) => {
  e.preventDefault()
})

app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus() }
})
