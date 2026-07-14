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
  const requests: URL[] = []
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    requests.push(url)
    if (req.method !== 'GET' || url.pathname !== '/rest/v1/tasks') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'not found' }))
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
    if (workspaceFilter !== null) matches = matches && workspaceFilter === 'is.null'
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
    setRow(next: TaskRow) {
      row = next
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

async function startSidecar(entry: string, supabaseUrl: string) {
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
    stdio: ['ignore', 'pipe', 'pipe'],
  })
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
