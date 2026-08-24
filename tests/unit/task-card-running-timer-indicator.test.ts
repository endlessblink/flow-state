import { describe, expect, it } from 'vitest'
import fs from 'node:fs'

const source = fs.readFileSync('src/components/kanban/TaskCard.vue', 'utf8')
const styles = fs.readFileSync('src/components/kanban/TaskCard.css', 'utf8')

describe('TaskCard running timer indicator', () => {
  it('shows a live running label and softly pulsing dot on the active board card', () => {
    expect(source).toContain('v-if="isTimerActive"')
    expect(source).toContain('class="timer-running-indicator"')
    expect(source).toContain('timerStore.displayTime')
    expect(source).toContain('class="timer-running-dot"')
    expect(styles).toContain('animation: timer-running-pulse 2.2s ease-in-out infinite')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
