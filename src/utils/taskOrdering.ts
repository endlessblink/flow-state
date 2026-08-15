import type { Task } from '@/types/tasks'

type Position = { x: number; y: number }

function taskPosition(task: Task, positions?: Map<string, Position>): Position | undefined {
  return positions?.get(task.id) ?? task.canvasPosition
}

/** Compare tasks using the order shared by Board and Canvas. */
export function compareTasksBySharedOrder(
  first: Task,
  second: Task,
  positions?: Map<string, Position>,
): number {
  const firstOrder = typeof first.order === 'number' && Number.isFinite(first.order) ? first.order : null
  const secondOrder = typeof second.order === 'number' && Number.isFinite(second.order) ? second.order : null

  if (firstOrder !== null || secondOrder !== null) {
    if (firstOrder === null) return 1
    if (secondOrder === null) return -1
    if (firstOrder !== secondOrder) return firstOrder - secondOrder
  }

  // Existing data can contain equal/default orders. Canvas row-major position
  // is the shared deterministic tie-breaker for those legacy rows.
  const firstPosition = taskPosition(first, positions)
  const secondPosition = taskPosition(second, positions)
  if (firstPosition && !secondPosition) return -1
  if (!firstPosition && secondPosition) return 1
  if (firstPosition && secondPosition) {
    if (firstPosition.y !== secondPosition.y) return firstPosition.y - secondPosition.y
    if (firstPosition.x !== secondPosition.x) return firstPosition.x - secondPosition.x
  }

  const firstCreated = Date.parse(String(first.createdAt ?? '')) || 0
  const secondCreated = Date.parse(String(second.createdAt ?? '')) || 0
  if (firstCreated !== secondCreated) return firstCreated - secondCreated
  return first.id.localeCompare(second.id)
}

export function sortTasksBySharedOrder(tasks: Task[], positions?: Map<string, Position>): Task[] {
  return [...tasks].sort((first, second) => compareTasksBySharedOrder(first, second, positions))
}

export function orderTasksByCanvasPosition(tasks: Task[], positions?: Map<string, Position>): Task[] {
  return [...tasks].sort((first, second) => {
    const firstPosition = taskPosition(first, positions)
    const secondPosition = taskPosition(second, positions)
    if (!firstPosition && !secondPosition) return compareTasksBySharedOrder(first, second)
    if (!firstPosition) return 1
    if (!secondPosition) return -1
    if (firstPosition.y !== secondPosition.y) return firstPosition.y - secondPosition.y
    if (firstPosition.x !== secondPosition.x) return firstPosition.x - secondPosition.x
    return compareTasksBySharedOrder(first, second)
  })
}

export function getNextTaskOrder(tasks: Task[], status: Task['status']): number {
  const orders = tasks
    .filter((task) => task.status === status && Number.isFinite(task.order))
    .map((task) => task.order ?? 0)
  return orders.length > 0 ? Math.max(...orders) + 1 : tasks.filter((task) => task.status === status).length
}
