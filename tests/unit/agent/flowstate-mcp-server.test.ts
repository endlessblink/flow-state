import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

const root = process.cwd()
const serverPath = join(root, 'tools/flowstate-mcp/src/server.js')
const toolDefinitionsPath = join(root, 'tools/flowstate-mcp/src/toolDefinitions.js')

describe('FlowState local MCP server skeleton', () => {
  it('lists read tools plus dry-run-only write tools', () => {
    const output = execFileSync('node', [serverPath, '--list-tools'], { encoding: 'utf-8' })
    const parsed = JSON.parse(output)
    const names = parsed.tools.map((tool: { name: string }) => tool.name)

    expect(names).toEqual([
      'flowstate_get_context',
      'flowstate_list_workspaces',
      'flowstate_get_active_workspace',
      'flowstate_search_tasks',
      'flowstate_get_task',
      'flowstate_list_projects',
      'flowstate_get_today',
      'flowstate_get_sync_status',
      'flowstate_create_task',
      'flowstate_update_task',
      'flowstate_complete_task',
      'flowstate_move_task_to_project',
      'flowstate_add_task_comment',
      'flowstate_soft_delete_task',
    ])
    expect(names.join('\n')).not.toContain('permanent')
    expect(names.join('\n')).not.toContain('hard_delete')
  })

  it('keeps MCP write tools dry-run-only with workspace and idempotency inputs', async () => {
    const { DRY_RUN_WRITE_TOOLS } = await import(pathToFileURL(toolDefinitionsPath).href)

    expect(DRY_RUN_WRITE_TOOLS.map((tool: { name: string }) => tool.name)).toEqual([
      'flowstate_create_task',
      'flowstate_update_task',
      'flowstate_complete_task',
      'flowstate_move_task_to_project',
      'flowstate_add_task_comment',
      'flowstate_soft_delete_task',
    ])

    for (const tool of DRY_RUN_WRITE_TOOLS) {
      expect(tool.description.toLowerCase()).toContain('dry-run')
      expect(tool.inputSchema.required).toContain('workspace')
      expect(tool.inputSchema.required).toContain('dryRun')
      expect(tool.inputSchema.required).toContain('idempotencyKey')
      expect(tool.inputSchema.properties.dryRun).toMatchObject({ const: true })
    }
  })

  it('declares workspace-scoped inputs on task and project tools', async () => {
    const { READ_ONLY_TOOLS } = await import(pathToFileURL(toolDefinitionsPath).href)
    const scopedTools = READ_ONLY_TOOLS.filter((tool: { name: string }) => [
      'flowstate_get_context',
      'flowstate_search_tasks',
      'flowstate_get_task',
      'flowstate_list_projects',
      'flowstate_get_today',
    ].includes(tool.name))

    expect(scopedTools).toHaveLength(5)
    for (const tool of scopedTools) {
      expect(tool.inputSchema.properties.workspace, `${tool.name} must accept workspace scope`).toBeDefined()
    }
  })

  it('responds to MCP initialize and tools/list JSON-RPC methods', async () => {
    const { handleJsonRpcMessage } = await import(pathToFileURL(serverPath).href)

    expect(await handleJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'flowstate-local-mcp' },
      },
    })

    const listResponse = await handleJsonRpcMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    expect(listResponse.result.tools).toHaveLength(14)
  })

  it('does not execute tools before the FlowState desktop bridge exists', async () => {
    const { handleJsonRpcMessage } = await import(pathToFileURL(serverPath).href)
    const response = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'flowstate_get_context', arguments: {} },
    })

    expect(response.result.isError).toBe(true)
    expect(response.result.structuredContent.result).toEqual({
      status: 'error',
      code: 'flowstate_bridge_unavailable',
      message: 'Tool flowstate_get_context is registered, but the FlowState desktop bridge is not connected yet.',
    })
  })

  it('marks conflict tool results as MCP errors', async () => {
    process.env.FLOWSTATE_AGENT_BRIDGE_URL = 'http://127.0.0.1:4567'
    process.env.FLOWSTATE_AGENT_BRIDGE_TOKEN = 'secret-token'

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        result: {
          status: 'conflict',
          code: 'pending_write_conflict',
          message: 'One or more affected tasks already have pending local writes.',
        },
      }),
    })) as typeof fetch

    try {
      const { handleJsonRpcMessage } = await import(pathToFileURL(serverPath).href)
      const response = await handleJsonRpcMessage({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'flowstate_update_task', arguments: { workspace: { type: 'personal' }, dryRun: true, idempotencyKey: 'idem-1', taskId: 'task-1', changes: { title: 'Draft' } } },
      })

      expect(response.result.isError).toBe(true)
      expect(response.result.structuredContent.result.status).toBe('conflict')
    } finally {
      globalThis.fetch = originalFetch
      delete process.env.FLOWSTATE_AGENT_BRIDGE_URL
      delete process.env.FLOWSTATE_AGENT_BRIDGE_TOKEN
    }
  })
})
