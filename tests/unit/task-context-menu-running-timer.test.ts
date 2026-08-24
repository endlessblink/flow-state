import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(__dirname, '../../src/components/tasks/TaskContextMenu.vue'), 'utf8')

describe('TaskContextMenu running timer indicator', () => {
  it('shows the active task and elapsed timer state before task actions', () => {
    expect(source).toContain('isCurrentTaskRunning')
    expect(source).toContain('timerStore.currentTaskId')
    expect(source).toContain('timerStore.displayTime')
    expect(source).toContain('running-task-indicator')
    expect(source).toContain('Running now')
  })
})
