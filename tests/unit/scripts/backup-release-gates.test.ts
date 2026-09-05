import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface PackageManifest {
  scripts: Record<string, string>
}

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
) as PackageManifest

describe('backup and restore release gates', () => {
  it.each([
    'test:backup',
    'test:backup:create',
    'test:backup:restore',
    'test:restore',
    'test:restore:full',
  ])('%s executes verification instead of printing success', scriptName => {
    const command = manifest.scripts[scriptName]

    expect(command).toBeTruthy()
    expect(command).not.toMatch(/\becho\b/)
    expect(command).toMatch(/vitest|playwright|npm run/)
  })

  it('runs fail-closed restore coverage in the default backup gate', () => {
    expect(manifest.scripts['test:backup']).toContain('backup-validation.test.ts')
  })

  it('runs the real persistence round trip in the restore E2E gate', () => {
    expect(manifest.scripts['test:restore:e2e']).toContain('backup-restore-live.spec.ts')
    expect(manifest.scripts['test:restore:e2e']).toContain('run-e2e.sh')
    expect(manifest.scripts['test:restore:e2e']).toContain('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH')
    expect(manifest.scripts['test:restore:e2e']).toContain('FLOWSTATE_E2E_PORT=${FLOWSTATE_E2E_PORT:-15547}')
    expect(manifest.scripts['test:offline-reconnect-flows']).toContain('FLOWSTATE_E2E_PORT=${FLOWSTATE_E2E_PORT:-15548}')
    expect(manifest.scripts['preelectron:build']).toContain('test:backup:restore')
    expect(manifest.scripts['preelectron:build']).toContain('test:restore:e2e')
  })

  it('starts an isolated browser server for the release restore gate', () => {
    const config = readFileSync('playwright.config.ts', 'utf8')

    expect(config).toContain('reuseExistingServer: false')
  })
})
