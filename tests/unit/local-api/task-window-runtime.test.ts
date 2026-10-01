import { execFileSync, spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const USER_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'window-runtime-token'

function row(index: number, overrides: Record<string, unknown> = {}): any {
  return { id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    user_id: USER_ID, workspace_id: null, title: `Task ${index}`, status: 'planned',
    due_date: '2026-10-01', due_time: '08:00', estimated_duration: 30,
    instances: [], is_deleted: false, is_completion_record: false, ...overrides }
}

async function startFakePostgrest(mode = 'normal') {
  const rows = [
    ...Array.from({ length: mode === 'overflow' ? 501 : 30 }, (_, index) => row(index)),
    row(100, { due_date: null, instances: [
      { id: 'first', scheduledDate: '2026-10-01', scheduledTime: '10:00', duration: 45 },
      { id: 'second', scheduledDate: '2026-10-02', scheduledTime: '11:00', duration: 60 },
      { id: 'completed', scheduledDate: '2026-10-01', status: 'completed' },
      { id: 'skipped', scheduledDate: '2026-10-01', status: 'skipped' },
      { id: 'flag-skipped', scheduledDate: '2026-10-01', isSkipped: true },
      { id: 'outside', scheduledDate: '2026-10-03' },
    ] }),
    row(101, { due_date: '2026-10-03' }),
    row(102, { is_deleted: true }),
    row(103, { status: 'done' }),
    row(104, { is_completion_record: true }),
    row(105, { user_id: '22222222-2222-4222-8222-222222222222' }),
    row(106, { workspace_id: '33333333-3333-4333-8333-333333333333' }),
    row(107, { due_date: null, instances: [{ id: 'only-completed', scheduledDate: '2026-10-01', status: 'completed' }] }),
  ]
  const requests: { url: URL; method: string }[] = []
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    requests.push({ url, method: req.method || '' })
    if (req.method !== 'GET' || url.pathname !== '/rest/v1/tasks') {
      res.writeHead(404).end(); return
    }
    if (mode === 'error') {
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'synthetic failure' })); return
    }
    const filter = url.searchParams.get('or') || ''
    const dates = [...filter.matchAll(/2026-10-0[12]/g)].map(match => match[0])
    const filtered = rows.filter(item => (
      (url.searchParams.get('is_deleted') !== 'eq.false' || !item.is_deleted)
      && (url.searchParams.get('is_completion_record') !== 'eq.false' || !item.is_completion_record)
      && (url.searchParams.get('status') !== 'neq.done' || item.status !== 'done')
      && (url.searchParams.get('user_id') !== `eq.${USER_ID}` || item.user_id === USER_ID)
      && (url.searchParams.get('workspace_id') !== 'is.null' || item.workspace_id === null)
      && (dates.includes(item.due_date || '') || item.instances.some((instance: { scheduledDate: string }) => dates.includes(instance.scheduledDate)))
    )).slice(0, Number(url.searchParams.get('limit') || 1000))
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(filtered))
  })
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fake did not bind')
  return { url: `http://127.0.0.1:${address.port}`, requests,
    close: () => new Promise<void>(resolveClose => server.close(() => resolveClose())) }
}

async function unusedPort() {
  const server = createServer()
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('port probe did not bind')
  const port = address.port
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
  return port
}

async function startSidecar(entry: string, supabaseUrl: string, tokenMode = false) {
  const port = await unusedPort()
  const dataDir = mkdtempSync(join(tmpdir(), 'flowstate-window-runtime-'))
  const child = spawn(process.execPath, [entry], {
    cwd: dataDir,
    env: {
      HOME: dataDir,
      PATH: process.env.PATH || '/usr/bin:/bin',
      NODE_ENV: 'test',
      FLOW_STATE_API_DATA_DIR: dataDir,
      FLOW_STATE_API_PORT: String(port),
      FLOW_STATE_API_TOKEN: TOKEN,
      FLOW_STATE_APP_VERSION: '1.4.260',
      SUPABASE_URL: supabaseUrl,
      ...(tokenMode
        ? { FLOW_STATE_API_MODE: 'token' }
        : {
            FLOW_STATE_USER_ID: USER_ID,
            SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-key',
          }),
    },
    stdio: tokenMode ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'],
  })
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (response.ok) break
    } catch { /* bounded startup retry */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
  }
  return {
    port,
    child,
    send: (message: object) => child.send?.(message),
    stop: async () => {
      child.kill('SIGTERM')
      await new Promise<void>((resolveExit) => {
        if (child.exitCode !== null) return resolveExit()
        child.once('exit', () => resolveExit())
      })
      rmSync(dataDir, { recursive: true, force: true })
    },
  }
}

describe('planning task window runtime contract', () => {
  const artifacts = [
    ['source', resolve(ROOT, 'server/local-api/server.cjs')],
    ['Electron bundle', resolve(ROOT, 'dist-electron/local-api-server.cjs')],
  ] as const
  beforeAll(() => {
    execFileSync(resolve(ROOT, 'node_modules/.bin/esbuild'), [
      'server/local-api/server.cjs', '--bundle', '--platform=node', '--target=node22',
      '--outfile=dist-electron/local-api-server.cjs',
    ], { cwd: ROOT, stdio: 'pipe' })
  }, 120_000)
  for (const [label, artifact] of artifacts) {
    it(`${label} returns all window tasks and active blocks with one scoped read`, async () => {
      const fake = await startFakePostgrest()
      const sidecar = await startSidecar(artifact, fake.url)
      try {
        const capabilities = await fetch(`http://127.0.0.1:${sidecar.port}/api/capabilities`).then(response => response.json())
        expect(capabilities.routes).toContainEqual(expect.objectContaining({
          method: 'GET', path: '/api/tasks/window', contractVersion: 'task-window-v1', available: true,
        }))
        const response = await fetch(`http://127.0.0.1:${sidecar.port}/api/tasks/window?days=2026-10-01,2026-10-02`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.complete).toBe(true)
        expect(body.fresh).toBe(true)
        expect(body.days).toEqual(['2026-10-01', '2026-10-02'])
        expect(body.tasks).toHaveLength(31)
        expect(body.tasks[0]).toMatchObject({ dueDate: '2026-10-01', dueTime: '08:00', estimatedDuration: 30 })
        expect(body.tasks.find((item: { id: string }) => item.id === row(100).id).instances).toEqual([
          expect.objectContaining({ id: 'first', scheduledDate: '2026-10-01', scheduledTime: '10:00', duration: 45 }),
          expect.objectContaining({ id: 'second', scheduledDate: '2026-10-02', scheduledTime: '11:00', duration: 60 }),
        ])
        expect(fake.requests).toHaveLength(1)
        const query = fake.requests[0]
        expect(query.method).toBe('GET')
        expect(query.url.pathname).toBe('/rest/v1/tasks')
        expect(query.url.searchParams.get('is_deleted')).toBe('eq.false')
        expect(query.url.searchParams.get('is_completion_record')).toBe('eq.false')
        expect(query.url.searchParams.get('status')).toBe('neq.done')
        expect(query.url.searchParams.get('user_id')).toBe(`eq.${USER_ID}`)
        expect(query.url.searchParams.get('workspace_id')).toBe('is.null')
        expect(query.url.searchParams.get('limit')).toBe('501')
        expect(query.url.searchParams.get('or')).toContain('due_date.in.')
        expect(query.url.searchParams.get('or')).toContain('instances.cs.[{"scheduledDate":"2026-10-01"}]')
        expect(query.url.searchParams.get('or')).toContain('instances.cs.[{"scheduledDate":"2026-10-02"}]')
      } finally { await sidecar.stop(); await fake.close() }
    })
    it(`${label} rejects invalid dates and bearer without a database request`, async () => {
      const fake = await startFakePostgrest()
      const sidecar = await startSidecar(artifact, fake.url)
      try {
        for (const days of ['2026-02-30', '2026-10-01,not-a-date', '', '2026-10-01T00:00:00']) {
          const response = await fetch(`http://127.0.0.1:${sidecar.port}/api/tasks/window?days=${days}`, {
            headers: { Authorization: `Bearer ${TOKEN}` },
          })
          expect(response.status).toBe(400)
        }
        const missing = await fetch(`http://127.0.0.1:${sidecar.port}/api/tasks/window?days=2026-10-01`)
        expect(missing.status).toBe(401)
        const wrong = await fetch(`http://127.0.0.1:${sidecar.port}/api/tasks/window?days=2026-10-01`, {
          headers: { Authorization: 'Bearer wrong-token' },
        })
        expect(wrong.status).toBe(401)
        expect(fake.requests).toHaveLength(0)
      } finally { await sidecar.stop(); await fake.close() }
    })
    for (const mode of ['error', 'overflow']) {
      it(`${label} fails closed on ${mode} rather than returning complete data`, async () => {
        const fake = await startFakePostgrest(mode)
        const sidecar = await startSidecar(artifact, fake.url)
        try {
          const response = await fetch(`http://127.0.0.1:${sidecar.port}/api/tasks/window?days=2026-10-01,2026-10-02`, {
            headers: { Authorization: `Bearer ${TOKEN}` },
          })
          const body = await response.json()
          expect(response.status).toBe(502)
          expect(body.complete).not.toBe(true)
          expect(fake.requests.every(request => request.method === 'GET' && request.url.pathname === '/rest/v1/tasks')).toBe(true)
        } finally { await sidecar.stop(); await fake.close() }
      })
    }
  }
})
