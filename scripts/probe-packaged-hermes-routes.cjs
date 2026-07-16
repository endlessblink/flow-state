'use strict'

const { createServer } = require('http')
const { mkdtempSync, rmSync } = require('fs')
const { tmpdir } = require('os')
const { join, resolve } = require('path')
const { Module } = require('module')
const { canonicalHash } = require('../server/local-api/canonical-receipt.cjs')
const {
  HERMES_ROUTE_CAPABILITIES,
  SCHEMA_VERSION,
} = require('../server/local-api/hermes-route-capabilities.cjs')

const token = 'packaged-hermes-route-probe'
const userId = '11111111-1111-4111-8111-111111111111'
const taskId = '22222222-2222-4222-8222-222222222222'
const operationId = 'packaged-route-dispatch-probe'
const accessToken = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: 4102444800 })).toString('base64url'),
  'synthetic-signature',
].join('.')

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolveListen(server.address().port))
  })
}

function close(server) {
  return new Promise(resolveClose => server.close(() => resolveClose()))
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function probePackagedHermesRoutes(sidecarEntry) {
  let rpcCount = 0
  const fake = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    if (url.pathname === '/auth/v1/user') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: userId, aud: 'authenticated', role: 'authenticated' }))
      return
    }
    if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/flowstate_task_lifecycle_v1') {
      rpcCount += 1
      const rpc = await readJson(req)
      const request = {
        contractVersion: 'task-lifecycle-v1',
        source: 'local-api',
        action: rpc.p_action,
        taskId: rpc.p_task_id,
        baseRevision: rpc.p_base_revision,
        workspaceId: null,
        payload: rpc.p_payload,
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: true,
        result: 'preview',
        contractVersion: 'task-lifecycle-v1',
        operationId,
        action: 'create',
        taskId,
        baseRevision: 0,
        requestHash: canonicalHash(request),
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2099-01-01T00:00:00.000Z',
        normalizedPayload: request,
      }))
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })
  const fakePort = await listen(fake)
  const portProbe = createServer()
  const sidecarPort = await listen(portProbe)
  await close(portProbe)
  const dataDir = mkdtempSync(join(tmpdir(), 'flowstate-package-route-probe-'))

  Object.assign(process.env, {
    FLOW_STATE_API_DATA_DIR: dataDir,
    FLOW_STATE_API_PORT: String(sidecarPort),
    FLOW_STATE_API_TOKEN: token,
    FLOW_STATE_API_MODE: 'token',
    FLOW_STATE_APP_VERSION: 'package-probe',
    SUPABASE_URL: `http://127.0.0.1:${fakePort}`,
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-key',
    NODE_PATH: join(__dirname, '..', 'node_modules'),
  })
  Module._initPaths()

  try {
    process.send = () => {}
    require(resolve(sidecarEntry))
    process.emit('message', {
      type: 'session',
      supabaseUrl: `http://127.0.0.1:${fakePort}`,
      anonKey: 'synthetic-anon-key',
      accessToken,
      refreshToken: 'synthetic-refresh-token',
      userId,
    })
    let ready = false
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${sidecarPort}/api/health`)
        if (response.ok) {
          ready = true
          break
        }
      } catch { /* bounded startup retry */ }
      await new Promise(resolveDelay => setTimeout(resolveDelay, 50))
    }
    if (!ready) throw new Error('packaged sidecar did not start')

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${sidecarPort}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status !== 503) break
      await new Promise(resolveDelay => setTimeout(resolveDelay, 50))
    }

    const capabilityResponse = await fetch(`http://127.0.0.1:${sidecarPort}/api/capabilities`)
    const capabilities = await capabilityResponse.json()
    if (!capabilityResponse.ok
      || capabilities.schemaVersion !== SCHEMA_VERSION
      || JSON.stringify(capabilities.routes) !== JSON.stringify(HERMES_ROUTE_CAPABILITIES)) {
      throw new Error('packaged capability route did not return the exact Hermes contract')
    }

    const lifecycleResponse = await fetch(`http://127.0.0.1:${sidecarPort}/api/tasks/lifecycle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId,
        taskId,
        baseRevision: 0,
        action: 'create',
        preview: true,
        payload: {
          title: 'Packaged route dispatch probe', status: 'planned', description: '',
          priority: null, dueDate: null, projectId: null,
        },
      }),
    })
    const lifecycle = await lifecycleResponse.json()
    if (!lifecycleResponse.ok
      || lifecycle.contractVersion !== 'task-lifecycle-v1'
      || lifecycle.result !== 'preview'
      || rpcCount !== 1) {
      throw new Error(
        `packaged lifecycle route did not execute its canonical RPC dispatch `
        + `(status ${lifecycleResponse.status}, result ${String(lifecycle.result)}, `
        + `error ${JSON.stringify(lifecycle.error)}, rpcCount ${rpcCount})`,
      )
    }
  } finally {
    await close(fake)
    rmSync(dataDir, { recursive: true, force: true })
  }
}

module.exports = { probePackagedHermesRoutes }
