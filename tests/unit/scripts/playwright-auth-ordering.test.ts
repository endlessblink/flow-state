import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('authenticated Playwright setup ordering', () => {
  it('requires global-setup auth state instead of checking it during config import', () => {
    const config = readFileSync('playwright.config.ts', 'utf8')
    expect(config).toContain('globalSetup: "./tests/global-setup.ts"')
    expect(config).toContain('storageState: authFile')
    expect(config).not.toContain('fs.existsSync(authFile)')
    expect(config).not.toContain('hasAuth')
  })

  it('requires the independent realtime client to use the same authenticated state', () => {
    const fixture = readFileSync('tests/fixtures/two-client.ts', 'utf8')
    expect(fixture).toContain('browser.newContext({ storageState: AUTH_FILE })')
    expect(fixture).not.toContain('hasSeededAuth')
    expect(fixture).toContain('fail closed')
  })
})
