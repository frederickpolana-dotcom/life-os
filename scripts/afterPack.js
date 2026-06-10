const path = require('path')
const { execFileSync } = require('child_process')
const fs = require('fs')

exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return

  const exePath  = path.join(context.appOutDir, 'Life OS.exe')
  const icoPath  = path.join(__dirname, '../public/icons/win/icon.ico')
  const cacheDir = path.join(
    process.env.LOCALAPPDATA,
    'electron-builder', 'Cache', 'winCodeSign'
  )

  // Pick first available rcedit-x64 from cache
  let rceditPath = null
  if (fs.existsSync(cacheDir)) {
    for (const entry of fs.readdirSync(cacheDir).sort()) {
      const candidate = path.join(cacheDir, entry, 'rcedit-x64.exe')
      if (fs.existsSync(candidate)) { rceditPath = candidate; break }
    }
  }

  if (!rceditPath) {
    console.warn('[afterPack] rcedit not found — icon will not be embedded')
    return
  }

  try {
    execFileSync(rceditPath, [exePath, '--set-icon', icoPath])
    console.log('[afterPack] Icon embedded into Life OS.exe')
  } catch (e) {
    console.error('[afterPack] rcedit failed:', e.message)
  }
}
