import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appHeader = readFileSync(resolve(process.cwd(), 'src/layouts/AppHeader.vue'), 'utf8')

describe('TASK-2073: completed-work break offer', () => {
  it('renders a visible, live break prompt beside the start-break action', () => {
    expect(appHeader).toContain('v-if="timerStore.hasPendingBreak"')
    expect(appHeader).toContain('data-testid="timer-break-offer"')
    expect(appHeader).toContain('Time for a break')
    expect(appHeader).toContain('data-testid="timer-start-break"')
  })
})
