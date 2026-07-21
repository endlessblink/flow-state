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
  it('notifies the Electron parent after verified lifecycle, patch, and delete writes', () => {
    const lifecycle = functionSlice(server, 'handleTaskLifecycle', 'handlePatchTask')
    const patch = functionSlice(server, 'handlePatchTask', 'handleGetTaskInstances')
    const remove = functionSlice(server, 'handleDeleteTask', 'handleGetCurrentTimer')

    expect(lifecycle).toContain('executeCanonicalTaskLifecycle(ctx, body, notifyTaskMutation)')
    expect(patch).toContain('executeCanonicalTaskPatch(ctx, id, body, notifyTaskMutation)')
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

  it('updates companion timer cache and reconciles an available renderer', () => {
    expect(server).toContain("PARENT_PORT.postMessage({ type: 'timerMutation', session })")
    expect(server).toContain('localTimerSnapshot = {')
    expect(electronMain).toContain("m?.type === 'timerMutation'")
    expect(electronMain).toContain("webContents.send('localApi:timerMutation'")
    expect(preload).toContain("ipcRenderer.on('localApi:timerMutation'")
    expect(rendererBridge).toContain('subscribeLocalApiTimerMutations')
    expect(readSource('src/stores/timer.ts')).toContain('sync.resyncFromDatabase(true)')
    expect(readSource('src/composables/timer/useTimerSync.ts')).toContain('if (!force && now - lastResyncAt < 1000) return')
  })

  it('lets the sidecar refresh its signed user session without a renderer heartbeat', () => {
    const tokenContext = server.slice(
      server.indexOf('async function applySession('),
      server.indexOf('// --- Status mapping'),
    )
    expect(tokenContext).toContain('autoRefreshToken: true')
    expect(tokenContext).toContain('persistSession: false')
    expect(tokenContext).toContain("event !== 'TOKEN_REFRESHED'")
    expect(tokenContext).toContain("type: 'sessionRefresh'")
    expect(electronMain).toContain("m?.type === 'sessionRefresh'")
    expect(electronMain).toContain('m.userId === latestSession.userId')
    expect(electronMain).toContain('refreshToken: m.refreshToken')
  })

  it('materializes elapsed companion time and closes expired rows on canonical reads', () => {
    const current = functionSlice(server, 'handleGetCurrentTimer', 'handleGetTimerDiagnostics')
    expect(current).toContain('const elapsedSeconds')
    expect(current).toContain('remaining_time: remainingTime')
    expect(current).toContain('is_active: remainingTime > 0')
    expect(current).toContain("device_leader_id: 'flowstate-companion'")
    expect(current).toContain("if (remainingTime <= 0) return send(res, 200, { active: false, session: null })")
  })
})
