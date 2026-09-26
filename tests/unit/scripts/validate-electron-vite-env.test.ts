import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = resolve(__dirname, '../../../scripts/validate-electron-vite-env.cjs')
const tempRoots: string[] = []
const jwt = (payload: Record<string, unknown>) =>
  `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c3ludGhldGljLXNpZ25hdHVyZQ`
const anonKey = jwt({ role: 'anon' })

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

function mockSettingsResponse(root: string, statuses: number | number[], body = '') {
  const sequence = Array.isArray(statuses) ? statuses : [statuses]
  const preloadPath = join(root, `mock-settings-${sequence.join('-')}.cjs`)
  writeFileSync(
    preloadPath,
    `const statuses = ${JSON.stringify(sequence)}\n` +
      `let callCount = 0\n` +
    `global.fetch = async (url, options) => {\n` +
      `  const requestIsValid = String(url).endsWith('/auth/v1/settings')\n` +
      `    && options?.method === 'GET'\n` +
      `    && typeof options?.headers?.apikey === 'string'\n` +
      `    && options.headers.apikey.length > 0\n` +
      `  const status = requestIsValid ? statuses[Math.min(callCount++, statuses.length - 1)] : 418\n` +
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
      `VITE_SUPABASE_URL=https://api.in-theflow.com\nVITE_SUPABASE_ANON_KEY=${anonKey}\n`
    )

    const result = runValidator(root, { NODE_OPTIONS: `--require=${preloadPath}` })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Supabase Vite env present')
  })

  it('rejects a backend credential that receives 401 without leaking credentials or response bodies', () => {
    const root = makeRoot()
    const secretKey = anonKey
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
    const secretKey = anonKey
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

  it('retries a rate-limited credential check and accepts a later success', () => {
    const root = makeRoot()
    const preloadPath = mockSettingsResponse(root, [429, 200])
    writeFileSync(
      join(root, '.env.local'),
      'VITE_SUPABASE_URL=https://api.in-theflow.com\\nVITE_SUPABASE_ANON_KEY=test-anon-key\\n'
    )

    const result = runValidator(root, {
      NODE_OPTIONS: `--require=${preloadPath}`,
      VITE_SUPABASE_URL: 'https://api.in-theflow.com',
      VITE_SUPABASE_ANON_KEY: anonKey,
    })

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('credential accepted')
  })

  it('keeps rejecting a credential check that remains rate limited', () => {
    const root = makeRoot()
    const preloadPath = mockSettingsResponse(root, [429, 429, 429])

    const result = runValidator(root, {
      NODE_OPTIONS: `--require=${preloadPath}`,
      VITE_SUPABASE_URL: 'https://api.in-theflow.com',
      VITE_SUPABASE_ANON_KEY: anonKey,
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('HTTP 429')
  })

  it.each([
    ['service role', jwt({ role: 'service_role' })],
    ['authenticated role', jwt({ role: 'authenticated' })],
    ['missing role', jwt({})],
    ['malformed JWT', 'not-a-jwt'],
    ['malformed payload', 'e30.bm90LWpzb24.c2ln'],
    ['unsigned JWT', `${anonKey.split('.').slice(0, 2).join('.')}.`],
    ['secret API key', 'sb_secret_synthetic'],
    ['unsupported publishable key', 'sb_publishable_synthetic'],
  ])('rejects %s before contacting the backend without printing it', (_label, key) => {
    const root = makeRoot()
    const preloadPath = join(root, 'forbid-fetch.cjs')
    writeFileSync(preloadPath, "global.fetch = () => { console.error('UNEXPECTED_BACKEND_REQUEST'); process.exit(99) }")
    const result = runValidator(root, {
      NODE_OPTIONS: `--require=${preloadPath}`,
      VITE_SUPABASE_URL: 'https://api.in-theflow.com',
      VITE_SUPABASE_ANON_KEY: key,
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('must be an anon-role JWT')
    expect(`${result.stdout}${result.stderr}`).not.toContain(key)
    expect(`${result.stdout}${result.stderr}`).not.toContain('UNEXPECTED_BACKEND_REQUEST')
  })

  it('keeps credential validation wired before Electron release builds', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, '../../../package.json'), 'utf8')
    ) as { scripts: Record<string, string> }
    const deployScript = readFileSync(
      resolve(__dirname, '../../../scripts/deploy-electron-update.sh'),
      'utf8'
    )
    const bundleValidator = readFileSync(
      resolve(__dirname, '../../../scripts/validate-electron-bundle-env.cjs'),
      'utf8'
    )

    expect(packageJson.scripts['electron:build']).toMatch(/^npm run electron:validate-env &&/)
    expect(packageJson.scripts['electron:build']).toContain('flock -n /tmp/flowstate-electron-build.lock')
    expect(packageJson.scripts['electron:build:locked']).toContain('npm run electron:validate-package')
    expect(deployScript.indexOf('validate-electron-vite-env.cjs')).toBeGreaterThan(-1)
    expect(deployScript.indexOf('validate-electron-vite-env.cjs')).toBeLessThan(
      deployScript.indexOf('guard:electron-sync')
    )
    expect(bundleValidator).toContain("['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]")
    expect(bundleValidator).toContain('Object.assign(env, process.env)')
  })
})
