import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = resolve(__dirname, '../../../scripts/validate-electron-vite-env.cjs')
const tempRoots: string[] = []

function runValidator(root: string, extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH || '',
      NODE_PATH: process.env.NODE_PATH || '',
      FLOWSTATE_ENV_ROOT: root,
      FLOWSTATE_VITE_MODE: 'production',
      ...extraEnv,
    },
  })
}

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'flowstate-electron-env-'))
  tempRoots.push(root)
  return root
}

describe('validate-electron-vite-env', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when an Electron build has no Supabase Vite env', () => {
    const root = makeRoot()
    const result = runValidator(root)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Electron build is missing Supabase Vite env')
    expect(result.stderr).toContain('VITE_SUPABASE_URL')
    expect(result.stderr).toContain('VITE_SUPABASE_ANON_KEY')
  })

  it('passes when .env.local provides the required Supabase Vite env', () => {
    const root = makeRoot()
    writeFileSync(
      join(root, '.env.local'),
      'VITE_SUPABASE_URL=https://api.in-theflow.com\nVITE_SUPABASE_ANON_KEY=test-anon-key\n'
    )

    const result = runValidator(root)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Supabase Vite env present')
  })
})
