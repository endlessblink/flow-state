import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readAppInitialization = () =>
  readFileSync(resolve(process.cwd(), 'src/composables/app/useAppInitialization.ts'), 'utf-8')

describe('app realtime task delete contract', () => {
  it('does not drop task delete events during the startup safety window', () => {
    const src = readAppInitialization()

    expect(src).toContain('const isDeleteEvent = isHardDelete || isSoftDelete')
    expect(src).toContain('tasks.updateTaskFromSync(taskId, null, true)')
    expect(src).not.toContain('BLOCKED deletion for task')
    expect(src).not.toContain('timeSinceSessionStart < 5000')
  })

  it('recovers when delete events arrive while task load or interaction locks are active', () => {
    const src = readAppInitialization()

    expect(src).toContain('if (taskId && isDeleteEvent) {')
    expect(src).toContain('invalidateCache.all()')
    expect(src).toContain('void reloadCoreData()')
    expect(src).toContain('if (isDeleteEvent) {\n                    invalidateCache.all()\n                    window.setTimeout(() => {')
  })
})
