import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import {
  fromSupabaseGroup,
  fromSupabaseTask,
  type SupabaseGroup,
  type SupabaseTask,
} from '@/utils/supabaseMappers'

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const TASK_PATCH_FIELDS: Array<[keyof SupabaseTask, keyof Task]> = [
  ['title', 'title'],
  ['description', 'description'],
  ['status', 'status'],
  ['priority', 'priority'],
  ['project_id', 'projectId'],
  ['parent_task_id', 'parentTaskId'],
  ['lane_id', 'laneId'],
  ['completed_pomodoros', 'completedPomodoros'],
  ['estimated_pomodoros', 'estimatedPomodoros'],
  ['progress', 'progress'],
  ['due_date', 'dueDate'],
  ['due_time', 'dueTime'],
  ['estimated_duration', 'estimatedDuration'],
  ['subtasks', 'subtasks'],
  ['tags', 'tags'],
  ['depends_on', 'dependsOn'],
  ['scheduled_date', 'scheduledDate'],
  ['scheduled_time', 'scheduledTime'],
  ['is_uncategorized', 'isUncategorized'],
  ['instances', 'instances'],
  ['connection_types', 'connectionTypes'],
  ['recurrence', 'recurrence'],
  ['recurrence_rule', 'recurrenceRule'],
  ['recurrence_parent_id', 'recurrenceParentId'],
  ['recurrence_count', 'recurrenceCount'],
  ['recurring_instances', 'recurringInstances'],
  ['notification_prefs', 'notificationPreferences'],
  ['reminders', 'reminders'],
  ['attachments', 'attachments'],
  ['planning_notes', 'planningNotes'],
  ['mini_canvas_edges', 'miniCanvasEdges'],
  ['is_in_inbox', 'isInInbox'],
  ['order', 'order'],
  ['column_id', 'columnId'],
  ['created_at', 'createdAt'],
  ['updated_at', 'updatedAt'],
  ['completed_at', 'completedAt'],
  ['is_deleted', '_soft_deleted'],
  ['deleted_at', 'deletedAt'],
  ['done_for_now_until', 'doneForNowUntil'],
  ['is_completion_record', 'isCompletionRecord'],
  ['is_pinned', 'isPinned'],
  ['calendar_locked', 'calendarLocked'],
  ['workspace_id', 'workspaceId'],
]

const GROUP_PATCH_FIELDS: Array<[keyof SupabaseGroup, keyof CanvasGroup]> = [
  ['name', 'name'],
  ['type', 'type'],
  ['color', 'color'],
  ['layout', 'layout'],
  ['is_visible', 'isVisible'],
  ['is_collapsed', 'isCollapsed'],
  ['collapsed_height', 'collapsedHeight'],
  ['parent_group_id', 'parentGroupId'],
  ['linked_parent_task_id', 'linkedParentTaskId'],
  ['filters_json', 'filters'],
  ['is_power_mode', 'isPowerMode'],
  ['power_keyword_json', 'powerKeyword'],
  ['assign_on_drop_json', 'assignOnDrop'],
  ['collect_filter_json', 'collectFilter'],
  ['auto_collect', 'autoCollect'],
  ['is_pinned', 'isPinned'],
  ['property_value', 'propertyValue'],
  ['updated_at', 'updatedAt'],
]

export function applyPendingTaskPatch(existing: Task, payload: Record<string, unknown>): Task {
  const mapped = fromSupabaseTask({ ...payload, id: existing.id } as unknown as SupabaseTask)
  const patch: Partial<Task> = {}
  const writablePatch = patch as Record<string, unknown>

  for (const [dbKey, appKey] of TASK_PATCH_FIELDS) {
    if (hasOwn(payload, dbKey)) {
      writablePatch[appKey] = mapped[appKey]
    }
  }

  if (hasOwn(payload, 'position')) {
    patch.canvasPosition = mapped.canvasPosition
    patch.parentId = mapped.parentId
    patch.positionFormat = mapped.positionFormat
  }
  if (hasOwn(payload, 'position_version')) {
    patch.positionVersion = mapped.positionVersion
  }

  return { ...existing, ...patch }
}

export function applyPendingGroupPatch(existing: CanvasGroup, payload: Record<string, unknown>): CanvasGroup {
  const mapped = fromSupabaseGroup({ ...payload, id: existing.id } as unknown as SupabaseGroup)
  const patch: Partial<CanvasGroup> = {}
  const writablePatch = patch as Record<string, unknown>

  for (const [dbKey, appKey] of GROUP_PATCH_FIELDS) {
    if (hasOwn(payload, dbKey)) {
      writablePatch[appKey] = mapped[appKey]
    }
  }

  if (hasOwn(payload, 'position_json')) {
    patch.position = mapped.position
  }
  if (hasOwn(payload, 'position_version')) {
    patch.positionVersion = mapped.positionVersion
  }

  return { ...existing, ...patch }
}
