#!/usr/bin/env node

const { existsSync } = require('node:fs')
const { join, resolve } = require('node:path')
const asar = require('@electron/asar')

const root = resolve(__dirname, '..')
const packagePath = process.argv[2]
  ? resolve(process.argv[2])
  : join(root, 'release', 'linux-unpacked', 'resources', 'app.asar')

const requiredEntries = [
  '/package.json',
  '/dist/index.html',
  '/dist-electron/main.cjs',
  '/dist-electron/preload.cjs',
  '/dist-electron/local-api-server.cjs',
]

if (!existsSync(packagePath)) {
  console.error(`[electron-package] Missing package archive: ${packagePath}`)
  process.exit(1)
}

const entries = new Set(asar.listPackage(packagePath))
const missing = requiredEntries.filter((entry) => !entries.has(entry))

if (missing.length > 0) {
  console.error(`[electron-package] Packaged app is missing required files in ${packagePath}:`)
  for (const entry of missing) {
    console.error(`  - ${entry}`)
  }
  process.exit(1)
}

console.log(`[electron-package] Package contains renderer and Electron entrypoints: ${packagePath}`)
