/**
 * BUG-2108: the desktop focus nudge's "Start timer" must start a plain timer
 * immediately. Opening the task list from the nudge stressed the user.
 * Reads the live nudgePopup block from main.qml.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const qml = readFileSync(resolve(__dirname, '../../../packages/kde-widget/contents/ui/main.qml'), 'utf8')
const nudgeStart = qml.indexOf('id: nudgePopup')
const nudgeBlock = qml.slice(nudgeStart, qml.indexOf('// Action buttons', nudgeStart))

const startHandler = (() => {
  const label = nudgeBlock.indexOf('Start timer"')
  const click = nudgeBlock.indexOf('onClicked:', label)
  return nudgeBlock.slice(click, nudgeBlock.indexOf('}', nudgeBlock.indexOf('{', click)) + 1)
})()

describe('focus nudge Start timer (BUG-2108)', () => {
  it('starts a plain session without a task', () => {
    expect(startHandler).toContain('root.startNewSessionWithTask(null)')
  })

  it('never opens the task list from the nudge', () => {
    expect(startHandler).not.toContain('showNannyPopup')
    expect(nudgeBlock).not.toContain('Time to pick a task')
  })

  it('a plain session is stored as a general (task-less) session', () => {
    const fn = qml.slice(qml.indexOf('function startNewSessionWithTask('), qml.indexOf('function startNewSessionWithTask(') + 1500)
    expect(fn).toContain('task_id: taskId || "general"')
  })
})
