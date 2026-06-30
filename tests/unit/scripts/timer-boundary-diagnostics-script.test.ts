import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SCRIPT = readFileSync(
  resolve(__dirname, '../../../scripts/diagnose-timer-boundary.cjs'),
  'utf-8',
)

describe('timer boundary diagnostics script contract', () => {
  it('captures the runtime surfaces needed for recurring Electron/KDE timer failures', () => {
    expect(SCRIPT).toContain('/api/timer/diagnostics')
    expect(SCRIPT).toContain('/api/timer/current')
    expect(SCRIPT).toContain('/tmp/flowstate-active-task.json')
    expect(SCRIPT).toContain('latest-linux.yml')
    expect(SCRIPT).toContain('package.json')
    expect(SCRIPT).toContain('ps')
  })
})
