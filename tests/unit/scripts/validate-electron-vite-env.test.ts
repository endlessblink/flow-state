import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

function mockSettingsResponse(root: string, status: number, body = '') {
  const preloadPath = join(root, `mock-settings-${status}.cjs`)
  writeFileSync(
    preloadPath,
    `global.fetch = async (url, options) => {\n` +
      `  const requestIsValid = String(url).endsWith('/auth/v1/settings')\n` +
      `    && options?.method === 'GET'\n` +
      `    && typeof options?.headers?.apikey === 'string'\n` +
      `    && options.headers.apikey.length > 0\n` +
      `  const status = requestIsValid ? ${status} : 418\n` +
      `  return {\n` +
      `    ok: status >= 200 && status < 300,\n` +
      `    status,\n` +
      `    statusText: 'mock status text',\n` +
      `    text: async () => ${JSON.stringify(body)},\n` +
      `  }\n` +
      `}\n`
  )
  return preloadPath
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
    const preloadPath = mockSettingsResponse(root, 200)
    writeFileSync(
      join(root, '.env.local'),
      'VITE_SUPABASE_URL=https://api.in-theflow.com\nVITE_SUPABASE_ANON_KEY=test-anon-key\n'
    )

    const result = runValidator(root, { NODE_OPTIONS: `--require=${preloadPath}` })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Supabase Vite env present')
  })

  it('rejects a backend credential that receives 401 without leaking credentials or response bodies', () => {
    const root = makeRoot()
    const secretKey = 'stale-public-key-that-must-stay-redacted'
    const secretBody = 'backend-body-that-must-stay-redacted'
    const preloadPath = mockSettingsResponse(root, 401, secretBody)
    writeFileSync(
      join(root, '.env.local'),
      `VITE_SUPABASE_URL=https://api.in-theflow.com\nVITE_SUPABASE_ANON_KEY=${secretKey}\n`
    )

    const result = runValidator(root, { NODE_OPTIONS: `--require=${preloadPath}` })
    const output = `${result.stdout}${result.stderr}`

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('401')
    expect(result.stderr).toContain('credential')
    expect(output).not.toContain(secretKey)
    expect(output).not.toContain(secretBody)
  })

  it('accepts a backend credential that receives 200 without printing the credential or body', () => {
    const root = makeRoot()
    const secretKey = 'current-public-key-that-must-stay-redacted'
    const secretBody = 'settings-body-that-must-stay-redacted'
    const preloadPath = mockSettingsResponse(root, 200, secretBody)
    writeFileSync(
      join(root, '.env.local'),
      `VITE_SUPABASE_URL=https://api.in-theflow.com\nVITE_SUPABASE_ANON_KEY=${secretKey}\n`
    )

    const result = runValidator(root, { NODE_OPTIONS: `--require=${preloadPath}` })
    const output = `${result.stdout}${result.stderr}`

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('credential accepted')
    expect(output).not.toContain(secretKey)
    expect(output).not.toContain(secretBody)
  })

  it('keeps credential validation wired before Electron release builds', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, '../../../package.json'), 'utf8')
    ) as { scripts: Record<string, string> }
    const deployScript = readFileSync(
      resolve(__dirname, '../../../scripts/deploy-electron-update.sh'),
      'utf8'
    )

    expect(packageJson.scripts['electron:build']).toMatch(/^npm run electron:validate-env &&/)
    expect(deployScript.indexOf('validate-electron-vite-env.cjs')).toBeGreaterThan(-1)
    expect(deployScript.indexOf('validate-electron-vite-env.cjs')).toBeLessThan(
      deployScript.indexOf('guard:electron-sync')
    )
  })
})
