import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/composables/app/useAppInitialization.ts'),
  'utf8',
)
const taskPersistenceSource = readFileSync(
  resolve(process.cwd(), 'src/stores/tasks/taskPersistence.ts'),
  'utf8',
)

describe('TASK-1947 app catch-up integration', () => {
  it('binds the signed-in active scope to cursor, Supabase reader, and authoritative task reload', () => {
    expect(source).toContain('createCanonicalChangeCursorStore')
    expect(source).toContain('createCanonicalChangeSupabaseReader')
    expect(source).toContain('createCanonicalChangeCatchup')
    expect(source).toContain('authoritativeTaskIds,')
    expect(source).toContain('authorityScope:')
    expect(source).toContain('scopeMatchesActiveWorkspace')
    expect(taskPersistenceSource).toContain('requireRemoteAuthority?: boolean')
    expect(taskPersistenceSource).toContain('authorityScope?: { userId: string; workspaceId: string | null }')
    expect(taskPersistenceSource).toContain('options.authoritativeTaskIds || options.requireRemoteAuthority')
    expect(taskPersistenceSource).toContain('!requireRemoteAuthority && timeSinceSessionStart < 60000')
    expect(taskPersistenceSource).toContain('overlayPendingTaskWrites(loadedTasks')
    expect(taskPersistenceSource).toContain('requireRemoteAuthority && !hasPendingTaskWrite(localTask.id)')
    expect(taskPersistenceSource).toContain('throwOnError: requireRemoteAuthority')
  })

  it('runs catch-up after full reload recovery and workspace switches', () => {
    expect(source).toContain('runCanonicalChangeCatchup')
    expect(source).toContain('await reloadCoreData()\n            await runCanonicalChangeCatchup()')
    expect(source).toContain('await reloadCoreData()\n        await runCanonicalChangeCatchup()')
  })

  it('rebaselines an empty authenticated projection after startup failure and post-sign-in', () => {
    expect(source).toContain("recoverCanonicalProjectionIfEmpty('background-refresh-failed')")
    expect(source).toContain("recoverCanonicalProjectionIfEmpty('post-sign-in')")
  })

  it('starts and stops bounded convergence for visible and hidden renderers', () => {
    expect(source).toContain('createCanonicalChangePoller')
    expect(source).toContain('canonicalChangePoller.start()')
    expect(source).toContain('canonicalChangePoller.stop()')
    expect(source).toContain("document.visibilityState !== 'visible'")
    expect(source).toContain("document.addEventListener('visibilitychange', reloadAuthoritativeOnForeground)")
    expect(source).toContain("window.addEventListener('focus', reloadAuthoritativeOnForeground)")
    expect(source).toContain("document.removeEventListener('visibilitychange', reloadAuthoritativeOnForeground)")
    expect(source).toContain("window.removeEventListener('focus', reloadAuthoritativeOnForeground)")
    expect(source).toContain('invalidateCache.all()\n                await reloadCoreData()')
    expect(source).toContain('intervalMs: 5_000')
  })
})
