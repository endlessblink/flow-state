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

    expect(src).toContain('invalidateCache.all()')
    expect(src).toContain('await reloadCoreData()')
    expect(src).toContain('if (taskId) recoverSkippedTaskChange()')
    expect(src).toContain('if (isDeleteEvent) {')
  })

  it('recovers skipped non-delete task events instead of dropping cross-runtime updates', () => {
    const src = readAppInitialization()

    expect(src).toContain('const recoverSkippedTaskChange = () => {')
    expect(src).toContain('recoverSkippedTaskChange()')
    expect(src).toContain('if (tasks.isPendingWrite(taskId)) {')
    expect(src).toContain('if (tasks.isLoadingFromDatabase) {')
    expect(src).toContain('window.setTimeout(() => {')
    expect(src).toContain('await reloadCoreData()')
  })

  it('replays queued optimistic task state after every authoritative recovery reload', () => {
    const src = readAppInitialization()

    expect(src).toContain('const recoverSkippedTaskChange = () => {')
    expect(src).toContain('await runWithQueueProcessorBarrier(async () => {')
    expect(src).toContain('await reapplyPendingWrites()')
  })

  it('opens a shared-workspace offline cache only for the matching durable session', () => {
    const src = readAppInitialization()

    expect(src).toContain('persistedSession?.user?.id === persistedIdentity.id')
    expect(src).toContain("persistedWorkspace && persistedWorkspace !== 'personal'")
    expect(src).toContain('workspaceId: persistedWorkspace')
  })
})
