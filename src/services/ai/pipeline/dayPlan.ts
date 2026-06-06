import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import { CANVAS } from '@/constants/canvas'
import { findMatchingGroupForDueDate } from '@/composables/canvas/useSmartGroupMatcher'
import { formatDateKey } from '@/utils/dateUtils'

type PlanTask = { id: string; [key: string]: unknown }

export interface DayPlanGroup {
  name: string
  tasks: PlanTask[]
}

export interface DayPlanUpdateResult {
  taskUpdates: Array<{ id: string; updates: Partial<Task> }>
  targetGroupName: string | null
  plannedCount: number
}

export function isOverwhelmedDayPlanRequest(message: string): boolean {
  const q = message.toLowerCase()
  return [
    'overwhelmed',
    'overloaded',
    'too much',
    'reorder my day',
    'i have too much',
    'אני מוצף',
    'אני מוצפת',
    'עמוס',
    'עמוסה',
    'יותר מדי',
    'תסדר לי את היום',
    'סדר לי את היום',
  ].some(trigger => q.includes(trigger))
}

export function flattenDayPlanTaskIds(groups: DayPlanGroup[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const group of groups) {
    for (const task of group.tasks) {
      if (!task?.id || seen.has(task.id)) continue
      seen.add(task.id)
      ids.push(task.id)
    }
  }
  return ids
}

function planStackPosition(group: CanvasGroup, index: number): { x: number; y: number } {
  const groupX = group.position?.x ?? 0
  const groupY = group.position?.y ?? 0
  const groupWidth = group.position?.width ?? CANVAS.DEFAULT_GROUP_WIDTH
  const taskWidth = CANVAS.DEFAULT_TASK_WIDTH
  const taskHeight = CANVAS.DEFAULT_TASK_HEIGHT
  const padding = 20
  const headerHeight = 50
  const gap = 10
  const x = Math.max(
    groupX + padding,
    Math.min(groupX + padding, groupX + groupWidth - taskWidth - padding),
  )
  return { x, y: groupY + headerHeight + padding + index * (taskHeight + gap) }
}

export function buildDayPlanTaskUpdates(
  groups: DayPlanGroup[],
  allTasks: Task[],
  allGroups: CanvasGroup[],
  today = formatDateKey(new Date()),
): DayPlanUpdateResult {
  const plannedIds = flattenDayPlanTaskIds(groups)
  const plannedIdSet = new Set(plannedIds)
  const tasksById = new Map(allTasks.map(task => [task.id, task]))
  const plannedTasks = plannedIds
    .map(id => tasksById.get(id))
    .filter((task): task is Task => !!task && task.status !== 'done')

  if (plannedTasks.length === 0) {
    return { taskUpdates: [], targetGroupName: null, plannedCount: 0 }
  }

  const targetGroup = findMatchingGroupForDueDate(today, allGroups)
  if (!targetGroup?.position) {
    return {
      taskUpdates: plannedTasks.map(task => ({ id: task.id, updates: { dueDate: today } })),
      targetGroupName: null,
      plannedCount: plannedTasks.length,
    }
  }

  const existingInTarget = allTasks
    .filter(task =>
      task.id &&
      !plannedIdSet.has(task.id) &&
      task.status !== 'done' &&
      task.parentId === targetGroup.id &&
      !!task.canvasPosition,
    )
    .sort((a, b) => {
      const ay = a.canvasPosition?.y ?? 0
      const by = b.canvasPosition?.y ?? 0
      if (ay !== by) return ay - by
      return (a.canvasPosition?.x ?? 0) - (b.canvasPosition?.x ?? 0)
    })

  const ordered = [...plannedTasks, ...existingInTarget]
  return {
    targetGroupName: targetGroup.name,
    plannedCount: plannedTasks.length,
    taskUpdates: ordered.map((task, index) => {
      const base: Partial<Task> = {
        parentId: targetGroup.id,
        canvasPosition: planStackPosition(targetGroup, index),
        positionFormat: 'absolute',
        isInInbox: false,
        canvasDismissed: false,
      }
      if (plannedIdSet.has(task.id)) base.dueDate = today
      return { id: task.id, updates: base }
    }),
  }
}
