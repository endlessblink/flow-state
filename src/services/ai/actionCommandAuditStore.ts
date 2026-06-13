import Dexie, { type Table } from 'dexie'
import type { Lane, Task } from '@/types/tasks'
import type { AICommandAuditEntry } from './actionCommands'

export const AI_COMMAND_AUDIT_KEY = 'flowstate-ai-command-audit-trail'
export const AI_COMMAND_ROLLBACK_KEY = 'flowstate-ai-command-rollback-snapshots'

const MAX_AUDIT_ENTRIES = 50
const MAX_ROLLBACK_SNAPSHOTS = 20

export type AICommandAuditQuery = {
  batchId?: string
  sourceRunId?: string
  sourceMessageId?: string
  limit?: number
}

export type AICommandRollbackSnapshot = {
  rollbackPointer: string
  batchId: string
  createdAt: string
  tasksBefore: Task[]
  lanesBefore?: Lane[]
  appliedEntityIds: string[]
}

class AICommandAuditDatabase extends Dexie {
  auditEntries!: Table<AICommandAuditEntry, string>
  rollbackSnapshots!: Table<AICommandRollbackSnapshot, string>

  constructor() {
    super('FlowStateAICommandAudit')

    this.version(1).stores({
      auditEntries: 'batchId, timestamp, sourceRunId, sourceMessageId',
      rollbackSnapshots: 'rollbackPointer, batchId, createdAt',
    })
  }
}

let db: AICommandAuditDatabase | null = null

function getDB(): AICommandAuditDatabase {
  if (!db) {
    db = new AICommandAuditDatabase()
  }
  return db
}

function readJsonArray<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T[] : []
  } catch {
    return []
  }
}

function writeJsonArray<T>(key: string, value: T[]): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, JSON.stringify(value))
}

function sortNewestFirst(entries: AICommandAuditEntry[]): AICommandAuditEntry[] {
  return [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

function applyAuditQuery(entries: AICommandAuditEntry[], query: AICommandAuditQuery = {}): AICommandAuditEntry[] {
  let filtered = entries
  if (query.batchId) {
    filtered = filtered.filter(entry => entry.batchId === query.batchId)
  }
  if (query.sourceRunId) {
    filtered = filtered.filter(entry => entry.sourceRunId === query.sourceRunId)
  }
  if (query.sourceMessageId) {
    filtered = filtered.filter(entry => entry.sourceMessageId === query.sourceMessageId)
  }
  return sortNewestFirst(filtered).slice(0, query.limit ?? MAX_AUDIT_ENTRIES)
}

function persistLocalAuditEntry(entry: AICommandAuditEntry): void {
  const entries = readJsonArray<AICommandAuditEntry>(AI_COMMAND_AUDIT_KEY)
  entries.unshift(entry)
  writeJsonArray(AI_COMMAND_AUDIT_KEY, entries.slice(0, MAX_AUDIT_ENTRIES))
}

function persistLocalRollbackSnapshot(snapshot: AICommandRollbackSnapshot): void {
  const snapshots = readJsonArray<AICommandRollbackSnapshot>(AI_COMMAND_ROLLBACK_KEY)
  snapshots.unshift(snapshot)
  writeJsonArray(AI_COMMAND_ROLLBACK_KEY, snapshots.slice(0, MAX_ROLLBACK_SNAPSHOTS))
}

export async function persistAICommandAuditEntry(entry: AICommandAuditEntry): Promise<void> {
  persistLocalAuditEntry(entry)
  try {
    await getDB().auditEntries.put(entry)
  } catch (error) {
    console.warn('[AI-COMMAND-AUDIT] Failed to persist audit entry to IndexedDB:', error)
  }
}

export async function persistAICommandRollbackSnapshot(snapshot: AICommandRollbackSnapshot): Promise<void> {
  persistLocalRollbackSnapshot(snapshot)
  try {
    await getDB().rollbackSnapshots.put(snapshot)
  } catch (error) {
    console.warn('[AI-COMMAND-AUDIT] Failed to persist rollback snapshot to IndexedDB:', error)
  }
}

export function getLocalAICommandAuditTrail(query: AICommandAuditQuery = {}): AICommandAuditEntry[] {
  return applyAuditQuery(readJsonArray<AICommandAuditEntry>(AI_COMMAND_AUDIT_KEY), query)
}

export async function loadAICommandAuditTrail(query: AICommandAuditQuery = {}): Promise<AICommandAuditEntry[]> {
  try {
    const entries = await getDB().auditEntries.toArray()
    if (entries.length > 0) {
      return applyAuditQuery(entries, query)
    }
  } catch (error) {
    console.warn('[AI-COMMAND-AUDIT] Failed to load audit entries from IndexedDB:', error)
  }
  return getLocalAICommandAuditTrail(query)
}

export async function loadAICommandRollbackSnapshot(rollbackPointer: string): Promise<AICommandRollbackSnapshot | null> {
  try {
    const snapshot = await getDB().rollbackSnapshots.get(rollbackPointer)
    if (snapshot) return snapshot
  } catch (error) {
    console.warn('[AI-COMMAND-AUDIT] Failed to load rollback snapshot from IndexedDB:', error)
  }
  return readJsonArray<AICommandRollbackSnapshot>(AI_COMMAND_ROLLBACK_KEY)
    .find(snapshot => snapshot.rollbackPointer === rollbackPointer) ?? null
}

export async function clearAICommandAuditStoreForTests(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(AI_COMMAND_AUDIT_KEY)
    localStorage.removeItem(AI_COMMAND_ROLLBACK_KEY)
  }
  try {
    const database = getDB()
    await database.delete()
  } catch {
    // Test cleanup should remain best-effort when IndexedDB is unavailable.
  } finally {
    db = null
  }
}
