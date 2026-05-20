import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { agentBridgeState } from './agentBridgeState'

export interface AgentBridgeRequest {
  requestId: string
  command: string
  arguments?: Record<string, unknown>
}

interface PendingRendererRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

const REQUEST_TIMEOUT_MS = 10_000

let server: Server | null = null
let currentWindow: BrowserWindow | null = null
const pending = new Map<string, PendingRendererRequest>()

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

function hasValidBearer(req: IncomingMessage): boolean {
  const expected = agentBridgeState.getSessionTokenForLaunch()
  if (!expected) return false
  return req.headers.authorization === `Bearer ${expected}`
}

function sendToRenderer(payload: AgentBridgeRequest): Promise<unknown> {
  if (!currentWindow || currentWindow.isDestroyed()) {
    throw new Error('FlowState renderer is not available')
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(payload.requestId)
      reject(new Error('FlowState renderer did not respond to agent bridge request'))
    }, REQUEST_TIMEOUT_MS)

    pending.set(payload.requestId, { resolve, reject, timeout })
    currentWindow!.webContents.send('agent:read-request', payload)
  })
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST' || req.url !== '/agent/read') {
    sendJson(res, 404, { error: 'not_found' })
    return
  }

  if (!hasValidBearer(req)) {
    sendJson(res, 403, { error: 'forbidden' })
    return
  }

  try {
    const parsed = JSON.parse(await readBody(req)) as AgentBridgeRequest
    if (!parsed.requestId || !parsed.command) {
      sendJson(res, 400, { error: 'invalid_agent_request' })
      return
    }

    const result = await sendToRenderer(parsed)
    sendJson(res, 200, { result })
  } catch (error) {
    sendJson(res, 500, {
      error: 'agent_bridge_error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function startAgentBridgeServer(window: BrowserWindow): Promise<{ bridgeUrl: string; token: string }> {
  currentWindow = window

  if (server) {
    const existing = agentBridgeState.getConnectionForLaunch()
    if (existing) return existing
  }

  server = createServer(handleRequest)

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(0, '127.0.0.1', () => {
      server!.removeListener('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind local agent bridge')
  }

  agentBridgeState.enable(`http://127.0.0.1:${address.port}`)
  const connection = agentBridgeState.getConnectionForLaunch()
  if (!connection) throw new Error('Agent bridge token was not issued')
  return connection
}

export async function stopAgentBridgeServer() {
  for (const [requestId, entry] of pending) {
    clearTimeout(entry.timeout)
    entry.reject(new Error('Agent bridge stopped'))
    pending.delete(requestId)
  }

  await new Promise<void>(resolve => {
    if (!server) {
      resolve()
      return
    }

    server.close(() => resolve())
    server = null
  })

  currentWindow = null
  agentBridgeState.disable()
}

export function registerAgentBridgeResponseHandler() {
  ipcMain.handle('agent:read-response', async (_event, payload: { requestId: string; result?: unknown; error?: string }) => {
    const entry = pending.get(payload.requestId)
    if (!entry) return

    clearTimeout(entry.timeout)
    pending.delete(payload.requestId)

    if (payload.error) {
      entry.reject(new Error(payload.error))
    } else {
      entry.resolve(payload.result)
    }
  })
}
