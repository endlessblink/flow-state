import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SERVER_CJS = readFileSync(
  resolve(__dirname, '../../../server/local-api/server.cjs'),
  'utf-8',
)

function functionBody(name: string): string {
  const start = SERVER_CJS.indexOf(`function ${name}(`)
  const asyncStart = SERVER_CJS.indexOf(`async function ${name}(`)
  const fnStart = start === -1 ? asyncStart : start
  expect(fnStart, `${name} not found`).toBeGreaterThan(-1)

  const nextSection = SERVER_CJS.indexOf('\n// ---', fnStart + name.length)
  return SERVER_CJS.slice(fnStart, nextSection === -1 ? undefined : nextSection)
}

describe('Local API sidecar timer endpoint regression contract', () => {
  it('exposes GET /api/timer/current before Life OS bearer-token protected task routes', () => {
    const timerRoute = SERVER_CJS.indexOf("path === '/api/timer/current'")
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')
    const tasksRoute = SERVER_CJS.indexOf("path === '/api/tasks'")

    expect(timerRoute, 'timer route not found').toBeGreaterThan(-1)
    expect(tokenCheck, 'token check not found').toBeGreaterThan(-1)
    expect(tasksRoute, 'tasks route not found').toBeGreaterThan(-1)
    expect(timerRoute).toBeLessThan(tokenCheck)
    expect(tasksRoute).toBeGreaterThan(tokenCheck)
  })

  it('serves a renderer-owned KDE timer snapshot before requiring Supabase auth context', () => {
    const ctxCheck = SERVER_CJS.indexOf("if (!ctx) return send(res, 503, { error: 'not signed in' })")
    const timerRoute = SERVER_CJS.indexOf("path === '/api/timer/current'")
    const localSnapshotCheck = SERVER_CJS.indexOf('const localTimer = getLocalTimerResponse()')

    expect(ctxCheck, 'auth context check not found').toBeGreaterThan(-1)
    expect(timerRoute, 'timer route not found').toBeGreaterThan(-1)
    expect(localSnapshotCheck, 'local timer snapshot check not found').toBeGreaterThan(-1)
    expect(timerRoute).toBeLessThan(ctxCheck)
    expect(localSnapshotCheck).toBeGreaterThan(timerRoute)
    expect(localSnapshotCheck).toBeLessThan(ctxCheck)
  })

  it('exposes loopback-only timer diagnostics before bearer-token protected routes', () => {
    const diagnosticsRoute = SERVER_CJS.indexOf("path === '/api/timer/diagnostics'")
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')
    const tasksRoute = SERVER_CJS.indexOf("path === '/api/tasks'")

    expect(diagnosticsRoute, 'timer diagnostics route not found').toBeGreaterThan(-1)
    expect(diagnosticsRoute).toBeLessThan(tokenCheck)
    expect(diagnosticsRoute).toBeLessThan(tasksRoute)
  })

  it('diagnoses timer boundary state without exposing secrets or full task rows', () => {
    const body = functionBody('handleGetTimerDiagnostics')

    expect(body).toContain('appVersion')
    expect(body).toContain('hasAuthContext')
    expect(body).toContain('hasLocalTimerSnapshot')
    expect(body).toContain('localSnapshotActive')
    expect(body).toContain('localSnapshotAgeMs')
    expect(body).toContain('currentTimerBranch')
    expect(body).toContain('supabaseActiveSessionFound')
    expect(body).not.toContain('accessToken')
    expect(body).not.toContain('refreshToken')
    expect(body).not.toContain('anonKey')
    expect(body).not.toContain('title')
  })

  it('keeps renderer-owned local snapshots fresh enough for the KDE widget clock', () => {
    const body = functionBody('getLocalTimerResponse')

    expect(body).toContain("source: 'local-snapshot'")
    expect(SERVER_CJS).toContain('LOCAL_TIMER_INACTIVE_GRACE_MS')
    expect(body).toContain('Date.now() - updatedAt')
    expect(body).toContain('Math.floor')
    expect(body).toContain('session.is_active && !session.is_paused')
    expect(body).toContain('Math.max(0')
    expect(body).toContain('remaining_time:')
    expect(body).toContain('session.remaining_time <= 0')
    expect(body).toContain("active: false, session: null, source: 'local-snapshot'")
  })

  it('does not let stale inactive local snapshots mask signed-in timer lookup', () => {
    const body = functionBody('getLocalTimerResponse')
    const staleCheck = body.indexOf('snapshotAgeMs > LOCAL_TIMER_INACTIVE_GRACE_MS')
    const inactiveResponse = body.indexOf("active: false, session: null, source: 'local-snapshot'")

    expect(staleCheck, 'stale inactive snapshot guard not found').toBeGreaterThan(-1)
    expect(inactiveResponse, 'fresh inactive tombstone response not found').toBeGreaterThan(-1)
    expect(staleCheck).toBeLessThan(inactiveResponse)
    expect(body.slice(staleCheck, inactiveResponse)).toContain('return null')
  })

  it('does not let stale active local snapshots stuck at zero mask signed-in completion lookup', () => {
    const body = functionBody('getLocalTimerResponse')
    const zeroCheck = body.indexOf('session.remaining_time <= 0')
    const staleCheckAfterZero = body.indexOf('snapshotAgeMs > LOCAL_TIMER_INACTIVE_GRACE_MS', zeroCheck)
    const inactiveResponse = body.indexOf("active: false, session: null, source: 'local-snapshot'", zeroCheck)

    expect(zeroCheck, 'zero remaining-time branch not found').toBeGreaterThan(-1)
    expect(staleCheckAfterZero, 'stale active-zero snapshot guard not found').toBeGreaterThan(zeroCheck)
    expect(inactiveResponse, 'active-zero inactive response not found').toBeGreaterThan(zeroCheck)
    expect(staleCheckAfterZero).toBeLessThan(inactiveResponse)
    expect(body.slice(staleCheckAfterZero, inactiveResponse)).toContain('return null')
  })

  it('accepts parent-process timerSnapshot messages independently of auth session messages', () => {
    const messageHandlerStart = SERVER_CJS.indexOf("PARENT_PORT.on('message'")
    expect(messageHandlerStart, 'process message handler not found').toBeGreaterThan(-1)
    const body = SERVER_CJS.slice(messageHandlerStart, messageHandlerStart + 1600)

    expect(body).toContain("msg.type === 'timerSnapshot'")
    expect(body).toContain('localTimerSnapshot = msg.snapshot || null')
    expect(body).toContain("msg.type === 'session'")
    expect(body).toContain("msg.type === 'clear'")
  })

  it('queries only the current user active timer session and returns an inactive payload when absent', () => {
    const body = functionBody('handleGetCurrentTimer')

    expect(body).toContain(".from('timer_sessions')")
    expect(body).toContain(".eq('user_id', userId)")
    expect(body).toContain(".eq('is_active', true)")
    expect(body).toContain(".order('updated_at', { ascending: false })")
    expect(body).toContain('.limit(1)')
    expect(body).toContain('.maybeSingle()')
    expect(body).toContain('return send(res, 200, { active: false, session: null })')
    expect(body).toContain('send(res, 200, { active: true, session: data })')
  })

  it('exposes signed-in local timer controls before the external-app bearer token boundary', () => {
    const controlRoute = SERVER_CJS.indexOf("path === '/api/timer/control'")
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')

    expect(controlRoute, 'timer control route not found').toBeGreaterThan(-1)
    expect(controlRoute).toBeLessThan(tokenCheck)

    const body = functionBody('handlePostTimerControl')
    expect(body).toContain("action === 'toggle'")
    expect(body).toContain("action === 'start'")
    expect(body).toContain(".from('timer_sessions')")
    expect(body).toContain(".eq('user_id', userId)")
    expect(body).toContain("device_leader_id: 'kde-widget'")
    expect(body).toContain("send(res, 400, { error: 'action must be toggle|start' })")
  })

  it('keeps task endpoints behind the bearer token used by external local apps', () => {
    const tokenBlockStart = SERVER_CJS.indexOf('if (TOKEN)')
    const tokenBlock = SERVER_CJS.slice(tokenBlockStart, tokenBlockStart + 220)

    expect(tokenBlock).toContain('req.headers.authorization')
    expect(tokenBlock).toContain('Bearer ${TOKEN}')
    expect(tokenBlock).toContain('return send(res, 401')
  })

  it('keeps AI clarification runtime endpoints behind the same signed-in and bearer-token boundary', () => {
    const ctxCheck = SERVER_CJS.indexOf("if (!ctx) return send(res, 503, { error: 'not signed in' })")
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')
    const startRoute = SERVER_CJS.indexOf("path === '/api/ai/clarifications/start'")
    const resumeRoute = SERVER_CJS.indexOf("path.match(/^\\/api\\/ai\\/clarifications\\/([^/]+)\\/resume$/)")

    expect(startRoute, 'AI clarification start route not found').toBeGreaterThan(-1)
    expect(resumeRoute, 'AI clarification resume route not found').toBeGreaterThan(-1)
    expect(ctxCheck).toBeLessThan(startRoute)
    expect(tokenCheck).toBeLessThan(startRoute)
    expect(tokenCheck).toBeLessThan(resumeRoute)
  })

  it('creates the Mastra AI runtime from the configured local API data directory', () => {
    expect(SERVER_CJS).toContain("const DATA_DIR = process.env.FLOW_STATE_API_DATA_DIR || join(process.cwd(), '.flowstate-local-api')")
    expect(SERVER_CJS).toContain('createAIMastraRuntime({ dataDir: DATA_DIR })')
  })

  it('exposes a bearer-protected read-only assistant context endpoint after the token boundary', () => {
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')
    const assistantRoute = SERVER_CJS.indexOf("path === '/api/assistant/context'")
    const patchTaskRoute = SERVER_CJS.indexOf("req.method === 'PATCH' && taskMatch")

    expect(assistantRoute, 'assistant context route not found').toBeGreaterThan(-1)
    expect(assistantRoute).toBeGreaterThan(tokenCheck)
    expect(assistantRoute).toBeLessThan(patchTaskRoute)
    expect(SERVER_CJS).toContain('return await handleGetAssistantContext(res)')
  })

  it('summarizes assistant context from user-scoped tables without exposing secrets or full conversations', () => {
    const body = functionBody('handleGetAssistantContext')

    expect(body).toContain(".from('tasks')")
    expect(body).toContain(".from('projects')")
    expect(body).toContain(".from('timer_sessions')")
    expect(body).toContain(".from('pomodoro_history')")
    expect(body).toContain(".from('quick_sort_sessions')")
    expect(body).toContain(".from('user_gamification')")
    expect(body).toContain(".from('ai_conversations')")
    expect(body).toContain(".from('ai_usage_log')")
    expect(body).toContain(".from('project_contexts')")
    expect(body).toContain(".from('task_contexts')")
    expect(body).toContain(".from('memory_events')")
    expect(body).toContain(".from('ai_clarification_events')")
    expect(body).toContain(".from('ai_parameter_beliefs')")
    expect(body).toContain(".from('ai_recommendation_feedback')")
    expect(body).toContain(".eq('user_id', userId)")
    expect(body).toContain('taskPressure')
    expect(body).toContain('focusPatterns')
    expect(body).toContain('projectSignals')
    expect(body).toContain('assistantMemory')
    expect(body).toContain('safeCount')
    expect(body).not.toContain('accessToken')
    expect(body).not.toContain('refreshToken')
    expect(body).not.toContain('anonKey')
    expect(body).not.toContain('messages')
  })

  it('exposes task-instance scheduling routes behind the external-app bearer token boundary', () => {
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')
    const instancesRoute = SERVER_CJS.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)\\/instances$/)")
    const patchTaskRoute = SERVER_CJS.indexOf("req.method === 'PATCH' && taskMatch")

    expect(instancesRoute, 'task instance route not found').toBeGreaterThan(-1)
    expect(instancesRoute).toBeGreaterThan(tokenCheck)
    expect(instancesRoute).toBeLessThan(patchTaskRoute)
    expect(SERVER_CJS).toContain('return await handleGetTaskInstances(decodeURIComponent(taskInstancesMatch[1]), res)')
    expect(SERVER_CJS).toContain('return await handlePostTaskInstance(decodeURIComponent(taskInstancesMatch[1]), req, res)')
  })

  it('reads task instances from only the current user task row without returning full task bodies', () => {
    const body = functionBody('handleGetTaskInstances')

    expect(body).toContain(".from('tasks')")
    expect(body).toContain(".select('id,title,instances')")
    expect(body).toContain(".eq('id', id)")
    expect(body).toContain(".eq('user_id', userId)")
    expect(body).toContain(".eq('is_deleted', false)")
    expect(body).toContain('.maybeSingle()')
    expect(body).toContain("return send(res, 404, { error: 'not found' })")
    expect(body).toContain('instances: normalizeTaskInstances(existing.instances)')
    expect(body).not.toContain('accessToken')
    expect(body).not.toContain('refreshToken')
    expect(body).not.toContain('anonKey')
    expect(body).not.toContain('description')
    expect(body).not.toContain('subtasks')
  })

  it('previews a task instance without mutating and applies by updating only instances', () => {
    const body = functionBody('handlePostTaskInstance')
    const previewBranch = body.slice(body.indexOf('if (preview)'), body.indexOf('const updatedInstances'))

    expect(body).toContain(".from('tasks')")
    expect(body).toContain(".select('id,title,status,priority,due_date,instances')")
    expect(body).toContain(".eq('id', id)")
    expect(body).toContain(".eq('user_id', userId)")
    expect(body).toContain(".eq('is_deleted', false)")
    expect(body).toContain('validateTaskInstanceInput(body)')
    expect(body).toContain('const proposedInstance = buildTaskInstance(body)')
    expect(previewBranch).toContain('buildTaskInstanceResponse(existing, proposedInstance, true)')
    expect(previewBranch).not.toContain('.update(')
    expect(body).toContain('const updatedInstances = [...normalizeTaskInstances(existing.instances), proposedInstance]')
    expect(body).toContain('.update({ instances: updatedInstances, updated_at: now })')
    expect(body).toContain(".eq('id', id)")
    expect(body).toContain(".eq('user_id', userId)")
    expect(body).not.toContain('status:')
    expect(body).not.toContain('title:')
    expect(body).not.toContain('priority:')
    expect(body).not.toContain('due_date:')
  })

  it('validates task instance date, time, duration, and preview shape before scheduling', () => {
    const body = functionBody('validateTaskInstanceInput')

    expect(body).toContain('isValidDateOnly')
    expect(body).toContain('isValidTimeOnly')
    expect(body).toContain('duration')
    expect(body).toContain('preview')
    expect(body).toContain("return { ok: false, error: 'scheduledDate must be YYYY-MM-DD' }")
    expect(body).toContain("return { ok: false, error: 'scheduledTime must be HH:mm' }")
    expect(body).toContain("return { ok: false, error: 'duration must be an integer from 1 to 1440 minutes' }")
    expect(body).toContain("return { ok: false, error: 'preview must be a boolean when provided' }")
  })

  it('returns safe task-instance scheduling responses without secrets or full task dumps', () => {
    const body = functionBody('buildTaskInstanceResponse')

    expect(body).toContain('ok: true')
    expect(body).toContain('preview')
    expect(body).toContain('task: { id: task.id, title: task.title }')
    expect(body).toContain('instance')
    expect(body).not.toContain('accessToken')
    expect(body).not.toContain('refreshToken')
    expect(body).not.toContain('anonKey')
    expect(body).not.toContain('authorization')
    expect(body).not.toContain('messages')
    expect(body).not.toContain('description')
    expect(body).not.toContain('subtasks')
  })

  it('exposes bearer-protected preview-first subtask routes', () => {
    const tokenCheck = SERVER_CJS.indexOf('if (TOKEN)')
    const route = SERVER_CJS.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)\\/subtasks$/)")
    const itemRoute = SERVER_CJS.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)\\/subtasks\\/([^/]+)$/)")
    const deleteRoute = SERVER_CJS.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)\\/subtasks\\/([^/]+)\\/delete$/)")

    expect(route).toBeGreaterThan(tokenCheck)
    expect(itemRoute).toBeGreaterThan(tokenCheck)
    expect(deleteRoute).toBeGreaterThan(tokenCheck)
    expect(SERVER_CJS).toContain('handleGetSubtasks')
    expect(SERVER_CJS).toContain('handleCreateSubtask')
    expect(SERVER_CJS).toContain('handlePatchSubtask')
    expect(SERVER_CJS).toContain('handleDeleteSubtask')
  })

  it('reads only the user-owned task subtask payload', () => {
    const body = functionBody('handleGetSubtasks')
    const finder = functionBody('findTaskForSubtasks')

    expect(body).toContain("findTaskForSubtasks(id, 'id,title,subtasks')")
    expect(finder).toContain('.select(fields)')
    expect(finder).toContain(".eq('user_id', userId)")
    expect(finder).toContain(".eq('is_deleted', false)")
    expect(body).toContain('normalizeSubtasks(existing.subtasks)')
  })

  it('defaults subtask mutations to preview and requires an idempotency key to apply', () => {
    const validation = functionBody('validateSubtaskMutationMetadata')
    const create = functionBody('handleCreateSubtask')
    const patch = functionBody('handlePatchSubtask')
    const deletion = functionBody('handleDeleteSubtask')

    expect(validation).toContain('body.preview !== false')
    expect(validation).toContain("error: 'requestId required when preview is false'")
    expect(create).toContain('if (metadata.preview)')
    expect(patch).toContain('if (metadata.preview)')
    expect(deletion).toContain('if (metadata.preview)')
  })

  it('persists normalized subtask arrays and returns stable receipts', () => {
    const create = functionBody('handleCreateSubtask')
    const patch = functionBody('handlePatchSubtask')
    const deletion = functionBody('handleDeleteSubtask')

    for (const body of [create, patch, deletion]) {
      expect(body).toContain(".from('tasks')")
      expect(body).toContain(".eq('user_id', userId)")
      expect(body).toContain('buildSubtaskReceipt')
    }
    expect(create).toContain('subtasks: updatedSubtasks')
    expect(patch).toContain('subtasks: updatedSubtasks')
    expect(deletion).toContain('subtasks: updatedSubtasks')
  })

  it('supports one preview-first atomic subtask batch receipt', () => {
    const route = SERVER_CJS.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)\\/subtasks\\/batch$/)")
    const body = functionBody('handleSubtaskBatch')

    expect(route).toBeGreaterThan(-1)
    expect(body).toContain('operations.length > 50')
    expect(body).toContain('applySubtaskOperations')
    expect(body).toContain("action: 'batch'")
    expect(body).toContain('operationCount: applied.results.length')
    expect(body).toContain('if (metadata.preview)')
    expect(body).toContain('subtasks: applied.subtasks')
  })

  it('replays create and batch applies safely after the in-memory receipt cache is lost', () => {
    const deterministic = functionBody('deterministicSubtaskId')
    const create = functionBody('handleCreateSubtask')
    const batch = functionBody('applySubtaskOperations')

    expect(deterministic).toContain("crypto.createHash('sha256')")
    expect(deterministic).toContain('userId')
    expect(deterministic).toContain('requestId')
    expect(deterministic).toContain('index')
    expect(create).toContain('const persisted = normalizeSubtasks(existing.subtasks).find')
    expect(create).toContain("buildSubtaskReceipt('create', id, persisted, metadata.requestId, true)")
    expect(batch).toContain('deterministicSubtaskId(userId, taskId, requestId, operationIndex)')
    expect(batch).toContain('existingIndex !== -1')
    expect(batch).toContain("replayed: true")
  })

  it('treats already-applied update and delete retries as semantic successes', () => {
    const patch = functionBody('handlePatchSubtask')
    const deletion = functionBody('handleDeleteSubtask')

    expect(patch).toContain('const alreadyApplied = !metadata.preview')
    expect(patch).toContain("buildSubtaskReceipt('update', id, current[index], metadata.requestId, true)")
    expect(deletion).toContain('if (!subtask)')
    expect(deletion).toContain("buildSubtaskReceipt('delete', id, missing, metadata.requestId, true)")
  })

  it('exposes exact user-scoped task reads and title/description search before the id route', () => {
    const exact = functionBody('handleGetTask')
    const search = functionBody('handleSearchTasks')
    const searchRoute = SERVER_CJS.indexOf("path === '/api/tasks/search'")
    const taskRoute = SERVER_CJS.indexOf("path.match(/^\\/api\\/tasks\\/([^/]+)$/)")

    expect(exact).toContain(".eq('user_id', userId)")
    expect(exact).toContain(".eq('is_deleted', false)")
    expect(search).toContain(".or(`title.ilike.${pattern},description.ilike.${pattern}`)")
    expect(search).toContain(".eq('user_id', userId)")
    expect(search).toContain(".eq('is_deleted', false)")
    expect(searchRoute).toBeGreaterThan(-1)
    expect(searchRoute).toBeLessThan(taskRoute)
  })
})
