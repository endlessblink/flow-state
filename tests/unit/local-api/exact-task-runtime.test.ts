import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const USER_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222'
const TASK_ID = '33333333-3333-4333-8333-333333333333'
const WORKSPACE_ID = '44444444-4444-4444-8444-444444444444'
const TOKEN = 'runtime-regression-token'

type TaskRow = Record<string, unknown>

function baseTask(overrides: TaskRow = {}): TaskRow {
  return {
    id: TASK_ID,
    user_id: USER_ID,
    workspace_id: null,
    title: 'Detailed task fixture',
    description: 'Safe planning context',
    status: 'planned',
    priority: 'high',
    progress: 35,
    due_date: '2026-07-15T00:00:00.000Z',
    due_time: '09:30',
    project_id: null,
    tags: ['fixture'],
    position: { x: 12, y: 34 },
    instances: [{ id: 'instance-1', scheduledDate: '2026-07-15' }, null, 'bad'],
    recurrence_rule: null,
    recurrence_parent_id: null,
    recurrence_count: 0,
    is_completion_record: false,
    is_in_inbox: true,
    canonical_revision: 7,
    created_at: '2026-07-14T08:00:00.000Z',
    updated_at: '2026-07-14T09:00:00.000Z',
    completed_at: null,
    is_deleted: false,
    accessToken: 'must-not-leak',
    refreshToken: 'must-not-leak',
    authorization: 'must-not-leak',
    ...overrides,
  }
}

function queryValue(url: URL, name: string, operator: string): string | null {
  const value = url.searchParams.get(name)
  return value?.startsWith(`${operator}.`) ? value.slice(operator.length + 1) : null
}

async function startFakePostgrest() {
  let row = baseTask()
  let failure: { status: number; body: unknown } | null = null
  const requests: URL[] = []
  const rpcRequests: Record<string, unknown>[] = []
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    requests.push(url)
    if (req.method === 'GET' && url.pathname === '/auth/v1/user') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: USER_ID, aud: 'authenticated', role: 'authenticated' }))
      return
    }
    if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/flowstate_subtask_batch_v1') {
      let raw = ''
      req.setEncoding('utf8')
      req.on('data', (chunk) => { raw += chunk })
      req.on('end', () => {
        const body = JSON.parse(raw) as Record<string, unknown>
        rpcRequests.push(body)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          ok: true,
          result: 'preview',
          contractVersion: 'task-v1',
          action: 'subtask_batch',
          operationId: body.p_operation_id,
          baseRevision: body.p_base_revision,
          requestHash: 'a'.repeat(64),
          previewDigest: 'b'.repeat(64),
          previewExpiresAt: '2026-07-16T10:00:00.000Z',
          normalizedPayload: {
            taskId: body.p_task_id,
            operations: body.p_operations,
          },
          readBack: {
            id: body.p_task_id,
            workspaceId: body.p_workspace_id,
            canonicalRevision: body.p_base_revision,
            subtasks: [],
          },
        }))
      })
      return
    }
    if (req.method !== 'GET' || url.pathname !== '/rest/v1/tasks') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'not found' }))
      return
    }
    if (failure) {
      res.writeHead(failure.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(failure.body))
      return
    }

    let matches = true
    const idFilter = queryValue(url, 'id', 'eq')
    const deletedFilter = queryValue(url, 'is_deleted', 'eq')
    const userFilter = queryValue(url, 'user_id', 'eq')
    const workspaceFilter = url.searchParams.get('workspace_id')
    if (idFilter !== null) matches = matches && idFilter === row.id
    if (deletedFilter !== null) matches = matches && deletedFilter === String(row.is_deleted)
    if (userFilter !== null) matches = matches && userFilter === row.user_id
    if (workspaceFilter === 'is.null') matches = matches && row.workspace_id === null
    else if (workspaceFilter?.startsWith('eq.')) {
      matches = matches && workspaceFilter.slice(3) === row.workspace_id
    }
    const body = matches ? [row] : []
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Range': matches ? '0-0/1' : '*/0',
    })
    res.end(JSON.stringify(body))
  })

  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fake PostgREST did not bind')

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    rpcRequests,
    setRow(next: TaskRow) {
      failure = null
      row = next
    },
    setFailure(status: number, body: unknown) {
      failure = { status, body }
    },
    close: () => {
      server.closeAllConnections()
      return new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    },
  }
}

async function unusedPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('port probe did not bind')
  const port = address.port
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
  return port
}

async function waitForHealth(port: number, child: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`sidecar exited with ${child.exitCode}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        headers: { Host: `127.0.0.1:${port}` },
        signal: AbortSignal.timeout(1_000),
      })
      if (response.ok) return
    } catch {
      // Startup is asynchronous; retry until the bounded deadline.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
  }
  throw new Error('sidecar did not become healthy')
}

function fakeAccessToken(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.test-signature`
}

async function startSidecar(entry: string, supabaseUrl: string, workspaceId?: string) {
  const port = await unusedPort()
  const dataDir = mkdtempSync(join(tmpdir(), 'flowstate-exact-task-runtime-'))
  const child = spawn(process.execPath, [entry], {
    cwd: dataDir,
    env: {
      HOME: dataDir,
      PATH: process.env.PATH || '/usr/bin:/bin',
      NODE_ENV: 'test',
      FLOW_STATE_API_DATA_DIR: dataDir,
      FLOW_STATE_API_PORT: String(port),
      FLOW_STATE_API_TOKEN: TOKEN,
      FLOW_STATE_USER_ID: USER_ID,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },
    stdio: workspaceId ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'],
  })
  if (workspaceId) {
    child.send?.({ type: 'workspaceContext', activeWorkspaceId: workspaceId })
    child.send?.({
      type: 'session',
      supabaseUrl,
      anonKey: 'test-anon-key',
      accessToken: fakeAccessToken(),
      refreshToken: 'test-refresh-token',
      userId: USER_ID,
    })
  }
  const stop = async () => {
    child.kill('SIGTERM')
    await new Promise<void>((resolveExit) => {
      if (child.exitCode !== null) return resolveExit()
      child.once('exit', () => resolveExit())
      setTimeout(() => {
        child.kill('SIGKILL')
        resolveExit()
      }, 2_000).unref()
    })
    rmSync(dataDir, { recursive: true, force: true })
  }
  try {
    await waitForHealth(port, child)
  } catch (error) {
    await stop()
    throw error
  }
  return {
    port,
    stop,
  }
}

async function getTask(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/api/tasks/${TASK_ID}`, {
    headers: {
      Host: `127.0.0.1:${port}`,
      Authorization: `Bearer ${TOKEN}`,
    },
  })
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}

async function getSubtasks(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/api/tasks/${TASK_ID}/subtasks`, {
    headers: {
      Host: `127.0.0.1:${port}`,
      Authorization: `Bearer ${TOKEN}`,
    },
  })
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}

async function waitForSubtasks(port: number) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await getSubtasks(port)
    if (result.status !== 503) return result
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
  }
  throw new Error('protected subtask route did not receive auth context')
}

async function previewSubtask(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/api/tasks/${TASK_ID}/subtasks/batch`, {
    method: 'POST',
    headers: {
      Host: `127.0.0.1:${port}`,
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operationId: 'workspace-subtask-preview',
      baseRevision: 7,
      preview: true,
      operations: [{ kind: 'create', clientId: 'workspace-step', title: 'Workspace step', order: 0 }],
    }),
  })
  return { status: response.status, body: await response.json() as Record<string, unknown> }
}

function assertNoSecrets(value: unknown) {
  const serialized = JSON.stringify(value)
  for (const forbidden of ['accessToken', 'refreshToken', 'authorization', 'user_id', 'is_deleted']) {
    expect(serialized).not.toContain(forbidden)
  }
}

describe('exact task runtime contract', () => {
  const bundleArtifact = process.env.FLOWSTATE_EXACT_TASK_BUNDLE
    ? resolve(process.env.FLOWSTATE_EXACT_TASK_BUNDLE)
    : resolve(ROOT, 'dist-electron/local-api-server.cjs')
  const artifacts = [
    ['source', resolve(ROOT, 'server/local-api/server.cjs')],
    ['Electron bundle', bundleArtifact],
  ] as const

  beforeAll(() => {
    if (process.env.FLOWSTATE_EXACT_TASK_BUNDLE) {
      expect(bundleArtifact).not.toBe(resolve(ROOT, 'server/local-api/server.cjs'))
      return
    }
    execFileSync(resolve(ROOT, 'node_modules/.bin/esbuild'), [
      'server/local-api/server.cjs',
      '--bundle',
      '--platform=node',
      '--target=node22',
      '--outfile=dist-electron/local-api-server.cjs',
    ], { cwd: ROOT, stdio: 'pipe' })
  }, 120_000)

  for (const [label, artifact] of artifacts) {
    it(`${label} executes fresh ordered subtask reads with canonical parent authority`, async () => {
      const fake = await startFakePostgrest()
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null
      try {
        sidecar = await startSidecar(artifact, fake.url)
        fake.setRow(baseTask({
          canonical_revision: 11,
          updated_at: '2026-07-16T08:30:00.000Z',
          subtasks: [
            { id: 'step-a', title: 'First valid step', order: 0 },
            { id: 'step-b', title: 'Second valid step', order: 1 },
          ],
        }))

        const initial = await getSubtasks(sidecar.port)
        expect(initial.status).toBe(200)
        expect(initial.body).toEqual({
          ok: true,
          task: {
            id: TASK_ID,
            title: 'Detailed task fixture',
            workspaceId: null,
            canonicalRevision: 11,
            canonicalUpdatedAt: '2026-07-16T08:30:00.000Z',
          },
          subtasks: [
            { id: 'step-a', title: 'First valid step', order: 0 },
            { id: 'step-b', title: 'Second valid step', order: 1 },
          ],
        })
        assertNoSecrets(initial.body)

        const request = fake.requests.at(-1)
        expect(request?.searchParams.get('select')).toBe(
          'id,title,workspace_id,canonical_revision,updated_at,subtasks',
        )
        expect(request?.searchParams.get('id')).toBe(`eq.${TASK_ID}`)
        expect(request?.searchParams.get('is_deleted')).toBe('eq.false')
        expect(request?.searchParams.get('user_id')).toBe(`eq.${USER_ID}`)
        expect(request?.searchParams.get('workspace_id')).toBe('is.null')

        fake.setRow(baseTask({
          canonical_revision: 12,
          updated_at: '2026-07-16T08:31:00.000Z',
          subtasks: [{ id: 'step-c', title: 'Fresh step', order: 0 }],
        }))
        const refreshed = await getSubtasks(sidecar.port)
        expect(refreshed.status).toBe(200)
        expect((refreshed.body.task as TaskRow).canonicalRevision).toBe(12)
        expect(refreshed.body.subtasks).toEqual([{ id: 'step-c', title: 'Fresh step', order: 0 }])

        fake.setRow(baseTask({ user_id: OTHER_USER_ID }))
        expect((await getSubtasks(sidecar.port)).status).toBe(404)

        fake.setRow(baseTask({ is_deleted: true }))
        expect((await getSubtasks(sidecar.port)).status).toBe(404)
      } finally {
        await sidecar?.stop()
        await fake.close()
      }
    }, 30_000)

    it(`${label} fails closed when canonical subtask rows are malformed`, async () => {
      const fake = await startFakePostgrest()
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null
      try {
        sidecar = await startSidecar(artifact, fake.url)
        const invalidSubtasks: unknown[] = [
          null,
          'not-an-array',
          [null],
          [[]],
          [{ id: '', title: 'Blank id', order: 0 }],
          [{ id: 'x'.repeat(257), title: 'Long id', order: 0 }],
          [{ id: 'step-a', title: ' ', order: 0 }],
          [{ id: 'step-a', title: 'x'.repeat(501), order: 0 }],
          [{ id: 'step-a', title: 'Wrong order', order: 1 }],
          [
            { id: 'duplicate', title: 'First', order: 0 },
            { id: 'duplicate', title: 'Second', order: 1 },
          ],
          [{ id: 'step-a', parentTaskId: OTHER_USER_ID, title: 'Wrong parent', order: 0 }],
          [
            { id: 'step-a', clientId: 'same-client', title: 'First', order: 0 },
            { id: 'step-b', clientId: 'same-client', title: 'Second', order: 1 },
          ],
          [{ id: 'step-a', title: 'Unknown field', order: 0, accessToken: 'raw-secret' }],
          [{ id: 'step-a', title: 'Bad boolean', order: 0, isCompleted: 'false' }],
          [{ id: 'step-a', title: 'Bad estimate', order: 0, estimateMinutes: 0 }],
          [{ id: 'step-a', title: 'Bad count', order: 0, completedPomodoros: -1 }],
          [{ id: 'step-a', title: 'Bad position', order: 0, canvasPosition: { x: 1 } }],
          [{ id: 'step-a', title: 'Bad timestamp', order: 0, createdAt: 'not-a-date' }],
          [{ id: 'step-a', title: 'Missing timezone', order: 0, createdAt: '2026-07-16T08:00:00' }],
        ]

        for (const subtasks of invalidSubtasks) {
          fake.setRow(baseTask({ subtasks }))
          const result = await getSubtasks(sidecar.port)
          expect(result.status, JSON.stringify(subtasks)).toBe(500)
          expect(result.body).toEqual({
            ok: false,
            error: { code: 'read_failed', message: 'subtasks could not be read' },
          })
          assertNoSecrets(result.body)
        }

        fake.setRow(baseTask({
          subtasks: [{
            id: 'step-a',
            clientId: 'outline-step',
            parentTaskId: TASK_ID,
            title: 'Valid complete row',
            description: 'Bounded planning context',
            isCompleted: false,
            doneEnough: null,
            estimateMinutes: 20,
            completedPomodoros: 1,
            canvasPosition: { x: 12, y: 34 },
            createdAt: '2026-07-16T08:00:00.000Z',
            updatedAt: '2026-07-16T08:01:00.000Z',
            order: 0,
          }],
        }))
        expect((await getSubtasks(sidecar.port)).status).toBe(200)
      } finally {
        await sidecar?.stop()
        await fake.close()
      }
    }, 30_000)

    it(`${label} returns only typed redacted read failures and misses`, async () => {
      const fake = await startFakePostgrest()
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null
      try {
        sidecar = await startSidecar(artifact, fake.url)
        fake.setFailure(500, {
          message: 'raw upstream failure with service-role-key and accessToken',
          details: 'authorization: Bearer raw-secret',
        })
        const failed = await getSubtasks(sidecar.port)
        expect(failed.status).toBe(500)
        expect(failed.body).toEqual({
          ok: false,
          error: { code: 'read_failed', message: 'subtasks could not be read' },
        })
        expect(JSON.stringify(failed.body)).not.toMatch(/service-role-key|raw-secret|accessToken|authorization/i)

        fake.setRow(baseTask({ user_id: OTHER_USER_ID }))
        const missing = await getSubtasks(sidecar.port)
        expect(missing.status).toBe(404)
        expect(missing.body).toEqual({
          ok: false,
          error: { code: 'not_found', message: 'task not found' },
        })
      } finally {
        await sidecar?.stop()
        await fake.close()
      }
    }, 30_000)

    it(`${label} scopes exact subtask reads to the active workspace in token mode`, async () => {
      const fake = await startFakePostgrest()
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null
      try {
        fake.setRow(baseTask({
          workspace_id: WORKSPACE_ID,
          subtasks: [{ id: 'workspace-step', title: 'Workspace step', order: 0 }],
        }))
        sidecar = await startSidecar(artifact, fake.url, WORKSPACE_ID)
        const result = await waitForSubtasks(sidecar.port)
        expect(result.status).toBe(200)
        expect((result.body.task as TaskRow).workspaceId).toBe(WORKSPACE_ID)
        expect(result.body.subtasks).toEqual([
          { id: 'workspace-step', title: 'Workspace step', order: 0 },
        ])

        const request = fake.requests.filter((url) => url.pathname === '/rest/v1/tasks').at(-1)
        expect(request?.searchParams.get('workspace_id')).toBe(`eq.${WORKSPACE_ID}`)

        const preview = await previewSubtask(sidecar.port)
        expect(preview.status).toBe(200)
        expect(preview.body).toMatchObject({
          ok: true,
          result: 'preview',
          operationId: 'workspace-subtask-preview',
        })
        expect(fake.rpcRequests).toHaveLength(1)
        expect(fake.rpcRequests[0]).toMatchObject({
          p_task_id: TASK_ID,
          p_workspace_id: WORKSPACE_ID,
          p_preview: true,
        })

        fake.setRow(baseTask({ workspace_id: null, subtasks: [] }))
        const personalTask = await getSubtasks(sidecar.port)
        expect(personalTask.status).toBe(404)
        expect(personalTask.body).toEqual({
          ok: false,
          error: { code: 'not_found', message: 'task not found' },
        })
      } finally {
        await sidecar?.stop()
        await fake.close()
      }
    }, 30_000)

    it(`${label} executes detailed reads with safe subtask normalization and scope`, async () => {
      const fake = await startFakePostgrest()
      let sidecar: Awaited<ReturnType<typeof startSidecar>> | null = null
      try {
        sidecar = await startSidecar(artifact, fake.url)
        for (const subtasks of [undefined, null, [], 'bad', { bad: true }]) {
          const row = baseTask()
          if (subtasks !== undefined) row.subtasks = subtasks
          fake.setRow(row)
          const result = await getTask(sidecar.port)
          expect(result.status).toBe(200)
          expect((result.body.task as TaskRow).subtasks).toEqual([])
        }

        fake.setRow(baseTask({ subtasks: [null, 'bad', [], { id: 'subtask-1', title: 'Keep me' }] }))
        const detailed = await getTask(sidecar.port)
        expect(detailed.status).toBe(200)
        expect((detailed.body.task as TaskRow).subtasks).toEqual([{ id: 'subtask-1', title: 'Keep me' }])
        expect((detailed.body.task as TaskRow).instances).toEqual([
          { id: 'instance-1', scheduledDate: '2026-07-15' },
        ])
        expect(Object.keys(detailed.body.task as TaskRow).sort()).toEqual([
          'canonicalRevision', 'canvasPosition', 'completedAt', 'createdAt', 'description', 'dueDate',
          'dueTime', 'id', 'instances', 'isCompletionRecord', 'isInInbox', 'priority', 'progress',
          'projectId', 'recurrenceCount', 'recurrenceParentId', 'recurrenceRule', 'status', 'subtasks',
          'tags', 'title', 'updatedAt', 'workspaceId',
        ].sort())
        assertNoSecrets(detailed.body)

        const request = fake.requests.at(-1)
        expect(request?.searchParams.get('id')).toBe(`eq.${TASK_ID}`)
        expect(request?.searchParams.get('is_deleted')).toBe('eq.false')
        expect(request?.searchParams.get('user_id')).toBe(`eq.${USER_ID}`)
        expect(request?.searchParams.get('workspace_id')).toBe('is.null')
        expect(request?.searchParams.get('select')).toContain('description')
        expect(request?.searchParams.get('select')).toContain('subtasks')

        fake.setRow(baseTask({ user_id: OTHER_USER_ID }))
        expect((await getTask(sidecar.port)).status).toBe(404)

        fake.setRow(baseTask({ is_deleted: true }))
        expect((await getTask(sidecar.port)).status).toBe(404)
      } finally {
        await sidecar?.stop()
        await fake.close()
      }
    }, 30_000)
  }
})
