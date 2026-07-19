import { execFileSync, spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const TOKEN = 'canonical-work-block-runtime-token'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const TASK_ID = '22222222-2222-4222-8222-222222222222'
const BLOCK_ID = `instance-${TASK_ID}-1720000000000`
const OPERATION_ID = 'runtime-legacy-work-block-preview'
const ACCESS_TOKEN = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: USER_ID, role: 'authenticated', exp: 4102444800 })).toString('base64url'),
  'synthetic-signature',
].join('.')
const require = createRequire(import.meta.url)
const { canonicalHash } = require('../../../server/local-api/canonical-receipt.cjs') as {
  canonicalHash: (value: unknown) => string
}

const command = {
  action: 'move', workBlockId: BLOCK_ID,
  scheduledDate: '2026-07-20', scheduledTime: '10:00', timezone: 'Asia/Jerusalem',
}

function previewResponse() {
  const normalizedPayload = {
    contractVersion: 'work-block-v1', source: 'local-api', action: 'move',
    taskId: TASK_ID, baseRevision: 4, workBlockRevision: 0, workspaceId: null, command,
  }
  const block = {
    id: BLOCK_ID, taskId: TASK_ID, scheduledDate: '2026-07-20', scheduledTime: '10:00',
    duration: 25, timezone: 'Asia/Jerusalem', canonicalRevision: 1,
  }
  return {
    ok: true, status: 'preview', result: 'preview',
    requestHash: canonicalHash(normalizedPayload), previewDigest: 'a'.repeat(64),
    previewExpiresAt: '2026-07-20T12:30:00.000Z', normalizedPayload,
    preview: {
      action: 'move', workBlockId: BLOCK_ID,
      interval: {
        before: { localStart: '2026-07-19T09:00', localEnd: '2026-07-19T09:25' },
        after: { localStart: '2026-07-20T10:00', localEnd: '2026-07-20T10:25' },
      },
      timezone: 'Asia/Jerusalem',
      duration: { beforeMinutes: 25, afterMinutes: 25 },
      overlapWarnings: [],
      taskEffect: { taskId: TASK_ID, dueDate: { before: null, after: null } },
      finishByBoundary: null,
    },
    readBack: { id: TASK_ID, instances: [block], canonicalRevision: 4 },
  }
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

async function startFakePostgrest() {
  const rpcBodies: Record<string, unknown>[] = []
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    if (url.pathname === '/auth/v1/user') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: USER_ID, role: 'authenticated' }))
      return
    }
    if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/flowstate_work_block_v1') {
      rpcBodies.push(await readBody(req))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(previewResponse()))
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fake PostgREST did not bind')
  return {
    url: `http://127.0.0.1:${address.port}`,
    rpcBodies,
    close: () => new Promise<void>(resolveClose => server.close(() => resolveClose())),
  }
}

async function unusedPort() {
  const server = createServer()
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('port probe did not bind')
  const port = address.port
  await new Promise<void>(resolveClose => server.close(() => resolveClose()))
  return port
}

async function startSidecar(entry: string, supabaseUrl: string) {
  const port = await unusedPort()
  const dataDir = mkdtempSync(join(tmpdir(), 'flowstate-work-block-runtime-'))
  const child = spawn(process.execPath, [entry], {
    cwd: dataDir,
    env: {
      HOME: dataDir, PATH: process.env.PATH || '/usr/bin:/bin', NODE_ENV: 'test',
      FLOW_STATE_API_DATA_DIR: dataDir, FLOW_STATE_API_PORT: String(port),
      FLOW_STATE_API_TOKEN: TOKEN, FLOW_STATE_API_MODE: 'token',
      FLOW_STATE_APP_VERSION: '1.4.276', FLOW_STATE_USER_ID: USER_ID,
      SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-key',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  child.send({
    type: 'session', supabaseUrl, anonKey: 'synthetic-anon-key', accessToken: ACCESS_TOKEN,
    refreshToken: 'synthetic-refresh-token', userId: USER_ID,
  })
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break
    } catch { /* bounded startup retry */ }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 50))
  }
  return {
    port,
    stop: async () => {
      child.kill('SIGTERM')
      await new Promise<void>(resolveExit => {
        if (child.exitCode !== null) return resolveExit()
        child.once('exit', () => resolveExit())
      })
      rmSync(dataDir, { recursive: true, force: true })
    },
  }
}

describe('canonical work-block HTTP runtime contract', () => {
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
    it(`${label} authenticates and previews a shipped legacy work-block ID`, async () => {
      const fake = await startFakePostgrest()
      const sidecar = await startSidecar(artifact, fake.url)
      try {
        const unauthenticated = await fetch(
          `http://127.0.0.1:${sidecar.port}/api/tasks/${TASK_ID}/work-blocks`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
        )
        expect(unauthenticated.status).toBe(401)

        const response = await fetch(
          `http://127.0.0.1:${sidecar.port}/api/tasks/${TASK_ID}/work-blocks`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operationId: OPERATION_ID, baseRevision: 4, workBlockRevision: 0,
              command, preview: true,
            }),
          },
        )
        const body = await response.json() as Record<string, any>
        expect(response.status).toBe(200)
        expect(body.normalizedPayload.command.workBlockId).toBe(BLOCK_ID)
        expect(fake.rpcBodies).toHaveLength(1)
        expect(fake.rpcBodies[0]).toMatchObject({ p_preview: true, p_work_block_revision: 0 })
      } finally {
        await sidecar.stop()
        await fake.close()
      }
    })
  }
})
