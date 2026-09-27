import type { Task } from '@/types/tasks'

type Position = { x: number; y: number }

function taskPosition(task: Task, positions?: Map<string, Position>): Position | undefined {
  return positions?.get(task.id) ?? task.canvasPosition
}

/**
 * Synced sequence section for a task: its Canvas day/group rank (reading
 * order, Today first) and label. Registered by the Canvas store so every view
 * that uses the shared order follows the Canvas sequence (BUG-2106).
 */
export interface SharedOrderSection {
  rank: number
  key: string
  label: string
}

type SharedOrderSectionResolver = (task: Task) => SharedOrderSection | undefined
let sharedOrderSectionResolver: SharedOrderSectionResolver | null = null

export function setSharedOrderSectionResolver(resolver: SharedOrderSectionResolver | null): void {
  sharedOrderSectionResolver = resolver
}

export function getSharedOrderSection(task: Task): SharedOrderSection | undefined {
  return sharedOrderSectionResolver?.(task)
}

/** Compare tasks using the order shared by Board and Canvas. */
export function compareTasksBySharedOrder(
  first: Task,
  second: Task,
  positions?: Map<string, Position>,
): number {
  if (sharedOrderSectionResolver) {
    const firstRank = sharedOrderSectionResolver(first)?.rank ?? Number.POSITIVE_INFINITY
    const secondRank = sharedOrderSectionResolver(second)?.rank ?? Number.POSITIVE_INFINITY
    if (firstRank !== secondRank) return firstRank < secondRank ? -1 : 1
  }

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

/** Replace only the visible slots in shared manual order, leaving filtered-out tasks in place. */
export function mergeVisibleTaskOrder(
  tasks: Task[],
  orderedVisibleIds: string[],
  visibleIds: Set<string>,
): Task[] {
  const ordered = sortTasksBySharedOrder(tasks)
  const byId = new Map(ordered.map(task => [task.id, task]))
  const replacements = orderedVisibleIds.map(id => byId.get(id)).filter((task): task is Task => !!task)
  let replacementIndex = 0

  return ordered.map((task, order) => ({
    ...(visibleIds.has(task.id) && replacements[replacementIndex]
      ? replacements[replacementIndex++]
      : task),
    order,
  }))
}

/**
 * Order writes for a visible-list reorder, touching only tasks whose order
 * actually changes. Within each synced section (Canvas day group), the
 * visible tasks keep their existing order values as slots, so hidden tasks
 * and other days never move. Legacy rows with missing/duplicate orders fall
 * back to a full renumber.
 */
export function visibleReorderUpdates(
  tasks: Task[],
  orderedVisibleIds: string[],
  visibleIds: Set<string>,
): Array<{ id: string; order: number }> {
  const byId = new Map(tasks.map(task => [task.id, task]))
  const requested = orderedVisibleIds.filter(id => visibleIds.has(id) && byId.has(id))
  const sectionKey = (task: Task) => getSharedOrderSection(task)?.key ?? '__all__'

  const requestedBySection = new Map<string, string[]>()
  for (const id of requested) {
    const key = sectionKey(byId.get(id)!)
    requestedBySection.set(key, [...(requestedBySection.get(key) ?? []), id])
  }

  const updates: Array<{ id: string; order: number }> = []
  let slotsUsable = requested.length === tasks.filter(task => visibleIds.has(task.id)).length
  for (const [, ids] of requestedBySection) {
    if (!slotsUsable) break
    const slots = sortTasksBySharedOrder(ids.map(id => byId.get(id)!)).map(task => task.order)
    const increasing = slots.every((value, index) =>
      typeof value === 'number' && Number.isFinite(value) && (index === 0 || value > (slots[index - 1] as number)))
    if (!increasing) { slotsUsable = false; break }
    ids.forEach((id, index) => {
      const order = slots[index] as number
      if (byId.get(id)!.order !== order) updates.push({ id, order })
    })
  }
  if (slotsUsable) return updates

  const original = new Map(tasks.map(task => [task.id, task.order]))
  return mergeVisibleTaskOrder(tasks, orderedVisibleIds, visibleIds)
    .filter(task => original.get(task.id) !== task.order)
    .map(task => ({ id: task.id, order: task.order as number }))
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
