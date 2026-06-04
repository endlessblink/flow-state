/**
 * TASK-1586: API Contract Tests — DB column name correctness
 *
 * BUG-1211 root cause: `useSyncOrchestrator.ts` used the app-side field name
 * `_soft_deleted` when writing to Supabase, but the DB column is `is_deleted`.
 * This caused every soft-delete to fail and fall back to a hard DELETE, creating
 * permanent tombstones on every deletion.
 *
 * These tests guard against that entire class of name-mismatch bugs by
 * inspecting the actual source text of the mapper and sync orchestrator.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// ES module imports for runtime tests
import { toSupabaseTask, fromSupabaseTask } from '@/utils/supabaseMappers'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readSrc = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

// --------------------------------------------------------------------------
// Source texts read once for all static-analysis tests
// --------------------------------------------------------------------------
const MAPPERS_SRC = readSrc('src/utils/supabaseMappers.ts')
const SYNC_SRC    = readSrc('src/composables/sync/useSyncOrchestrator.ts')

// All column names that exist in the `tasks` table (from SupabaseTask interface
// and confirmed against the DB schema documented in system-architecture.md).
const VALID_TASK_COLUMNS = new Set([
  'id', 'user_id', 'project_id', 'title', 'description', 'status', 'priority',
  'progress', 'total_pomodoros', 'completed_pomodoros', 'estimated_pomodoros',
  'due_date', 'due_time', 'estimated_duration',
  'subtasks', 'tags', 'depends_on',
  'position', 'position_version',
  'instances', 'connection_types', 'recurrence', 'recurring_instances',
  'notification_prefs', 'reminders', 'attachments',
  'recurrence_rule', 'recurrence_parent_id', 'recurrence_count',
  'parent_task_id',
  'order', 'column_id', 'is_in_inbox',
  'scheduled_date', 'scheduled_time', 'is_uncategorized',
  'is_deleted', 'deleted_at', 'completed_at',
  'done_for_now_until', 'is_completion_record', 'is_pinned',
  'workspace_id', 'assigned_to',
  'created_at', 'updated_at',
  'planning_notes', // TASK-1768: mini-canvas planning notes (jsonb)
  'mini_canvas_edges', // Mini-canvas user-drawn edges (jsonb)
  'calendar_locked', // TASK-1785 Push 2: ripple-shift skip-protect flag (boolean)
  'lane_id', // TASK-1812: sprint-style cross-project lane membership (nullable FK)
])

// --------------------------------------------------------------------------
// Helper: extract the return-object literal keys from toSupabaseTask().
// We look for `key:` patterns that appear at the top level of the return {}.
// --------------------------------------------------------------------------
function extractReturnObjectTopLevelKeys(src: string): string[] {
  const fnStart = src.indexOf('export function toSupabaseTask(')
  if (fnStart === -1) throw new Error('toSupabaseTask not found')

  // Find the `return {` inside the function
  const returnStart = src.indexOf('return {', fnStart)
  if (returnStart === -1) throw new Error('return { not found in toSupabaseTask')

  // Extract the return block up to its matching `}`
  let depth = 0
  let i = returnStart + 7 // skip 'return '
  let blockEnd = i
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) { blockEnd = i; break }
    }
  }
  const block = src.slice(returnStart + 7, blockEnd + 1)

  // Strategy: extract top-level keys by splitting into lines and finding
  // lines at depth=1 (not inside a nested { } or [ ]) that match
  // the pattern: leading whitespace + identifier + optional ? + colon + space
  // This is more reliable than character-walking for ternary expressions.
  const lines = block.split('\n')
  const keys: string[] = []
  let nestDepth = 0

  for (const line of lines) {
    const trimmed = line.trimStart()
    // Count depth changes: a line like `position: {` opens a nested object
    // Count { and } on this line BEFORE deciding if the key belongs to depth=1
    const openCount = (trimmed.match(/\{|\[/g) || []).length
    const closeCount = (trimmed.match(/\}|\]/g) || []).length

    if (nestDepth === 0) {
      // At top level of the return object — look for a key assignment
      // Pattern: starts with `identifier:` or `identifier?:` or `...(`
      const keyMatch = trimmed.match(/^(\w+)\s*\??\s*:(?!\s*\/\/)/)
      if (keyMatch) {
        keys.push(keyMatch[1])
      }
    }

    nestDepth += openCount - closeCount
    if (nestDepth < 0) nestDepth = 0
  }

  return keys
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('TASK-1586: API Contract Tests — supabaseMappers.ts', () => {

  it('1. toSupabaseTask() return object uses only valid DB column names', () => {
    const keys = extractReturnObjectTopLevelKeys(MAPPERS_SRC)

    const jsKeywords = new Set([
      'return', 'if', 'else', 'const', 'let', 'var', 'for', 'while',
      'true', 'false', 'null', 'undefined', 'function', 'length', 'message',
    ])
    // Filter to snake_case-like keys (contain underscore or are valid column names)
    const columnLikeKeys = keys.filter(k => !jsKeywords.has(k) && /^[a-z]/.test(k))

    const unknownColumns = columnLikeKeys.filter(k => !VALID_TASK_COLUMNS.has(k))
    expect(
      unknownColumns,
      `Unknown DB columns in toSupabaseTask() return object: ${unknownColumns.join(', ')}`
    ).toEqual([])
  })

  it('2. fromSupabaseTask() reads from valid DB column names', () => {
    const start = MAPPERS_SRC.indexOf('export function fromSupabaseTask(')
    expect(start).toBeGreaterThan(-1)
    const snippet = MAPPERS_SRC.slice(start, start + 4000)

    // Mapper references `record.column_name` — extract those column names
    const columnRefs = [...snippet.matchAll(/record\.(\w+)/g)].map(m => m[1])
    const uniqueRefs = [...new Set(columnRefs)]

    const unknownRefs = uniqueRefs.filter(col => !VALID_TASK_COLUMNS.has(col))
    expect(
      unknownRefs,
      `fromSupabaseTask() references unknown DB columns: ${unknownRefs.join(', ')}`
    ).toEqual([])
  })

  it('3. Sync orchestrator DELETE case uses "is_deleted", not "_soft_deleted"', () => {
    // Extract just the delete case: from "case 'delete':" up to the next "break"
    const deleteIdx = SYNC_SRC.indexOf("case 'delete':")
    expect(deleteIdx).toBeGreaterThan(-1)

    // Extract the delete block up to its break statement
    const breakIdx = SYNC_SRC.indexOf('\n        break', deleteIdx)
    const deleteBlock = SYNC_SRC.slice(deleteIdx, breakIdx + 20)

    expect(deleteBlock).toContain('is_deleted')

    // The old bug: `_soft_deleted` was used as a DB column name in the update payload.
    // Any occurrence of `_soft_deleted` in the delete block is a violation.
    // We look specifically for it as a key in the update payload object.
    const hasBuggyField = /_soft_deleted\s*:/.test(deleteBlock)
    expect(hasBuggyField, 'DELETE case must not use _soft_deleted as a DB column key').toBe(false)
  })

  it('4. Sync orchestrator DELETE case sets "deleted_at" alongside "is_deleted"', () => {
    const deleteIdx = SYNC_SRC.indexOf("case 'delete':")
    expect(deleteIdx).toBeGreaterThan(-1)
    const breakIdx = SYNC_SRC.indexOf('\n        break', deleteIdx)
    const deleteBlock = SYNC_SRC.slice(deleteIdx, breakIdx + 20)

    // Both fields must appear in the soft-delete update block
    expect(deleteBlock).toContain('is_deleted')
    expect(deleteBlock).toContain('deleted_at')

    // They should appear in the same .update({...}) call
    // Find the .update( call and verify it contains both fields
    const updateCallMatch = deleteBlock.match(/\.update\(\{([^}]+)\}/)
    expect(updateCallMatch, '.update({...}) call should exist in delete block').toBeTruthy()
    const updatePayload = updateCallMatch![1]
    expect(updatePayload).toContain('is_deleted')
    expect(updatePayload).toContain('deleted_at')
  })

  it('5. All 5 entity type table names in sync orchestrator are valid', () => {
    // Extract the tableMap object body — between `const tableMap` and the closing `}`
    const tableMapIdx = SYNC_SRC.indexOf('const tableMap')
    expect(tableMapIdx).toBeGreaterThan(-1)

    // Find the object literal `{` and its matching `}`
    const openBrace = SYNC_SRC.indexOf('{', tableMapIdx)
    let depth = 0
    let closeBrace = openBrace
    for (let i = openBrace; i < SYNC_SRC.length; i++) {
      if (SYNC_SRC[i] === '{') depth++
      else if (SYNC_SRC[i] === '}') {
        depth--
        if (depth === 0) { closeBrace = i; break }
      }
    }
    const tableMapBlock = SYNC_SRC.slice(openBrace, closeBrace + 1)

    // Extract all single-quoted string values (the table names, right-hand side of key: 'value')
    const valueMatches = [...tableMapBlock.matchAll(/:\s*'([a-z_]+)'/g)].map(m => m[1])

    const validTableNames = ['tasks', 'groups', 'projects', 'lanes', 'timer_sessions', 'quick_sort_sessions']
    for (const tableName of validTableNames) {
      expect(
        valueMatches,
        `Table name "${tableName}" should be in tableMap values`
      ).toContain(tableName)
    }

    // Ensure no invalid table names snuck in on the value side
    const unknownTables = valueMatches.filter(t => !validTableNames.includes(t))
    expect(unknownTables, `Unknown table names as values: ${unknownTables.join(', ')}`).toEqual([])
  })

  it('6. Task mapper preserves JSONB subtasks field without corruption', () => {
    const userId = 'user-test-001'

    const subtasks = [
      { id: 'sub-1', title: 'First subtask', done: false },
      { id: 'sub-2', title: 'Second subtask', done: true },
    ]

    const task = {
      id: 'task-123e4567-e89b-12d3-a456-426614174000',
      title: 'Test Task',
      description: '',
      status: 'todo' as const,
      priority: null,
      projectId: 'project-123e4567-e89b-12d3-a456-426614174000',
      completedPomodoros: 0,
      estimatedPomodoros: 1,
      progress: 0,
      dueDate: '',
      subtasks,
      tags: [],
      isInInbox: false,
      order: 0,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }

    const dbRecord = toSupabaseTask(task as any, userId)
    expect(dbRecord.subtasks).toEqual(subtasks)
    expect(Array.isArray(dbRecord.subtasks)).toBe(true)
    expect(dbRecord.subtasks![0]).toMatchObject({ id: 'sub-1', title: 'First subtask', done: false })
  })

  it('7. Task mapper preserves tags array without corruption', () => {
    const userId = 'user-test-001'
    const tags = ['urgent', 'frontend', 'bug']

    const task = {
      id: 'task-123e4567-e89b-12d3-a456-426614174000',
      title: 'Tagged Task',
      description: '',
      status: 'todo' as const,
      priority: null,
      projectId: 'project-123e4567-e89b-12d3-a456-426614174000',
      completedPomodoros: 0,
      estimatedPomodoros: 1,
      progress: 0,
      dueDate: '',
      subtasks: [],
      tags,
      isInInbox: false,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const dbRecord = toSupabaseTask(task as any, userId)
    expect(dbRecord.tags).toEqual(tags)
    expect(Array.isArray(dbRecord.tags)).toBe(true)
    expect(dbRecord.tags!.every((t: string) => typeof t === 'string')).toBe(true)

    // Round-trip: tags survive fromSupabaseTask
    const supabaseRecord = {
      id: task.id,
      user_id: userId,
      title: task.title,
      description: '',
      status: 'planned',
      project_id: task.projectId,
      tags,
      subtasks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const roundTripped = fromSupabaseTask(supabaseRecord as any)
    expect(roundTripped.tags).toEqual(tags)
  })

  it('8. Task mapper handles null/undefined fields gracefully without throwing', () => {
    const userId = 'user-test-001'

    const minimalTask = {
      id: 'task-123e4567-e89b-12d3-a456-426614174000',
      title: 'Minimal Task',
      description: undefined,
      status: 'todo' as const,
      priority: null,
      projectId: 'project-123e4567-e89b-12d3-a456-426614174000',
      completedPomodoros: 0,
      estimatedPomodoros: 1,
      progress: 0,
      dueDate: undefined,
      subtasks: undefined,
      tags: undefined,
      isInInbox: undefined,
      order: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    }

    expect(() => toSupabaseTask(minimalTask as any, userId)).not.toThrow()

    const result = toSupabaseTask(minimalTask as any, userId)
    expect(result).toBeDefined()
    expect(result.id).toBe(minimalTask.id)
    expect(result.title).toBe(minimalTask.title)
    // Null/undefined fields should be coerced to safe DB values
    expect(result.subtasks).toBeDefined()   // should be [] not undefined
    expect(result.tags).toBeDefined()       // should be [] not undefined
    expect(result.due_date).toBeNull()
  })

  it('9. Task mapper camelCase→snake_case conversion is consistent', () => {
    const userId = 'user-test-001'

    const task = {
      id: 'task-123e4567-e89b-12d3-a456-426614174000',
      title: 'Conversion Test',
      description: 'desc',
      status: 'todo' as const,
      priority: 'high' as const,
      projectId: 'project-123e4567-e89b-12d3-a456-426614174000',
      completedPomodoros: 3,
      estimatedPomodoros: 5,
      progress: 60,
      dueDate: '2026-03-21',
      subtasks: [],
      tags: ['test'],
      isInInbox: true,
      order: 7,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-03-01'),
    }

    const result = toSupabaseTask(task as any, userId)

    // Verify key camelCase→snake_case mappings
    expect(result).toHaveProperty('project_id')       // projectId → project_id
    expect(result).not.toHaveProperty('projectId')

    expect(result).toHaveProperty('due_date')          // dueDate → due_date
    expect(result).not.toHaveProperty('dueDate')

    expect(result).toHaveProperty('is_in_inbox')       // isInInbox → is_in_inbox
    expect(result).not.toHaveProperty('isInInbox')

    expect(result).toHaveProperty('is_deleted')        // _soft_deleted → is_deleted
    expect(result).not.toHaveProperty('_soft_deleted')

    expect(result).toHaveProperty('created_at')        // createdAt → created_at
    expect(result).not.toHaveProperty('createdAt')

    expect(result).toHaveProperty('updated_at')        // updatedAt → updated_at
    expect(result).not.toHaveProperty('updatedAt')
  })

  it('10. No raw SQL column names leaked into the frontend Task interface', () => {
    const taskTypesSrc = readSrc('src/types/tasks.ts')

    // Find the Task interface body
    const taskInterfaceStart = taskTypesSrc.indexOf('export interface Task {')
    expect(taskInterfaceStart).toBeGreaterThan(-1)

    // Extract the interface body up to its closing brace
    let depth = 0
    let inInterface = false
    let end = taskInterfaceStart
    for (let i = taskInterfaceStart; i < taskTypesSrc.length; i++) {
      if (taskTypesSrc[i] === '{') { depth++; inInterface = true }
      else if (taskTypesSrc[i] === '}') {
        depth--
        if (inInterface && depth === 0) { end = i; break }
      }
    }
    const interfaceBody = taskTypesSrc.slice(taskInterfaceStart, end + 1)

    // SQL column names that must NOT appear as property names in Task interface
    const sqlColumnNames = [
      'project_id', 'due_date', 'is_deleted', 'deleted_at', 'is_in_inbox',
      'user_id', 'created_at', 'updated_at', 'completed_at',
      'parent_task_id', 'position_version', 'total_pomodoros',
      'completed_pomodoros', 'estimated_pomodoros',
    ]

    for (const colName of sqlColumnNames) {
      // Check it does not appear as a property key (e.g. "  project_id?:" or "  project_id:")
      const asProperty = new RegExp(`\\b${colName}\\s*[?!]?\\s*:`, 'g')
      const matches = interfaceBody.match(asProperty) || []
      expect(
        matches.length,
        `SQL column name "${colName}" must not appear as a property in the Task interface`
      ).toBe(0)
    }
  })
})
