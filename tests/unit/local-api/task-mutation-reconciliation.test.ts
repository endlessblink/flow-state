import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const server = readSource('server/local-api/server.cjs')
const electronMain = readSource('electron/ipc/localApi.ts')
const preload = readSource('electron/preload.ts')
const rendererBridge = readSource('src/composables/useLocalApiBridge.ts')
const appInitialization = readSource('src/composables/app/useAppInitialization.ts')

function functionSlice(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`function ${name}(`)
  const asyncStart = source.indexOf(`async function ${name}(`)
  const actualStart = start === -1 ? asyncStart : start
  expect(actualStart, `${name} not found`).toBeGreaterThan(-1)

  const next = source.indexOf(`function ${nextName}(`, actualStart + name.length)
  const asyncNext = source.indexOf(`async function ${nextName}(`, actualStart + name.length)
  const candidates = [next, asyncNext].filter((value) => value > actualStart)
  const actualEnd = candidates.length ? Math.min(...candidates) : source.length
  return source.slice(actualStart, actualEnd)
}

describe('BUG-1942 Local Task API renderer reconciliation', () => {
  it('notifies the Electron parent after successful task create, patch, and delete writes', () => {
    const create = functionSlice(server, 'handleCreateTask', 'handlePatchTask')
    const patch = functionSlice(server, 'handlePatchTask', 'handleGetTaskInstances')
    const remove = functionSlice(server, 'handleDeleteTask', 'handleGetCurrentTimer')

    expect(create).toContain("notifyTaskMutation('create', id)")
    expect(patch).toContain("notifyTaskMutation('update', id)")
    expect(remove).toContain("notifyTaskMutation('delete', id)")
  })

  it('forwards only the task mutation identity from utility process to renderer', () => {
    expect(server).toContain("PARENT_PORT.postMessage({ type: 'taskMutation', operation, taskId })")
    expect(electronMain).toContain("m?.type === 'taskMutation'")
    expect(electronMain).toContain("webContents.send('localApi:taskMutation'")
    expect(electronMain).not.toContain("webContents.send('localApi:taskMutation', latestSession")
    expect(preload).toContain('onLocalApiTaskMutation')
    expect(preload).toContain("ipcRenderer.on('localApi:taskMutation'")
  })

  it('invalidates task cache and reloads the active renderer store on mutation notice', () => {
    expect(rendererBridge).toContain('subscribeLocalApiTaskMutations')
    expect(appInitialization).toContain('subscribeLocalApiTaskMutations')
    expect(appInitialization).toContain('invalidateCache.tasks()')
    expect(appInitialization).toContain('authoritativeTaskIds')
    expect(appInitialization).toContain('taskStore.loadFromDatabase({ authoritativeTaskIds')
    expect(readSource('src/stores/tasks/taskPersistence.ts')).toContain('authoritativeTaskIds.has(localTask.id)')
  })

  it('publishes the active workspace immediately and whenever it changes', () => {
    expect(appInitialization).toContain('syncLocalApiWorkspaceContext')
    expect(appInitialization).toContain('workspaceStore.activeWorkspaceId')
    expect(appInitialization).toContain('{ immediate: true }')
  })
})
