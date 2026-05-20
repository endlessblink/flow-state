import type { AgentActor, AgentCommandName, AgentCommandResult, AgentOperationType, AgentWorkspaceScope, ResolvedAgentWorkspaceScope } from './types'

const STORAGE_KEY = 'flowstate-agent-audit-log-v1'
const MAX_ENTRIES = 200

interface AuditStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem?: (key: string) => void
}

export interface AgentAuditLogEntry {
  id: string
  timestamp: string
  requestId: string
  actor: AgentActor
  command: AgentCommandName | string
  operation: AgentOperationType
  status: AgentCommandResult['status'] | 'denied'
  requestedWorkspace: AgentWorkspaceScope | null
  resolvedWorkspace: ResolvedAgentWorkspaceScope | null
  affectedEntityType?: AgentCommandResult['audit']['affectedEntityType']
  affectedEntityIds: string[]
  errorCode?: string
  errorMessage?: string
}

export interface AgentAuditRecordInput {
  requestId: string
  actor: AgentActor
  command: AgentCommandName | string
  requestedWorkspace: AgentWorkspaceScope | null
  result: AgentCommandResult | { status: 'denied'; operation?: AgentOperationType; code: string; message: string }
}

function getStorage(storage?: AuditStorage): AuditStorage | null {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function readEntries(storage?: AuditStorage): AgentAuditLogEntry[] {
  const target = getStorage(storage)
  if (!target) return []

  try {
    const raw = target.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeEntries(entries: AgentAuditLogEntry[], storage?: AuditStorage) {
  const target = getStorage(storage)
  if (!target) return
  target.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
}

function toEntry(input: AgentAuditRecordInput): AgentAuditLogEntry {
  const result = input.result
  const hasAudit = 'audit' in result

  return {
    id: `${input.requestId}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    requestId: input.requestId,
    actor: input.actor,
    command: input.command,
    operation: hasAudit ? result.audit.operation : result.operation ?? 'denied',
    status: result.status,
    requestedWorkspace: input.requestedWorkspace,
    resolvedWorkspace: hasAudit ? result.audit.workspace : null,
    affectedEntityType: hasAudit ? result.audit.affectedEntityType : undefined,
    affectedEntityIds: hasAudit ? result.audit.affectedEntityIds : [],
    errorCode: hasAudit ? result.error?.code : result.code,
    errorMessage: hasAudit ? result.error?.message : result.message,
  }
}

export function recordAgentAudit(input: AgentAuditRecordInput, storage?: AuditStorage): AgentAuditLogEntry {
  const entry = toEntry(input)
  writeEntries([entry, ...readEntries(storage)], storage)
  return entry
}

export function getAgentAuditLog(storage?: AuditStorage): AgentAuditLogEntry[] {
  return readEntries(storage)
}

export function clearAgentAuditLog(storage?: AuditStorage) {
  const target = getStorage(storage)
  target?.removeItem?.(STORAGE_KEY)
}

export const AGENT_AUDIT_LOG_STORAGE_KEY = STORAGE_KEY
