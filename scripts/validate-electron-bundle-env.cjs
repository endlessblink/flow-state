#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const expectedUrl = String(process.env.VITE_SUPABASE_URL || '').trim()
const expectedAnonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '').trim()

if (!expectedUrl || !expectedAnonKey) {
  console.error('[electron-env] ERROR: validated build variables are missing after the renderer build.')
  process.exit(1)
}

function filesIn(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  })
}

const assets = filesIn(dist).filter((file) => /\.(?:js|html|css)$/.test(file))
const source = assets.map((file) => fs.readFileSync(file, 'utf8')).join('\n')

if (!source.includes(expectedUrl) || !source.includes(expectedAnonKey)) {
  console.error('[electron-env] ERROR: the packaged renderer does not contain the validated Supabase configuration.')
  console.error('[electron-env] Refusing to package a Guest Mode-only Electron release.')
  process.exit(1)
}

console.log('[electron-env] Packaged renderer contains the validated Supabase configuration.')
