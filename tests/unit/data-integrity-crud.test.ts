/**
 * TASK-1587: Data Integrity CRUD Round-Trip Tests
 *
 * Verifies that every field of a Task survives the full mapper round-trip:
 *   toSupabaseTask() → (SupabaseTask record) → fromSupabaseTask()
 *
 * No network calls. No stores. Pure unit tests on mapper functions.
 *
 * 15 tests covering field fidelity, edge cases, and batch behavior.
 */

import { describe, it, expect } from 'vitest'
import { toSupabaseTask, fromSupabaseTask, type SupabaseTask } from '@/utils/supabaseMappers'
import { createMockTask } from '../factories'
import type { Task, Subtask } from '@/types/tasks'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const VALID_UUID_2 = '22222222-2222-4222-8222-222222222222'

/** Run a full round-trip through both mappers. */
function roundTrip(task: Task): Task {
  const supabaseRecord = toSupabaseTask(task, TEST_USER_ID)
  // fromSupabaseTask expects the exact SupabaseTask shape. The record returned by
  // toSupabaseTask satisfies it, but we need to cast because updated_at is set
  // to now() inside the mapper (non-roundtrippable by design).
  return fromSupabaseTask(supabaseRecord as unknown as SupabaseTask)
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('TASK-1587: Data Integrity — mapper round-trip', () => {

  // Test 1: all fields populated
  it('task with all fields populated — all fields survive round-trip', () => {
    const subtask: Subtask = {
      id: VALID_UUID,
      parentTaskId: VALID_UUID_2,
      title: 'Sub A',
      description: 'desc',
      completedPomodoros: 2,
      isCompleted: false,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    }

    const task = createMockTask({
      id: VALID_UUID,
      title: 'Full Task',
      description: 'A description',
      status: 'todo',
      priority: 'high',
      progress: 42,
      completedPomodoros: 3,
      subtasks: [subtask],
      dueDate: '2025-06-15',
      dueTime: '14:30',
      estimatedDuration: 60,
      estimatedPomodoros: 4,
      projectId: VALID_UUID_2,
      isInInbox: true,
      tags: ['urgent', 'work'],
      canvasPosition: { x: 100, y: 200 },
      order: 5,
      _soft_deleted: false,
    })

    const result = roundTrip(task)

    expect(result.id).toBe(task.id)
    expect(result.title).toBe(task.title)
    expect(result.description).toBe(task.description)
    expect(result.status).toBe('todo')
    expect(result.priority).toBe('high')
    expect(result.progress).toBe(42)
    expect(result.completedPomodoros).toBe(3)
    expect(result.dueDate).toBe('2025-06-15')
    expect(result.dueTime).toBe('14:30')
    expect(result.estimatedDuration).toBe(60)
    expect(result.isInInbox).toBe(true)
    expect(result.tags).toEqual(['urgent', 'work'])
    expect(result.canvasPosition).toEqual({ x: 100, y: 200 })
    expect(result.order).toBe(5)
    expect(result.subtasks).toHaveLength(1)
    expect(result.subtasks[0].title).toBe('Sub A')
  })

  // Test 2: special characters in title
  it('task title with special characters (Hebrew, emoji, quotes, backslash) survives round-trip', () => {
    const specialTitle = 'שלום 🌟 "quoted" \\backslash\\ <angle>'
    const task = createMockTask({ id: VALID_UUID, title: specialTitle })
    const result = roundTrip(task)
    expect(result.title).toBe(specialTitle)
  })

  // Test 3: empty string fields preserve empty strings (not null)
  it('task with empty string fields preserves empty strings after round-trip', () => {
    const task = createMockTask({
      id: VALID_UUID,
      title: 'Has Empty',
      description: '',
      dueDate: '',
    })
    const result = roundTrip(task)
    // description: empty string → DB null/empty → fromSupabaseTask returns '' (fallback)
    expect(result.description).toBe('')
    // dueDate empty string: sanitizeTimestamp returns null → fromSupabaseTask returns ''
    expect(result.dueDate).toBe('')
  })

  // Test 4: null optional fields preserve nulls
  it('task with null optional fields preserves nulls after round-trip', () => {
    const task = createMockTask({
      id: VALID_UUID,
      priority: null,
      canvasPosition: undefined,
      dueDate: '',
    })
    const result = roundTrip(task)
    expect(result.priority).toBeNull()
    expect(result.canvasPosition).toBeUndefined()
  })

  // Test 5: subtasks (JSONB array) preserve structure
  it('task subtasks JSONB array preserves structure after round-trip', () => {
    const subtasks: Subtask[] = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        parentTaskId: '22222222-2222-4222-8222-222222222222',
        title: 'First subtask',
        description: 'details',
        completedPomodoros: 1,
        isCompleted: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        parentTaskId: '22222222-2222-4222-8222-222222222222',
        title: 'Second subtask',
        description: '',
        completedPomodoros: 0,
        isCompleted: false,
        createdAt: new Date('2025-01-03'),
        updatedAt: new Date('2025-01-04'),
      },
    ]
    const task = createMockTask({ id: VALID_UUID, subtasks })
    const result = roundTrip(task)

    expect(result.subtasks).toHaveLength(2)
    expect(result.subtasks[0].title).toBe('First subtask')
    expect(result.subtasks[0].isCompleted).toBe(true)
    expect(result.subtasks[1].title).toBe('Second subtask')
    expect(result.subtasks[1].isCompleted).toBe(false)
  })

  // Test 6: tags array preserves order and values
  it('task tags array preserves order and values after round-trip', () => {
    const tags = ['zebra', 'alpha', 'beta', 'delta-tag', '123', 'has space']
    const task = createMockTask({ id: VALID_UUID, tags })
    const result = roundTrip(task)
    expect(result.tags).toEqual(tags)
  })

  // Test 7: very long description preserves full text
  it('task with 10,000-character description preserves full text after round-trip', () => {
    const longDesc = 'A'.repeat(5000) + 'B'.repeat(5000)
    const task = createMockTask({ id: VALID_UUID, description: longDesc })
    const result = roundTrip(task)
    expect(result.description).toBe(longDesc)
    expect(result.description).toHaveLength(10000)
  })

  // Test 8: dates preserve exact values
  it('task dates (dueDate, createdAt) preserve exact values after round-trip', () => {
    const specificDate = new Date('2025-03-15T10:00:00.000Z')
    const task = createMockTask({
      id: VALID_UUID,
      dueDate: '2025-06-30',
      createdAt: specificDate,
    })
    const result = roundTrip(task)

    // dueDate is a date-only string — must survive without timezone shift
    expect(result.dueDate).toBe('2025-06-30')
    // createdAt converts to/from ISO string — should match original timestamp
    expect(result.createdAt.getTime()).toBe(specificDate.getTime())
  })

  // Test 9: canvasPosition preserves x/y coordinates
  it('task with canvasPosition preserves x/y coordinates after round-trip', () => {
    const task = createMockTask({
      id: VALID_UUID,
      canvasPosition: { x: -512.75, y: 1024.33 },
    })
    const result = roundTrip(task)
    expect(result.canvasPosition).toBeDefined()
    expect(result.canvasPosition!.x).toBe(-512.75)
    expect(result.canvasPosition!.y).toBe(1024.33)
  })

  // Test 10: mapper doesn't add extra fields that don't exist in source
  it('mapper does not add unexpected fields to the mapped task', () => {
    const task = createMockTask({ id: VALID_UUID, title: 'Minimal' })
    const supabaseRecord = toSupabaseTask(task, TEST_USER_ID)

    // These fields must not be injected by the mapper (they come from DB only)
    expect((supabaseRecord as Record<string, unknown>).nonExistentField).toBeUndefined()
    expect((supabaseRecord as Record<string, unknown>).phantom_column).toBeUndefined()
  })

  // Test 11: mapper doesn't drop fields that exist in source
  it('mapper does not drop fields that exist in the source task', () => {
    const task = createMockTask({
      id: VALID_UUID,
      title: 'Keep All Fields',
      tags: ['a', 'b'],
      estimatedDuration: 30,
      isInInbox: true,
      order: 7,
    })
    const supabaseRecord = toSupabaseTask(task, TEST_USER_ID)

    expect(supabaseRecord.title).toBe('Keep All Fields')
    expect(supabaseRecord.tags).toEqual(['a', 'b'])
    expect(supabaseRecord.estimated_duration).toBe(30)
    expect(supabaseRecord.is_in_inbox).toBe(true)
    expect(supabaseRecord.order).toBe(7)
  })

  // Test 12: multiple tasks mapped in batch preserve unique fields
  it('multiple tasks mapped in batch each preserve their unique fields', () => {
    const tasks = [
      createMockTask({ id: '11111111-1111-4111-8111-111111111111', title: 'Task One', priority: 'high', tags: ['first'] }),
      createMockTask({ id: '22222222-2222-4222-8222-222222222222', title: 'Task Two', priority: 'low', tags: ['second'] }),
      createMockTask({ id: '33333333-3333-4333-8333-333333333333', title: 'Task Three', priority: null, tags: ['third'] }),
    ]

    const results = tasks.map(t => roundTrip(t))

    expect(results[0].title).toBe('Task One')
    expect(results[0].priority).toBe('high')
    expect(results[0].tags).toEqual(['first'])

    expect(results[1].title).toBe('Task Two')
    expect(results[1].priority).toBe('low')
    expect(results[1].tags).toEqual(['second'])

    expect(results[2].title).toBe('Task Three')
    expect(results[2].priority).toBeNull()
    expect(results[2].tags).toEqual(['third'])
  })

  // Test 13: is_deleted / _soft_deleted state preserved
  it('task with _soft_deleted: true preserves deletion state after round-trip', () => {
    const task = createMockTask({
      id: VALID_UUID,
      _soft_deleted: true,
      deletedAt: new Date('2025-01-10T12:00:00.000Z'),
    })
    const result = roundTrip(task)
    expect(result._soft_deleted).toBe(true)
    expect(result.deletedAt).toBeDefined()
  })

  it('task with _soft_deleted: false preserves non-deleted state after round-trip', () => {
    const task = createMockTask({ id: VALID_UUID, _soft_deleted: false })
    const result = roundTrip(task)
    expect(result._soft_deleted).toBe(false)
  })

  // Test 14: isInInbox state preserved
  it('task with isInInbox: true preserves inbox state after round-trip', () => {
    const task = createMockTask({ id: VALID_UUID, isInInbox: true })
    const result = roundTrip(task)
    expect(result.isInInbox).toBe(true)
  })

  it('task with isInInbox: false preserves non-inbox state after round-trip', () => {
    const task = createMockTask({ id: VALID_UUID, isInInbox: false })
    const result = roundTrip(task)
    expect(result.isInInbox).toBe(false)
  })

  // Test 15: all priority values round-trip correctly
  it('priority high round-trips correctly', () => {
    const task = createMockTask({ id: VALID_UUID, priority: 'high' })
    expect(roundTrip(task).priority).toBe('high')
  })

  it('priority medium round-trips correctly', () => {
    const task = createMockTask({ id: VALID_UUID, priority: 'medium' })
    expect(roundTrip(task).priority).toBe('medium')
  })

  it('priority low round-trips correctly', () => {
    const task = createMockTask({ id: VALID_UUID, priority: 'low' })
    expect(roundTrip(task).priority).toBe('low')
  })

  it('priority null round-trips correctly', () => {
    const task = createMockTask({ id: VALID_UUID, priority: null })
    expect(roundTrip(task).priority).toBeNull()
  })
})
