import { createClient } from '@supabase/supabase-js'
import { expect, test } from '../fixtures/auth'
import { ensureAuthUser, TEST_USER } from '../fixtures/auth'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const TASK_ID = 'bacc0000-0000-4000-8000-000000000001'
const TASK_TITLE = 'Absolute Recovery Round Trip'
const DELETED_TASK_ID = 'bacc0000-0000-4000-8000-000000000002'
const DELETED_TASK_TITLE = 'Recoverable Trash Inventory'
const PERMANENT_DELETED_ID = 'bacc0000-0000-4000-8000-000000000003'

test.describe.serial('absolute task backup and recovery', () => {
  test.skip(!SERVICE_ROLE_KEY, 'requires local Supabase service role key')

  test('backs up, loses, restores, reads back, and reloads a complete task', async ({ page }) => {
    const backupLogs: string[] = []
    page.on('console', message => {
      const text = message.text()
      if (text.includes('[Backup]') || text.includes('[TASK-344]')) backupLogs.push(text)
    })
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const userId = (await ensureAuthUser(admin, { ...TEST_USER, email_confirm: true })).id

    await admin.from('tasks').delete().in('id', [TASK_ID, DELETED_TASK_ID])
    await admin.from('tombstones').delete().in('entity_id', [TASK_ID, DELETED_TASK_ID, PERMANENT_DELETED_ID])

    try {
      await page.goto('/#/tasks')
      await page.waitForFunction(() => {
        const root = document.querySelector('#app') as any
        return !!root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks')
      }, { timeout: 30_000 })

      await page.evaluate(async ({ id, title }) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        await tasks.createTask({
          id,
          title,
          description: 'Must survive a complete backup restore cycle',
          status: 'planned',
          priority: 'high',
          tags: ['recovery', 'absolute-existence'],
          estimatedDuration: 47,
          isInInbox: true,
          subtasks: [
            {
              id: `${id}-subtask`,
              title: 'Recovery subtask',
              isCompleted: false,
              completedPomodoros: 0,
              estimatedPomodoros: 1,
            },
          ],
        })
      }, { id: TASK_ID, title: TASK_TITLE })

      await expect(async () => {
        const { data, error } = await admin
          .from('tasks')
          .select('id,title,description,priority,tags,estimated_duration,subtasks,is_deleted')
          .eq('id', TASK_ID)
          .single()
        expect(error).toBeNull()
        expect(data).toEqual(expect.objectContaining({
          id: TASK_ID,
          title: TASK_TITLE,
          description: 'Must survive a complete backup restore cycle',
          priority: 'high',
          estimated_duration: 47,
          is_deleted: false,
        }))
        expect(data?.tags).toEqual(expect.arrayContaining(['recovery', 'absolute-existence']))
        expect(data?.subtasks).toEqual(expect.arrayContaining([
          expect.objectContaining({ title: 'Recovery subtask', isCompleted: false }),
        ]))
      }).toPass({ timeout: 12_000 })

      const { error: trashSeedError } = await admin.from('tasks').insert({
        id: DELETED_TASK_ID,
        user_id: userId,
        title: DELETED_TASK_TITLE,
        status: 'planned',
        priority: 'medium',
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      expect(trashSeedError).toBeNull()
      const { error: tombstoneSeedError } = await admin.from('tombstones').insert({
        user_id: userId,
        entity_type: 'task',
        entity_id: PERMANENT_DELETED_ID,
        deleted_at: new Date().toISOString(),
        expires_at: null,
      })
      expect(tombstoneSeedError).toBeNull()

      const backupJson = await page.evaluate(async (taskId) => {
        const { default: useBackupSystem } = await import('/src/composables/useBackupSystem.ts')
        const backup = await useBackupSystem().createBackup('manual')
        if (!backup) throw new Error('Backup creation returned null')
        if (!backup.tasks.some(task => task.id === taskId)) {
          throw new Error('Backup omitted the recovery probe task')
        }
        return JSON.stringify(backup)
      }, TASK_ID)
      const backup = JSON.parse(backupJson) as {
        checksum: string
        metadata?: {
          taskCount?: number
          activeTaskCount?: number
          deletedTaskCount?: number
          tombstoneCount?: number
        }
        tombstones?: Array<{ entityType: string; entityId: string }>
        tasks: Array<Record<string, any>>
      }
      expect(backup.checksum).toBeTruthy()
      expect(backup.metadata?.taskCount).toBe(backup.tasks.length)
      expect(backup.metadata?.activeTaskCount).toBe(backup.tasks.length - (backup.metadata?.deletedTaskCount ?? 0))
      expect(backup.metadata?.deletedTaskCount).toBeGreaterThanOrEqual(1)
      expect(backup.metadata?.tombstoneCount).toBeGreaterThanOrEqual(1)
      expect(backup.tasks.find(task => task.id === TASK_ID)).toEqual(expect.objectContaining({
        title: TASK_TITLE,
        description: 'Must survive a complete backup restore cycle',
        estimatedDuration: 47,
      }))
      expect(backup.tasks.find(task => task.id === DELETED_TASK_ID)).toEqual(expect.objectContaining({
        title: DELETED_TASK_TITLE,
        _soft_deleted: true,
      }))
      expect(backup.tombstones).toContainEqual({
        entityType: 'task',
        entityId: PERMANENT_DELETED_ID,
      })

      await page.reload()
      await page.waitForFunction((taskId) => {
        const root = document.querySelector('#app') as any
        const tasks = root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks')
        return tasks?.rawTasks.some((task: any) => task.id === taskId)
      }, TASK_ID, { timeout: 30_000 })
      await expect.poll(async () => page.evaluate(async () => {
        const { getStats } = await import('/src/services/offline/writeQueueDB.ts')
        const stats = await getStats()
        return stats.pendingCount + stats.syncingCount + stats.failedCount + stats.conflictCount
      }), { timeout: 20_000 }).toBe(0)

      const { error: deleteError } = await admin.from('tasks').delete().in('id', [TASK_ID, DELETED_TASK_ID])
      expect(deleteError).toBeNull()
      await admin.from('tombstones').delete().in('entity_id', [TASK_ID, DELETED_TASK_ID, PERMANENT_DELETED_ID])
      const { data: absent } = await admin.from('tasks').select('id').in('id', [TASK_ID, DELETED_TASK_ID])
      expect(absent).toEqual([])

      const restoreAnalysis = await page.evaluate(async ({ serializedBackup, taskId }) => {
        const { default: useBackupSystem } = await import('/src/composables/useBackupSystem.ts')
        const analysis = await useBackupSystem().analyzeRestore(serializedBackup)
        return {
          available: analysis.tasks.available,
          toRestore: analysis.tasks.toRestore.map(task => task.id),
          probeSkipReason: analysis.tasks.skipped.find(({ task }) => task.id === taskId)?.reason ?? null,
        }
      }, { serializedBackup: backupJson, taskId: TASK_ID })
      expect(
        restoreAnalysis.toRestore,
        restoreAnalysis.probeSkipReason ?? `analysis reported ${restoreAnalysis.available} available tasks`
      ).toContain(TASK_ID)
      expect(restoreAnalysis.toRestore).toContain(DELETED_TASK_ID)

      const restoreResult = await page.evaluate(async (serializedBackup) => {
        const { default: useBackupSystem } = await import('/src/composables/useBackupSystem.ts')
        const backupSystem = useBackupSystem()
        const restored = await backupSystem.restoreBackup(serializedBackup, {
          backupSource: 'playwright-absolute-recovery',
        })
        return { restored, error: backupSystem.state.value.error }
      }, backupJson)
      expect(restoreResult.restored, restoreResult.error ?? undefined).toBe(true)

      const { data: restoredRow, error: restoredError } = await admin
        .from('tasks')
        .select('id,user_id,title,description,priority,tags,estimated_duration,subtasks,is_deleted')
        .eq('id', TASK_ID)
        .single()
      expect(restoredError, backupLogs.join('\n')).toBeNull()
      expect(restoredRow).toEqual(expect.objectContaining({
        id: TASK_ID,
        user_id: userId,
        title: TASK_TITLE,
        description: 'Must survive a complete backup restore cycle',
        priority: 'high',
        estimated_duration: 47,
        is_deleted: false,
      }))
      expect(restoredRow?.tags).toEqual(expect.arrayContaining(['recovery', 'absolute-existence']))
      expect(restoredRow?.subtasks).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: 'Recovery subtask', isCompleted: false }),
      ]))
      const { data: restoredDeletedRow, error: restoredDeletedError } = await admin
        .from('tasks')
        .select('id,user_id,title,is_deleted')
        .eq('id', DELETED_TASK_ID)
        .single()
      expect(restoredDeletedError).toBeNull()
      expect(restoredDeletedRow).toEqual({
        id: DELETED_TASK_ID,
        user_id: userId,
        title: DELETED_TASK_TITLE,
        is_deleted: true,
      })
      const { data: restoredTombstone, error: restoredTombstoneError } = await admin
        .from('tombstones')
        .select('entity_type,entity_id,user_id,expires_at')
        .eq('entity_id', PERMANENT_DELETED_ID)
        .single()
      expect(restoredTombstoneError).toBeNull()
      expect(restoredTombstone).toEqual({
        entity_type: 'task',
        entity_id: PERMANENT_DELETED_ID,
        user_id: userId,
        expires_at: null,
      })

      await page.reload()
      await page.waitForFunction((taskId) => {
        const root = document.querySelector('#app') as any
        const tasks = root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks')
        return tasks?.rawTasks.some((task: any) => task.id === taskId)
      }, TASK_ID, { timeout: 30_000 })
      const reloadedTask = await page.evaluate((taskId) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        return tasks.rawTasks.find((task: any) => task.id === taskId)
      }, TASK_ID)
      expect(reloadedTask).toEqual(expect.objectContaining({
        id: TASK_ID,
        title: TASK_TITLE,
        description: 'Must survive a complete backup restore cycle',
        priority: 'high',
        estimatedDuration: 47,
      }))
      expect(reloadedTask.tags).toEqual(expect.arrayContaining(['recovery', 'absolute-existence']))
    } finally {
      await admin.from('tasks').delete().in('id', [TASK_ID, DELETED_TASK_ID])
      await admin.from('tombstones').delete().in('entity_id', [TASK_ID, DELETED_TASK_ID, PERMANENT_DELETED_ID])
    }
  })

  test('refuses restore without deleting an offline edit, then syncs that edit after reconnect', async ({ page }) => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const userId = (await ensureAuthUser(admin, { ...TEST_USER, email_confirm: true })).id
    const offlineTitle = `${TASK_TITLE} Offline Edit`

    await admin.from('tasks').delete().eq('id', TASK_ID)
    await admin.from('tombstones').delete().eq('entity_id', TASK_ID)

    try {
      await page.goto('/#/tasks')
      await page.waitForFunction(() => {
        const root = document.querySelector('#app') as any
        return !!root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks')
      }, { timeout: 30_000 })

      await page.evaluate(async ({ id, title }) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        await tasks.createTask({
          id,
          title,
          status: 'planned',
          priority: 'high',
          isInInbox: true,
        })
      }, { id: TASK_ID, title: TASK_TITLE })
      await expect(async () => {
        const { data } = await admin.from('tasks').select('title').eq('id', TASK_ID).single()
        expect(data?.title).toBe(TASK_TITLE)
      }).toPass({ timeout: 12_000 })

      const backupJson = await page.evaluate(async () => {
        const { default: useBackupSystem } = await import('/src/composables/useBackupSystem.ts')
        const backup = await useBackupSystem().createBackup('manual')
        if (!backup) throw new Error('Backup creation returned null')
        return JSON.stringify(backup)
      })

      await page.context().setOffline(true)
      await page.evaluate(async ({ id, title }) => {
        const root = document.querySelector('#app') as any
        const tasks = root.__vue_app__._context.config.globalProperties.$pinia._s.get('tasks')!
        await tasks.updateTask(id, { title }, 'USER')
      }, { id: TASK_ID, title: offlineTitle })

      const restoreAttempt = await page.evaluate(async (serializedBackup) => {
        const { default: useBackupSystem } = await import('/src/composables/useBackupSystem.ts')
        const queue = await import('/src/services/offline/writeQueueDB.ts')
        const backupSystem = useBackupSystem()
        const restored = await backupSystem.restoreBackup(serializedBackup, {
          backupSource: 'playwright-preserve-offline-edit',
        })
        return {
          restored,
          error: backupSystem.state.value.error,
          queued: (await queue.getPendingOperations()).map(operation => ({
            entityId: operation.entityId,
            payload: operation.payload,
          })),
        }
      }, backupJson)
      expect(restoreAttempt.restored).toBe(false)
      expect(restoreAttempt.error).toContain('unsynced local change')
      expect(restoreAttempt.queued).toEqual(expect.arrayContaining([
        expect.objectContaining({
          entityId: TASK_ID,
          payload: expect.objectContaining({ title: offlineTitle }),
        }),
      ]))

      await page.context().setOffline(false)
      await expect(async () => {
        const { data, error } = await admin
          .from('tasks')
          .select('user_id,title')
          .eq('id', TASK_ID)
          .single()
        expect(error).toBeNull()
        expect(data).toEqual({ user_id: userId, title: offlineTitle })
      }).toPass({ timeout: 20_000 })

      await page.reload()
      await page.waitForFunction(({ taskId, title }) => {
        const root = document.querySelector('#app') as any
        const tasks = root?.__vue_app__?._context.config.globalProperties.$pinia?._s.get('tasks')
        return tasks?.rawTasks.some((task: any) => task.id === taskId && task.title === title)
      }, { taskId: TASK_ID, title: offlineTitle }, { timeout: 30_000 })
    } finally {
      await page.context().setOffline(false)
      await admin.from('tasks').delete().eq('id', TASK_ID)
      await admin.from('tombstones').delete().eq('entity_id', TASK_ID)
    }
  })
})
