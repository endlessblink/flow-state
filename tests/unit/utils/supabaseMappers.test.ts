/**
 * Regression tests for src/utils/supabaseMappers.ts
 *
 * These mappers convert between camelCase app models and snake_case DB columns.
 * Past bugs caused by mapper issues:
 * - BUG-1211: _soft_deleted instead of is_deleted → permanent data loss
 * - BUG-1562: Bypassed toSupabaseTask → wrong column names
 * - BUG-1286: Timezone artifact on date-only strings
 * - BUG-1533c: Raw localTask sent to Supabase → PGRST204 errors
 */

import { describe, it, expect } from 'vitest'
import {
  toSupabaseTask, fromSupabaseTask,
  toSupabaseGroup, fromSupabaseGroup,
  toSupabaseProject, fromSupabaseProject,
  toSupabaseLane, fromSupabaseLane,
  toSupabaseTimerSession, fromSupabaseTimerSession,
  toDbStatus,
} from '@/utils/supabaseMappers'
import type { Task, Project, Lane } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'
import type { PomodoroSession } from '@/stores/timer'
import { UNCATEGORIZED_PROJECT_ID } from '@/types/tasks'

// ── Helpers ──────────────────────────────────────────────────────────

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Task',
    description: 'A description',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 2,
    estimatedPomodoros: 4,
    subtasks: [],
    dueDate: '2026-04-15',
    projectId: '660e8400-e29b-41d4-a716-446655440001',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T12:00:00Z'),
    ...overrides,
  }
}

function makeGroup(overrides: Partial<CanvasGroup> = {}): CanvasGroup {
  return {
    id: '770e8400-e29b-41d4-a716-446655440002',
    name: 'Test Group',
    type: 'manual',
    color: '#ff0000',
    position: { x: 100, y: 200, width: 400, height: 300 },
    layout: 'vertical',
    isVisible: true,
    isCollapsed: false,
    ...overrides,
  } as CanvasGroup
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: '880e8400-e29b-41d4-a716-446655440003',
    name: 'Test Project',
    color: '#00ff00',
    colorType: 'hex',
    viewType: 'status',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T12:00:00Z'),
    ...overrides,
  }
}

// ── toDbStatus ───────────────────────────────────────────────────────

describe('toDbStatus', () => {
  it('maps "todo" to "planned"', () => {
    expect(toDbStatus('todo')).toBe('planned')
  })

  it('maps "done" to "done"', () => {
    expect(toDbStatus('done')).toBe('done')
  })

  it('maps unknown status to "planned" as fallback', () => {
    expect(toDbStatus('in_progress')).toBe('planned')
    expect(toDbStatus('backlog')).toBe('planned')
    expect(toDbStatus('')).toBe('planned')
  })
})

// ── Task Mappers ─────────────────────────────────────────────────────

describe('toSupabaseTask / fromSupabaseTask', () => {
  it('BUG-1211 regression: _soft_deleted maps to is_deleted, never _soft_deleted column', () => {
    const task = makeTask({ _soft_deleted: true })
    const result = toSupabaseTask(task, USER_ID)

    expect(result.is_deleted).toBe(true)
    expect(result).not.toHaveProperty('_soft_deleted')
  })

  it('round-trip preserves core fields', () => {
    const task = makeTask()
    const supabase = toSupabaseTask(task, USER_ID)
    const roundTrip = fromSupabaseTask(supabase)

    expect(roundTrip.id).toBe(task.id)
    expect(roundTrip.title).toBe(task.title)
    expect(roundTrip.description).toBe(task.description)
    expect(roundTrip.priority).toBe(task.priority)
    expect(roundTrip.completedPomodoros).toBe(task.completedPomodoros)
    expect(roundTrip.estimatedPomodoros).toBe(task.estimatedPomodoros)
  })

  it('maps the canonical task revision from the authoritative row', () => {
    const supabase = toSupabaseTask(makeTask(), USER_ID)

    expect(fromSupabaseTask({ ...supabase, canonical_revision: 17 }).canonicalRevision).toBe(17)
  })

  it('TASK-1785 Push 2: calendarLocked round-trips via calendar_locked', () => {
    const locked = toSupabaseTask(makeTask({ calendarLocked: true }), USER_ID)
    expect(locked.calendar_locked).toBe(true)
    expect(fromSupabaseTask(locked).calendarLocked).toBe(true)

    const unlocked = toSupabaseTask(makeTask({ calendarLocked: false }), USER_ID)
    expect(unlocked.calendar_locked).toBe(false)
    expect(fromSupabaseTask(unlocked).calendarLocked).toBe(false)

    // Undefined input defaults to false on the way to the DB (column has DEFAULT false)
    const defaulted = toSupabaseTask(makeTask(), USER_ID)
    expect(defaulted.calendar_locked).toBe(false)
    // Missing DB column reads back as false
    expect(fromSupabaseTask({ ...defaulted, calendar_locked: undefined }).calendarLocked).toBe(false)
  })

  it('status mapping: todo → planned → todo', () => {
    const task = makeTask({ status: 'todo' })
    const supabase = toSupabaseTask(task, USER_ID)
    expect(supabase.status).toBe('planned')

    const roundTrip = fromSupabaseTask(supabase)
    expect(roundTrip.status).toBe('todo')
  })

  it('fromSupabaseTask maps legacy statuses to "todo"', () => {
    expect(fromSupabaseTask({ ...toSupabaseTask(makeTask(), USER_ID), status: 'planned' }).status).toBe('todo')
    expect(fromSupabaseTask({ ...toSupabaseTask(makeTask(), USER_ID), status: 'in_progress' }).status).toBe('todo')
    expect(fromSupabaseTask({ ...toSupabaseTask(makeTask(), USER_ID), status: 'backlog' }).status).toBe('todo')
    expect(fromSupabaseTask({ ...toSupabaseTask(makeTask(), USER_ID), status: 'on_hold' }).status).toBe('todo')
  })

  it('canvasPosition maps to position JSONB with correct structure', () => {
    const task = makeTask({
      canvasPosition: { x: 150, y: 250 },
      parentId: '990e8400-e29b-41d4-a716-446655440004',
    })
    const result = toSupabaseTask(task, USER_ID)

    expect(result.position).toEqual({
      x: 150,
      y: 250,
      parentId: '990e8400-e29b-41d4-a716-446655440004',
      format: 'absolute',
    })
  })

  it('position parentId allows legacy group IDs (non-UUID)', () => {
    const task = makeTask({
      canvasPosition: { x: 10, y: 20 },
      parentId: 'group-1768138473081-54fxz7t', // Legacy ID
    })
    const result = toSupabaseTask(task, USER_ID)

    // Legacy group IDs should NOT be stripped — position is JSONB, no UUID constraint
    expect(result.position?.parentId).toBe('group-1768138473081-54fxz7t')
  })

  it('position parentId strips placeholder values', () => {
    for (const placeholder of ['NONE', 'undefined', 'null', '']) {
      const task = makeTask({
        canvasPosition: { x: 10, y: 20 },
        parentId: placeholder,
      })
      const result = toSupabaseTask(task, USER_ID)
      expect(result.position?.parentId).toBeUndefined()
    }
  })

  it('position_version is NOT included in output (managed by DB triggers)', () => {
    const task = makeTask({ positionVersion: 42 })
    const result = toSupabaseTask(task, USER_ID)

    // position_version should not be set by the client
    expect(result.position_version).toBeUndefined()
  })

  it('BUG-1286: date-only dueDate preserved without timezone artifact', () => {
    const task = makeTask({ dueDate: '2026-04-15' })
    const result = toSupabaseTask(task, USER_ID)

    // Should be '2026-04-15', NOT '2026-04-15T00:00:00.000Z'
    expect(result.due_date).toBe('2026-04-15')
  })

  it('fromSupabaseTask strips time from ISO dueDate', () => {
    const supabase = toSupabaseTask(makeTask(), USER_ID)
    supabase.due_date = '2026-04-15T14:30:00.000Z'
    const result = fromSupabaseTask(supabase)

    expect(result.dueDate).toBe('2026-04-15')
  })

  it('sanitizeUUID rejects invalid project IDs', () => {
    const task = makeTask({ projectId: UNCATEGORIZED_PROJECT_ID })
    const result = toSupabaseTask(task, USER_ID)
    expect(result.project_id).toBeNull()

    const task2 = makeTask({ projectId: '1' })
    const result2 = toSupabaseTask(task2, USER_ID)
    expect(result2.project_id).toBeNull()
  })

  it('null/undefined fields do not crash', () => {
    const task = makeTask({
      dueDate: '',
      tags: undefined,
      dependsOn: undefined,
      subtasks: [],
      canvasPosition: undefined,
    })
    expect(() => toSupabaseTask(task, USER_ID)).not.toThrow()
  })

  it('workspaceId only included when truthy', () => {
    const noWorkspace = toSupabaseTask(makeTask({ workspaceId: null }), USER_ID)
    expect(noWorkspace).not.toHaveProperty('workspace_id')

    const withWorkspace = toSupabaseTask(makeTask({ workspaceId: 'ws-abc' }), USER_ID)
    expect(withWorkspace.workspace_id).toBe('ws-abc')
  })

  it('recurrenceRule is deep-cloned via JSON.parse(JSON.stringify)', () => {
    const rule = { frequency: 'daily' as const, interval: 1 }
    const task = makeTask({ recurrenceRule: rule as any })
    const result = toSupabaseTask(task, USER_ID)

    // Modify original — should not affect the output
    rule.interval = 999
    expect(result.recurrence_rule).toEqual({ frequency: 'daily', interval: 1 })
  })

  it('fromSupabaseTask maps is_deleted to _soft_deleted', () => {
    const supabase = toSupabaseTask(makeTask(), USER_ID)
    supabase.is_deleted = true
    const result = fromSupabaseTask(supabase)
    expect(result._soft_deleted).toBe(true)
  })

  it('fromSupabaseTask reads positionVersion from position_version', () => {
    const supabase = toSupabaseTask(makeTask(), USER_ID)
    ;(supabase as any).position_version = 7
    const result = fromSupabaseTask(supabase)
    expect(result.positionVersion).toBe(7)
  })

  it('fromSupabaseTask reads parentId from position JSONB', () => {
    const supabase = toSupabaseTask(makeTask(), USER_ID)
    supabase.position = { x: 10, y: 20, parentId: 'group-abc', format: 'absolute' }
    const result = fromSupabaseTask(supabase)
    expect(result.parentId).toBe('group-abc')
  })
})

// ── Group Mappers ────────────────────────────────────────────────────

describe('toSupabaseGroup / fromSupabaseGroup', () => {
  it('returns null for legacy non-UUID group IDs (BUG-1184)', () => {
    const group = makeGroup({ id: 'group-1768138473081-54fxz7t' })
    const result = toSupabaseGroup(group, USER_ID)
    expect(result).toBeNull()
  })

  it('position maps to position_json (correct DB column)', () => {
    const group = makeGroup()
    const result = toSupabaseGroup(group, USER_ID)!
    expect(result.position_json).toEqual(group.position)
    expect(result).not.toHaveProperty('position')
  })

  it('fromSupabaseGroup maps position_json back to position', () => {
    const group = makeGroup()
    const supabase = toSupabaseGroup(group, USER_ID)!
    const roundTrip = fromSupabaseGroup(supabase)
    expect(roundTrip.position).toEqual(group.position)
  })

  it('fromSupabaseGroup defaults positionFormat to "absolute"', () => {
    const supabase = toSupabaseGroup(makeGroup(), USER_ID)!
    const result = fromSupabaseGroup(supabase)
    expect(result.positionFormat).toBe('absolute')
  })

  it('parentGroupId is sanitized', () => {
    const group = makeGroup({ parentGroupId: 'not-a-uuid' } as any)
    const result = toSupabaseGroup(group, USER_ID)!
    expect(result.parent_group_id).toBeNull()
  })
})

// ── Project Mappers ──────────────────────────────────────────────────

describe('toSupabaseProject / fromSupabaseProject', () => {
  it('emoji color stores emoji in color field', () => {
    const project = makeProject({ colorType: 'emoji', emoji: '🔥', color: '' })
    const result = toSupabaseProject(project, USER_ID)
    expect(result.color).toBe('🔥')
    expect(result.color_type).toBe('emoji')
  })

  it('null name defaults to "Unnamed Project"', () => {
    const project = makeProject({ name: '' })
    const result = toSupabaseProject(project, USER_ID)
    expect(result.name).toBe('Unnamed Project')
  })

  it('round-trip preserves core fields', () => {
    const project = makeProject()
    const supabase = toSupabaseProject(project, USER_ID)
    const roundTrip = fromSupabaseProject(supabase)

    expect(roundTrip.id).toBe(project.id)
    expect(roundTrip.name).toBe(project.name)
    expect(roundTrip.color).toBe(project.color)
    expect(roundTrip.viewType).toBe(project.viewType)
  })
})

// ── Timer Session Mappers ────────────────────────────────────────────

describe('toSupabaseTimerSession / fromSupabaseTimerSession', () => {
  const makeTimerSession = (): PomodoroSession => ({
    id: 'aa0e8400-e29b-41d4-a716-446655440005',
    taskId: 'bb0e8400-e29b-41d4-a716-446655440006',
    startTime: new Date('2026-04-01T10:00:00Z'),
    duration: 1500,
    remainingTime: 900,
    isActive: true,
    isPaused: false,
    isBreak: false,
  })

  it('round-trip preserves session fields', () => {
    const session = makeTimerSession()
    const supabase = toSupabaseTimerSession(session, USER_ID, 'device-1')
    const roundTrip = fromSupabaseTimerSession(supabase)

    expect(roundTrip.taskId).toBe(session.taskId)
    expect(roundTrip.duration).toBe(session.duration)
    expect(roundTrip.remainingTime).toBe(session.remainingTime)
    expect(roundTrip.isActive).toBe(session.isActive)
    expect(roundTrip.isPaused).toBe(session.isPaused)
    expect(roundTrip.isBreak).toBe(session.isBreak)
  })

  it('includes device_leader_id and device_leader_last_seen', () => {
    const session = makeTimerSession()
    const result = toSupabaseTimerSession(session, USER_ID, 'device-42')
    expect(result.device_leader_id).toBe('device-42')
    expect(result.device_leader_last_seen).toBeDefined()
  })

  it('generates new UUID for truly invalid session IDs', () => {
    const session = makeTimerSession()
    session.id = 'not-valid-at-all!' // Invalid: neither UUID nor timestamp
    const result = toSupabaseTimerSession(session, USER_ID, 'device-1')
    // Should be replaced with a valid UUID
    expect(result.id).not.toBe('not-valid-at-all!')
    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
  })

  it('accepts timestamp IDs as valid (legacy support)', () => {
    const session = makeTimerSession()
    session.id = '1234567890123' // 13-digit timestamp — accepted by isValidUUID
    const result = toSupabaseTimerSession(session, USER_ID, 'device-1')
    // Timestamp IDs are considered valid (backwards compat)
    expect(result.id).toBe('1234567890123')
  })
})

// ── TASK-1812: Lanes ─────────────────────────────────────────────────

function makeLane(overrides: Partial<Lane> = {}): Lane {
  return {
    id: '990e8400-e29b-41d4-a716-446655440004',
    name: 'v2 Launch',
    color: '#4ECDC4',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T12:00:00Z'),
    ...overrides,
  }
}

describe('toSupabaseLane / fromSupabaseLane', () => {
  it('round-trips core fields', () => {
    const lane = makeLane()
    const supabase = toSupabaseLane(lane, USER_ID)
    expect(supabase.user_id).toBe(USER_ID)
    expect(supabase.name).toBe('v2 Launch')
    expect(supabase.color).toBe('#4ECDC4')
    const roundTrip = fromSupabaseLane(supabase)
    expect(roundTrip.id).toBe(lane.id)
    expect(roundTrip.name).toBe(lane.name)
    expect(roundTrip.color).toBe(lane.color)
  })

  it('defaults empty name to "Unnamed Lane"', () => {
    const supabase = toSupabaseLane(makeLane({ name: '' }), USER_ID)
    expect(supabase.name).toBe('Unnamed Lane')
  })

  it('fromSupabaseLane defaults missing color', () => {
    const lane = fromSupabaseLane({ id: 'x', user_id: USER_ID, name: 'L', color: undefined })
    expect(lane.color).toBe('#4ECDC4')
  })
})

describe('TASK-1812: task lane_id round-trip (realtime-echo safety)', () => {
  it('preserves laneId through toSupabaseTask → fromSupabaseTask', () => {
    const laneId = '990e8400-e29b-41d4-a716-446655440004'
    const supabase = toSupabaseTask(makeTask({ laneId }), USER_ID)
    expect(supabase.lane_id).toBe(laneId)
    // CRITICAL: realtime echo must NOT null out laneId
    expect(fromSupabaseTask(supabase).laneId).toBe(laneId)
  })

  it('clears laneId when explicitly null (unassign)', () => {
    const supabase = toSupabaseTask(makeTask({ laneId: null }), USER_ID)
    expect(supabase.lane_id).toBeNull()
    expect(fromSupabaseTask(supabase).laneId).toBeNull()
  })

  it('reads null laneId from a record with no lane_id column (pre-migration DB)', () => {
    const supabase = toSupabaseTask(makeTask(), USER_ID)
    expect(fromSupabaseTask({ ...supabase, lane_id: undefined }).laneId).toBeNull()
  })
})
