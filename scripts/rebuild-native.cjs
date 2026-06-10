/**
 * Rebuilds better-sqlite3 against the installed Electron version.
 * Uses VCINSTALLDIR env var to bypass vswhere detection on Windows.
 */
const { rebuild } = require('@electron/rebuild')
const path = require('path')

// Point node-gyp at the VS Build Tools without relying on vswhere
if (process.platform === 'win32' && !process.env.VCINSTALLDIR) {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\Professional\\VC\\',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\Community\\VC\\',
  ]
  const fs = require('fs')
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      process.env.VCINSTALLDIR = c
      console.log(`Set VCINSTALLDIR = ${c}`)
      break
    }
  }
  if (!process.env.VSCMD_VER) process.env.VSCMD_VER = '17.0.0'
}

const electronPkg = require('../node_modules/electron/package.json')
const electronVersion = electronPkg.version

console.log(`Rebuilding better-sqlite3 for Electron ${electronVersion}...`)

rebuild({
  buildPath:       path.join(__dirname, '..'),
  electronVersion,
  force:           true,
  onlyModules:     ['better-sqlite3'],
})
  .then(() => console.log('better-sqlite3 rebuilt successfully.'))
  .catch(err => {
    console.error('Rebuild failed:', err.message)
    process.exit(1)
  })
