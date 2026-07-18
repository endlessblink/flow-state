#!/usr/bin/env node

/**
 * Refuse Electron builds that would bundle an unconfigured Supabase client.
 *
 * Vite inlines VITE_* values at build time. If an Electron release is built
 * without these values, the packaged desktop app can only run in Guest Mode and
 * Google sign-in crashes or fails. This guard mirrors Vite's env-file loading
 * closely enough for the production Electron build path.
 */

const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const root = process.env.FLOWSTATE_ENV_ROOT || path.resolve(__dirname, '..')
const mode = process.env.FLOWSTATE_VITE_MODE || 'production'

const env = {}
const envFiles = [
  '.env',
  '.env.local',
  `.env.${mode}`,
  `.env.${mode}.local`,
]

for (const file of envFiles) {
  const fullPath = path.join(root, file)
  if (fs.existsSync(fullPath)) {
    Object.assign(env, dotenv.parse(fs.readFileSync(fullPath)))
  }
}

for (const [key, value] of Object.entries(process.env)) {
  env[key] = value
}

const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
  .filter((key) => !String(env[key] || '').trim())

if (missing.length > 0) {
  console.error('[electron-env] ERROR: Electron build is missing Supabase Vite env.')
  console.error(`[electron-env] Missing: ${missing.join(', ')}`)
  console.error('[electron-env] Set these in the shell or in .env.local/.env.production before building.')
  console.error('[electron-env] Refusing to build a Guest Mode-only Electron release.')
  process.exit(1)
}

async function validateBackendCredential() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)

  try {
    const settingsUrl = new URL('/auth/v1/settings', String(env.VITE_SUPABASE_URL))
    const response = await fetch(settingsUrl, {
      method: 'GET',
      headers: {
        apikey: String(env.VITE_SUPABASE_ANON_KEY),
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(
        `[electron-env] ERROR: Backend credential rejected (HTTP ${response.status}).`
      )
      console.error('[electron-env] Refusing to bundle an unusable credential into Electron.')
      process.exitCode = 1
      return
    }

    console.log(
      '[electron-env] Supabase Vite env present; backend credential accepted for Electron build.'
    )
  } catch {
    console.error('[electron-env] ERROR: Could not validate backend credential (request failed).')
    console.error('[electron-env] Refusing to build without a successful credential check.')
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
  }
}

void validateBackendCredential()
