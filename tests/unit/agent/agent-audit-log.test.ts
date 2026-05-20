import { describe, expect, it } from 'vitest'
import { AGENT_AUDIT_LOG_STORAGE_KEY, clearAgentAuditLog, getAgentAuditLog, recordAgentAudit } from '@/domain/agent'
import type { AgentCommandContext, AgentCommandResult } from '@/domain/agent'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
  }
}

const context: AgentCommandContext = {
  requestId: 'request-1',
  actor: { id: 'agent-1', name: 'Local Agent', transport: 'stdio' },
  workspace: { type: 'workspace', workspaceId: 'workspace-a' },
}

const result: AgentCommandResult = {
  status: 'success',
  command: 'flowstate_search_tasks',
  operation: 'read',
  workspace: { type: 'workspace', workspaceId: 'workspace-a', label: 'Workspace A' },
  data: { tasks: [{ id: 'task-1', title: 'Private task body' }] },
  audit: {
    operation: 'read',
    command: 'flowstate_search_tasks',
    workspace: { type: 'workspace', workspaceId: 'workspace-a', label: 'Workspace A' },
    affectedEntityType: 'task',
    affectedEntityIds: ['task-1'],
  },
}

describe('agent audit log', () => {
  it('records metadata without persisting command result data payloads', () => {
    const storage = memoryStorage()
    const entry = recordAgentAudit({
      requestId: context.requestId,
      actor: context.actor,
      command: 'flowstate_search_tasks',
      requestedWorkspace: context.workspace,
      result,
    }, storage)

    expect(entry).toMatchObject({
      requestId: 'request-1',
      command: 'flowstate_search_tasks',
      operation: 'read',
      status: 'success',
      requestedWorkspace: { type: 'workspace', workspaceId: 'workspace-a' },
      resolvedWorkspace: { type: 'workspace', workspaceId: 'workspace-a', label: 'Workspace A' },
      affectedEntityType: 'task',
      affectedEntityIds: ['task-1'],
    })

    expect(storage.getItem(AGENT_AUDIT_LOG_STORAGE_KEY)).not.toContain('Private task body')
    expect(getAgentAuditLog(storage)).toHaveLength(1)
  })

  it('records denied bridge requests with error metadata', () => {
    const storage = memoryStorage()
    recordAgentAudit({
      requestId: 'request-2',
      actor: context.actor,
      command: 'flowstate_create_task',
      requestedWorkspace: null,
      result: {
        status: 'denied',
        code: 'agent_command_denied',
        message: 'Only read-only commands are available.',
      },
    }, storage)

    expect(getAgentAuditLog(storage)[0]).toMatchObject({
      requestId: 'request-2',
      command: 'flowstate_create_task',
      operation: 'denied',
      status: 'denied',
      requestedWorkspace: null,
      resolvedWorkspace: null,
      affectedEntityIds: [],
      errorCode: 'agent_command_denied',
      errorMessage: 'Only read-only commands are available.',
    })
  })

  it('keeps newest entries first and caps the log', () => {
    const storage = memoryStorage()
    for (let index = 0; index < 205; index += 1) {
      recordAgentAudit({
        requestId: `request-${index}`,
        actor: context.actor,
        command: 'flowstate_get_context',
        requestedWorkspace: { type: 'active' },
        result: { ...result, command: 'flowstate_get_context' },
      }, storage)
    }

    const entries = getAgentAuditLog(storage)
    expect(entries).toHaveLength(200)
    expect(entries[0].requestId).toBe('request-204')
    expect(entries.at(-1)?.requestId).toBe('request-5')
  })

  it('can clear persisted entries', () => {
    const storage = memoryStorage()
    recordAgentAudit({
      requestId: context.requestId,
      actor: context.actor,
      command: 'flowstate_search_tasks',
      requestedWorkspace: context.workspace,
      result,
    }, storage)

    clearAgentAuditLog(storage)
    expect(getAgentAuditLog(storage)).toEqual([])
  })
})
