import { describe, expect, it, vi } from 'vitest'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

const root = process.cwd()
const bridgeClientPath = join(root, 'tools/flowstate-mcp/src/bridgeClient.js')

describe('FlowState MCP bridge client', () => {
  it('fails closed when bridge env vars are missing', async () => {
    const { callFlowStateBridge } = await import(pathToFileURL(bridgeClientPath).href)
    const result = await callFlowStateBridge('flowstate_get_context', {}, { env: {} })

    expect(result).toEqual({
      status: 'error',
      code: 'flowstate_bridge_unavailable',
      message: 'Tool flowstate_get_context is registered, but the FlowState desktop bridge is not connected yet.',
    })
  })

  it('fails closed when the bridge URL is not local loopback HTTP', async () => {
    const { callFlowStateBridge } = await import(pathToFileURL(bridgeClientPath).href)
    const fetchMock = vi.fn()

    const result = await callFlowStateBridge('flowstate_get_context', {}, {
      fetch: fetchMock,
      env: {
        FLOWSTATE_AGENT_BRIDGE_URL: 'https://example.com/agent',
        FLOWSTATE_AGENT_BRIDGE_TOKEN: 'secret-token',
      },
    })

    expect(result.code).toBe('flowstate_bridge_unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards read tool calls to the configured local bridge with bearer token', async () => {
    const { callFlowStateBridge } = await import(pathToFileURL(bridgeClientPath).href)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: 'success', data: { ok: true } } }),
    })

    const result = await callFlowStateBridge('flowstate_get_context', { workspace: { type: 'active' } }, {
      fetch: fetchMock,
      requestId: 'request-1',
      config: { bridgeUrl: 'http://127.0.0.1:4567', token: 'secret-token' },
    })

    expect(result).toEqual({ status: 'success', data: { ok: true } })
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4567/agent/read', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer secret-token',
      },
      body: JSON.stringify({ requestId: 'request-1', command: 'flowstate_get_context', arguments: { workspace: { type: 'active' } } }),
    })
  })

  it('forwards dry-run write tool arguments to the local bridge', async () => {
    const { callFlowStateBridge } = await import(pathToFileURL(bridgeClientPath).href)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: 'success', operation: 'dry_run' } }),
    })
    const args = {
      workspace: { type: 'personal' },
      dryRun: true,
      idempotencyKey: 'idem-1',
      title: 'Draft task',
    }

    const result = await callFlowStateBridge('flowstate_create_task', args, {
      fetch: fetchMock,
      requestId: 'request-2',
      config: { bridgeUrl: 'http://localhost:4567', token: 'secret-token' },
    })

    expect(result).toEqual({ status: 'success', operation: 'dry_run' })
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4567/agent/read', expect.objectContaining({
      body: JSON.stringify({ requestId: 'request-2', command: 'flowstate_create_task', arguments: args }),
    }))
  })

  it('fails closed when the local bridge request fails', async () => {
    const { callFlowStateBridge } = await import(pathToFileURL(bridgeClientPath).href)
    const result = await callFlowStateBridge('flowstate_get_context', {}, {
      fetch: vi.fn().mockRejectedValue(new Error('connection refused')),
      config: { bridgeUrl: 'http://127.0.0.1:4567', token: 'secret-token' },
    })

    expect(result).toEqual({
      status: 'error',
      code: 'flowstate_bridge_error',
      message: 'connection refused',
    })
  })
})
