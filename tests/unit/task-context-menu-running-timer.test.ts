import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(__dirname, '../../src/components/tasks/TaskContextMenu.vue'), 'utf8')

describe('TaskContextMenu running timer indicator', () => {
  it('shows the active task and elapsed timer state before task actions', () => {
    expect(source).toContain('runningTimerTask')
    expect(source).toContain('timerStore.currentTaskId')
    expect(source).toContain('timerStore.displayTime')
    expect(source).toContain('running-task-indicator')
    expect(source).toContain('Timer running')
  })

  it('offers a stop action whenever a timer is active', () => {
    expect(source).toContain('Stop Timer')
    expect(source).toContain('timerStore.isTimerActive && !isBatchOperation')
    expect(source).toContain('@click="stopTimer"')
    expect(source).toContain('await timerStore.stopTimer()')
  })
})
