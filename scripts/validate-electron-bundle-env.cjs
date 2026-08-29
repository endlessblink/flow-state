#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')

function parseEnvFile(contents) {
  const parsed = {}
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    parsed[match[1]] = value
  }
  return parsed
}

const mode = process.env.FLOWSTATE_VITE_MODE || 'production'
const env = {}
for (const file of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
  const fullPath = path.join(root, file)
  if (fs.existsSync(fullPath)) Object.assign(env, parseEnvFile(fs.readFileSync(fullPath, 'utf8')))
}
Object.assign(env, process.env)

const expectedUrl = String(env.VITE_SUPABASE_URL || '').trim()
const expectedAnonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim()

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
