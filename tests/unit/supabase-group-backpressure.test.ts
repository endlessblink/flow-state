import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { classifyError } from '@/services/offline/retryStrategy'

describe('Supabase group save backpressure', () => {
  it('keeps Electron canvas group saves local-first when Supabase rate limits writes', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/composables/supabase/useGroupsDatabase.ts'),
      'utf8'
    )

    expect(source).toContain('GROUP_SAVE_BACKPRESSURE_COOLDOWN_MS')
    expect(source).toContain("status === '429'")
    expect(source).toContain('groupSaveBackpressureUntil = Date.now() + GROUP_SAVE_BACKPRESSURE_COOLDOWN_MS')
    expect(source).toContain('return')
    expect(source).toContain('groupSaveInFlight.has(group.id)')
  })

  it('routes normal task and group mutations through the queue instead of direct Supabase saves', () => {
    const taskSource = readFileSync(
      resolve(process.cwd(), 'src/stores/tasks/taskOperations.ts'),
      'utf8'
    )
    const createStart = taskSource.indexOf('const createTask = async')
    const updateStart = taskSource.indexOf('const updateTask = async', createStart)
    const createTaskSource = taskSource.slice(createStart, updateStart)
    const deleteStart = taskSource.indexOf('const deleteTask = async')
    const permanentDeleteStart = taskSource.indexOf('const permanentlyDeleteTask = async', deleteStart)
    const deleteTaskSource = taskSource.slice(deleteStart, permanentDeleteStart)
    const bulkDeleteStart = taskSource.indexOf('const bulkDeleteTasks = async')
    const moveTaskStart = taskSource.indexOf('const moveTask = async', bulkDeleteStart)
    const bulkDeleteSource = taskSource.slice(bulkDeleteStart, moveTaskStart)

    expect(createTaskSource).toContain('syncOrchestrator.enqueue')
    expect(createTaskSource).not.toContain('saveSpecificTasks(')
    expect(deleteTaskSource).toContain('syncOrchestrator.enqueue')
    expect(deleteTaskSource).not.toContain('saveTasksToStorage(')
    expect(bulkDeleteSource).toContain('syncOrchestrator.enqueue')
    expect(bulkDeleteSource).not.toContain('saveTasksToStorage(')
    expect(bulkDeleteSource).not.toContain('bulkDeleteTasksFromStorage(')

    const canvasSource = readFileSync(
      resolve(process.cwd(), 'src/stores/canvas.ts'),
      'utf8'
    )
    const saveGroupStart = canvasSource.indexOf('const saveGroupToStorage = async')
    const viewportStart = canvasSource.indexOf('  // 3. Viewport Layer', saveGroupStart)
    const saveGroupSource = canvasSource.slice(saveGroupStart, viewportStart)

    expect(saveGroupSource).toContain('useSyncOrchestrator().enqueue')
    expect(saveGroupSource).not.toContain('await saveGroup(')
  })

  it('classifies HTTP 429 as central rate-limit backpressure', () => {
    expect(classifyError({ status: 429, message: 'Too Many Requests' })).toBe('rate_limit')
    expect(classifyError({ code: '429', message: 'rate limited' })).toBe('rate_limit')
  })

  it('does not call Date-only timestamp methods after JSON-decoding error details', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/utils/errorHandler.ts'),
      'utf8'
    )
    const showFullErrorStart = source.indexOf('window.showFullError =')
    const showFullErrorSource = source.slice(showFullErrorStart)

    expect(source).toContain('const formatErrorTimestamp =')
    expect(showFullErrorSource).toContain('formatErrorTimestamp(error.timestamp)')
    expect(showFullErrorSource).not.toContain('error.timestamp.toISOString()')
  })
})
