import { describe, expect, it } from 'vitest'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import {
  applyPendingGroupPatch,
  applyPendingTaskPatch,
  GROUP_PATCH_FIELDS,
  TASK_PATCH_FIELDS,
} from '@/services/offline/pendingWritePatch'

const taskPatchSamples: Record<string, unknown> = {
  title: 'Renamed from queue',
  description: 'Updated description',
  status: 'done',
  priority: 'high',
  project_id: '00000000-0000-4000-8000-000000000101',
  parent_task_id: '00000000-0000-4000-8000-000000000102',
  lane_id: '00000000-0000-4000-8000-000000000103',
  completed_pomodoros: 3,
  estimated_pomodoros: 5,
  progress: 50,
  due_date: '2026-06-16',
  due_time: '10:30',
  estimated_duration: 45,
  subtasks: [],
  tags: ['focus'],
  depends_on: ['00000000-0000-4000-8000-000000000104'],
  scheduled_date: '2026-06-17',
  scheduled_time: '11:00',
  is_uncategorized: true,
  instances: [],
  connection_types: { '00000000-0000-4000-8000-000000000105': 'reference' },
  recurrence: null,
  recurrence_rule: { pattern: 'daily', interval: 1, endType: 'never' },
  recurrence_parent_id: '00000000-0000-4000-8000-000000000106',
  recurrence_count: 2,
  recurring_instances: [],
  notification_prefs: null,
  reminders: [],
  attachments: [],
  planning_notes: [],
  mini_canvas_edges: [],
  is_in_inbox: true,
  order: 12,
  column_id: 'column-1',
  created_at: '2026-06-01T08:00:00.000Z',
  updated_at: '2026-06-01T09:00:00.000Z',
  completed_at: '2026-06-01T10:00:00.000Z',
  is_deleted: false,
  deleted_at: null,
  done_for_now_until: '2026-06-02T08:00:00.000Z',
  is_completion_record: false,
  is_pinned: true,
  calendar_locked: true,
  workspace_id: '00000000-0000-4000-8000-000000000107',
}

const groupPatchSamples: Record<string, unknown> = {
  name: 'Renamed group',
  type: 'custom',
  color: '#ff00aa',
  layout: 'grid',
  is_visible: false,
  is_collapsed: true,
  collapsed_height: 88,
  parent_group_id: 'parent-group',
  linked_parent_task_id: 'linked-task',
  filters_json: { statuses: ['todo'] },
  is_power_mode: true,
  power_keyword_json: { kind: 'today' },
  assign_on_drop_json: { status: 'done' },
  collect_filter_json: { matchStatus: 'todo' },
  auto_collect: true,
  is_pinned: true,
  property_value: 'high',
  updated_at: '2026-06-01T09:00:00.000Z',
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-patch-invariant',
    title: 'Stable task',
    description: 'Original description',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '2026-06-01',
    projectId: 'project-1',
    createdAt: new Date('2026-06-01T08:00:00.000Z'),
    updatedAt: new Date('2026-06-01T08:00:00.000Z'),
    canvasPosition: { x: 310, y: 420 },
    parentId: 'stable-canvas-group',
    positionFormat: 'absolute',
    positionVersion: 7,
    ...overrides,
  }
}

function makeGroup(overrides: Partial<CanvasGroup> = {}): CanvasGroup {
  return {
    id: 'group-patch-invariant',
    name: 'Stable group',
    type: 'custom',
    position: { x: 500, y: 600, width: 700, height: 800 },
    color: '#4ECDC4',
    layout: 'vertical',
    isVisible: true,
    isCollapsed: false,
    parentGroupId: 'stable-parent-group',
    linkedParentTaskId: 'stable-linked-task',
    positionFormat: 'absolute',
    positionVersion: 9,
    ...overrides,
  }
}

const taskGeometry = (task: Task) => ({
  canvasPosition: task.canvasPosition,
  parentId: task.parentId,
  positionFormat: task.positionFormat,
  positionVersion: task.positionVersion,
})

const groupGeometry = (group: CanvasGroup) => ({
  position: group.position,
  positionVersion: group.positionVersion,
})

const groupTopology = (group: CanvasGroup) => ({
  parentGroupId: group.parentGroupId,
  linkedParentTaskId: group.linkedParentTaskId,
})

describe('pending write patch invariants', () => {
  it.each(TASK_PATCH_FIELDS.map(([dbKey]) => [String(dbKey), taskPatchSamples[String(dbKey)]]))(
    'task patch field %s cannot mutate canvas geometry/topology/version',
    (dbKey, sampleValue) => {
      const task = makeTask()
      const patched = applyPendingTaskPatch(task, { [dbKey]: sampleValue })

      expect(taskGeometry(patched)).toEqual(taskGeometry(task))
    }
  )

  it('task patch only mutates geometry when the position payload is present', () => {
    const task = makeTask()
    const patched = applyPendingTaskPatch(task, {
      position: { x: 111, y: 222, parentId: 'new-canvas-group', format: 'absolute' },
      position_version: 8,
    })

    expect(taskGeometry(patched)).toEqual({
      canvasPosition: { x: 111, y: 222 },
      parentId: 'new-canvas-group',
      positionFormat: 'absolute',
      positionVersion: 8,
    })
  })

  it('task patch ignores unknown geometry-shaped keys', () => {
    const task = makeTask()
    const patched = applyPendingTaskPatch(task, {
      canvasPosition: null,
      parentId: undefined,
      positionVersion: 0,
    })

    expect(taskGeometry(patched)).toEqual(taskGeometry(task))
  })

  it.each(
    GROUP_PATCH_FIELDS
      .filter(([dbKey]) => dbKey !== 'parent_group_id' && dbKey !== 'linked_parent_task_id')
      .map(([dbKey]) => [String(dbKey), groupPatchSamples[String(dbKey)]])
  )('group patch field %s cannot mutate geometry/topology/version', (dbKey, sampleValue) => {
    const group = makeGroup()
    const patched = applyPendingGroupPatch(group, { [dbKey]: sampleValue })

    expect(groupGeometry(patched)).toEqual(groupGeometry(group))
    expect(groupTopology(patched)).toEqual(groupTopology(group))
  })

  it.each([
    ['parent_group_id', 'new-parent-group'],
    ['linked_parent_task_id', 'new-linked-task'],
  ])('group topology patch field %s cannot mutate geometry/version', (dbKey, sampleValue) => {
    const group = makeGroup()
    const patched = applyPendingGroupPatch(group, { [dbKey]: sampleValue })

    expect(groupGeometry(patched)).toEqual(groupGeometry(group))
  })

  it('group patch only mutates geometry when the position_json payload is present', () => {
    const group = makeGroup()
    const patched = applyPendingGroupPatch(group, {
      position_json: { x: 10, y: 20, width: 300, height: 400 },
      position_version: 10,
    })

    expect(groupGeometry(patched)).toEqual({
      position: { x: 10, y: 20, width: 300, height: 400 },
      positionVersion: 10,
    })
  })

  it('group patch ignores unknown geometry-shaped keys', () => {
    const group = makeGroup()
    const patched = applyPendingGroupPatch(group, {
      position: undefined,
      positionVersion: 0,
    })

    expect(groupGeometry(patched)).toEqual(groupGeometry(group))
    expect(groupTopology(patched)).toEqual(groupTopology(group))
  })
})
