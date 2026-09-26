import type { Task } from '@/types/tasks'
import { compareTaskSortField } from '@/utils/taskSort'
import { mergeVisibleTaskOrder, sortTasksBySharedOrder } from '@/utils/taskOrdering'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskSortStore } from '@/stores/taskSort'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { getUndoSystem } from '@/composables/undoSingleton'
import { planTaskShuffleCanvasGeometry } from '@/composables/canvas/planTaskShuffleCanvasGeometry'

export type TaskShuffleMode = 'priority' | 'duration'

export interface ShuffleCanvasGeometry {
  taskPositions: Map<string, { x: number; y: number }>
  groupPositions: Map<string, { x: number; y: number; width: number; height: number }>
}

function isActiveTask(task: Task): boolean {
  return task.status !== 'done' && !task._soft_deleted && !task.isCompletionRecord
}

/** A one-time ranking; equal fields retain the current shared manual sequence. */
export function sortTasksForShuffle(tasks: Task[], mode: TaskShuffleMode): Task[] {
  const existing = sortTasksBySharedOrder(tasks)
  const key = mode === 'priority' ? 'priority' : 'estimatedTime'
  return existing.sort((first, second) =>
    compareTaskSortField(first, second, { key, direction: 'asc' })
  )
}

/** Fill only active slots, preserving completed tasks in the shared sequence. */
export function planTaskShuffleOrders(tasks: Task[], mode: TaskShuffleMode): Task[] {
  const available = tasks.filter(task => !task._soft_deleted && !task.isCompletionRecord)
  const active = available.filter(isActiveTask)
  return mergeVisibleTaskOrder(
    available,
    sortTasksForShuffle(active, mode).map(task => task.id),
    new Set(active.map(task => task.id)),
  )
}

function samePosition(
  before: { x: number; y: number; width?: number; height?: number } | undefined,
  after: { x: number; y: number; width?: number; height?: number },
): boolean {
  return !!before && before.x === after.x && before.y === after.y
    && before.width === after.width && before.height === after.height
}

function showManualOrder() {
  const sortStore = useTaskSortStore()
  sortStore.mainSortKey = 'manual'
  sortStore.mainSortDirection = 'asc'
  usePersistentRef<'manual' | 'priority_desc'>('flowstate:board-sort-option', 'manual').value = 'manual'
  for (const context of ['canvas', 'calendar', 'standalone']) {
    usePersistentRef<string>(`flowstate:inbox-secondary-sort-${context}`, 'none').value = 'none'
  }
  usePersistentRef<string>('flowstate:calendar-inbox-secondary-sort', 'none').value = 'none'
}

/** Persist the global shuffle and optional Canvas restack as one undo operation. */
export async function runTaskShuffle(mode: TaskShuffleMode, geometry?: ShuffleCanvasGeometry): Promise<boolean> {
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()
  const current = taskStore.rawTasks
  const groups = canvasStore._rawGroups ?? canvasStore.groups
  const planned = planTaskShuffleOrders(current, mode)
  const canvasGeometry = geometry ?? planTaskShuffleCanvasGeometry(
    groups,
    planned,
    // The Board has no mounted Canvas cards to measure. Reserve enough space
    // for long cards, including description and checklist content.
    () => ({ width: 280, height: 360 }),
  )
  const byId = new Map(current.map(task => [task.id, task]))
  const taskChanges = planned.flatMap(task => {
    const previous = byId.get(task.id)
    if (!previous) return []
    const updates: Partial<Task> = {}
    if (previous.order !== task.order) updates.order = task.order
    const position = canvasGeometry.taskPositions.get(task.id)
    if (position && !samePosition(previous.canvasPosition, position)) {
      updates.canvasPosition = position
      updates.positionFormat = 'absolute'
    }
    if (!Object.keys(updates).length) return []
    const previousValues = Object.fromEntries(
      Object.keys(updates).map(key => [key, previous[key as keyof Task]])
    ) as Partial<Task>
    if (previousValues.canvasPosition) {
      previousValues.canvasPosition = { ...previousValues.canvasPosition }
    }
    return [{ id: task.id, updates, previousValues }]
  })
  const groupChanges = [...canvasGeometry.groupPositions].flatMap(([id, position]) => {
    const previous = groups.find(group => group.id === id)
    return previous && !samePosition(previous.position, position)
      ? [{ id, position, previousPosition: { ...previous.position } }]
      : []
  })

  const affectedIds = [...taskChanges.map(change => change.id), ...groupChanges.map(change => change.id)]
  if (affectedIds.length) {
    await getUndoSystem().canvasGeometryWithUndo(
      `Shuffle tasks by ${mode}`,
      affectedIds,
      async () => {
        const appliedTasks: typeof taskChanges = []
        const appliedGroups: typeof groupChanges = []
        try {
          for (const change of taskChanges) {
            appliedTasks.push(change)
            await taskStore.updateTask(change.id, change.updates, 'USER', { throwOnPersistenceFailure: true })
          }
          for (const change of groupChanges) {
            appliedGroups.push(change)
            await canvasStore.updateGroup(change.id, { position: change.position })
          }
        } catch (error) {
          const rollbackErrors: unknown[] = []
          for (const change of appliedGroups.reverse()) {
            try { await canvasStore.updateGroup(change.id, { position: change.previousPosition }) }
            catch (rollbackError) { rollbackErrors.push(rollbackError) }
          }
          for (const change of appliedTasks.reverse()) {
            try {
              await taskStore.updateTask(change.id, change.previousValues, 'USER', { throwOnPersistenceFailure: true })
            } catch (rollbackError) { rollbackErrors.push(rollbackError) }
          }
          if (rollbackErrors.length) {
            const failure = new Error('Task shuffle failed and could not be fully rolled back')
            Object.assign(failure, { cause: error, rollbackErrors })
            throw failure
          }
          throw error
        }
      },
    )
  }
  showManualOrder()
  return affectedIds.length > 0
}
