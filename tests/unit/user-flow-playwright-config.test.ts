import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('user-flow Playwright runtime', () => {
  it('uses the configured Chromium executable when the bundled browser is unavailable', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'tests/user-flows/playwright.config.ts'),
      'utf8',
    )

    expect(source).toContain('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH')
    expect(source).toContain('executablePath:')
  })

  it('builds the exact web artifact before every user-flow gate', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
    const flowGates = [
      'test:user-flows',
      'test:task-flows',
      'test:navigation-flows',
      'test:calendar-flows',
      'test:advanced-flows',
    ]

    for (const gate of flowGates) {
      expect(packageJson.scripts[`pre${gate}`], gate).toBe('npm run build')
    }
  })
})
