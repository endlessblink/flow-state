import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const USER_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'inventory-runtime-token'

function task(index: number) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    user_id: USER_ID,
    workspace_id: null,
    title: `Task ${index}`,
    status: 'planned',
    priority: index % 2 ? 'high' : null,
    due_date: null,
    project_id: null,
    canonical_revision: index + 1,
    created_at: new Date(Date.UTC(2026, 5, 1, 12, 0, 0, index)).toISOString(),
    updated_at: new Date(Date.UTC(2026, 6, 14, 12, 0, 0, -index)).toISOString(),
    is_deleted: false,
    is_completion_record: false,
  }
}

function syntheticJwt() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.synthetic-signature`
}

async function startFakePostgrest() {
  const rows = Array.from({ length: 61 }, (_, index) => task(index))
  const requests: URL[] = []
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    requests.push(url)
    if (url.pathname === '/auth/v1/user') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: USER_ID, aud: 'authenticated', role: 'authenticated' }))
      return
    }
    if (url.pathname === '/rest/v1/canonical_change_log') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify([{ change_sequence: 7 }]))
      return
    }
    if (req.method !== 'GET' || url.pathname !== '/rest/v1/tasks') {
      res.writeHead(404).end()
      return
    }
    if ((url.searchParams.get('or') || '').includes('is_deleted.is.null')) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('[]')
      return
    }
    const rawCursor = url.searchParams.get('or') || ''
    const match = rawCursor.match(/id\.gt\.([0-9a-f-]{36})/i)
    const start = match ? Number(match[1].slice(-12)) + 1 : 0
    const limit = Number(url.searchParams.get('limit') || 100)
    const body = rows.slice(start, start + limit)
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': `0-${Math.max(0, body.length - 1)}/*` })
    res.end(JSON.stringify(body))
  })
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fake PostgREST did not bind')
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolveClose) => server.close(() => resolveClose())),
  }
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
  const dataDir = mkdtempSync(join(tmpdir(), 'flowstate-inventory-runtime-'))
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

describe('complete task inventory runtime contract', () => {
  const bundle = resolve(ROOT, 'dist-electron/local-api-server.cjs')
  const artifacts = [
    ['source', resolve(ROOT, 'server/local-api/server.cjs')],
    ['Electron bundle', bundle],
  ] as const

  beforeAll(() => {
    execFileSync(resolve(ROOT, 'node_modules/.bin/esbuild'), [
      'server/local-api/server.cjs', '--bundle', '--platform=node', '--target=node22',
      '--outfile=dist-electron/local-api-server.cjs',
    ], { cwd: ROOT, stdio: 'pipe' })
  }, 120_000)

  for (const [label, artifact] of artifacts) {
    it(`${label} returns every open task with a complete receipt`, async () => {
      const fake = await startFakePostgrest()
      const sidecar = await startSidecar(artifact, fake.url)
      try {
        const response = await fetch(`http://127.0.0.1:${sidecar.port}/api/tasks/inventory?limit=25`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        })
        const body = await response.json() as Record<string, any>

        expect(response.status).toBe(200)
        expect(body.complete).toBe(true)
        expect(body.fresh).toBe(true)
        expect(body.changeSequence).toBe(7)
        expect(body.total).toBe(61)
        expect(body.items).toHaveLength(61)
        expect(new Set(body.items.map((item: { id: string }) => item.id)).size).toBe(61)
        expect(body.page).toEqual({ limit: 25, nextCursor: null, hasMore: false })
        expect(body.appVersion).toBe('1.4.260')
        const taskPages = fake.requests.filter((request) => (
          request.pathname === '/rest/v1/tasks'
          && !(request.searchParams.get('or') || '').includes('is_deleted.is.null')
        ))
        expect(taskPages.length).toBeGreaterThan(2)
        expect(taskPages[0].searchParams.get('is_deleted')).toBe('eq.false')
        expect(taskPages[0].searchParams.get('is_completion_record')).toBe('eq.false')
        expect(taskPages[0].searchParams.get('status')).toBe('neq.done')
        expect(taskPages[1].searchParams.get('or')).toContain('id.gt.')
      } finally {
        await sidecar.stop()
        await fake.close()
      }
    })

    it(`${label} repairs a blind token-mode sidecar before serving inventory`, async () => {
      const fake = await startFakePostgrest()
      const sidecar = await startSidecar(artifact, fake.url, true)
      const endpoint = `http://127.0.0.1:${sidecar.port}/api/tasks/inventory?limit=25`
      try {
        const unauthenticated = await fetch(endpoint)
        expect(unauthenticated.status).toBe(401)
        const wrongBearer = await fetch(endpoint, {
          headers: { Authorization: 'Bearer wrong-synthetic-token' },
        })
        expect(wrongBearer.status).toBe(401)

        sidecar.send({
          type: 'rendererAuthState',
          state: {
            isAuthenticated: true,
            hasUser: true,
            canSyncRemotely: true,
            reauthRequired: false,
            isInitialized: true,
            updatedAt: Date.now(),
          },
        })
        let blindBody: Record<string, unknown> = {}
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const blind = await fetch(endpoint, { headers: { Authorization: `Bearer ${TOKEN}` } })
          blindBody = await blind.json() as Record<string, unknown>
          if (blindBody.error === 'sidecar_auth_bridge_failed') break
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 25))
        }
        expect(blindBody.error).toBe('sidecar_auth_bridge_failed')

        sidecar.send({
          type: 'session',
          supabaseUrl: fake.url,
          anonKey: 'synthetic-anon-key',
          accessToken: syntheticJwt(),
          refreshToken: 'synthetic-refresh-token',
          userId: USER_ID,
        })
        let response: Response | null = null
        let body: Record<string, any> = {}
        for (let attempt = 0; attempt < 80; attempt += 1) {
          response = await fetch(endpoint, { headers: { Authorization: `Bearer ${TOKEN}` } })
          body = await response.json() as Record<string, any>
          if (response.ok) break
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
        }

        expect(response?.status).toBe(200)
        expect(body.complete).toBe(true)
        expect(body.changeSequence).toBe(7)
        expect(body.total).toBe(61)
        expect(body.items).toHaveLength(61)
      } finally {
        await sidecar.stop()
        await fake.close()
      }
    })
  }
})
