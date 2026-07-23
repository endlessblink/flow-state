export function retainVisibleSelection(
  selectedIds: readonly string[],
  visibleIds: readonly string[]
): string[] {
  const visible = new Set(visibleIds)
  const retained = new Set<string>()

  for (const id of selectedIds) {
    if (visible.has(id)) retained.add(id)
  }

  return [...retained]
}

export function collectVisibleTaskIds<T extends { id: string; parentId?: string | null }>(
  tasks: readonly T[],
  rootIds: readonly string[],
  expandedTaskIds: ReadonlySet<string>,
): string[] {
  const childrenByParent = new Map<string, T[]>()
  for (const task of tasks) {
    if (!task.parentId) continue
    const siblings = childrenByParent.get(task.parentId) ?? []
    siblings.push(task)
    childrenByParent.set(task.parentId, siblings)
  }

  const visibleIds: string[] = []
  const visit = (taskId: string) => {
    visibleIds.push(taskId)
    if (!expandedTaskIds.has(taskId)) return
    for (const child of childrenByParent.get(taskId) ?? []) {
      visit(child.id)
    }
  }

  rootIds.forEach(visit)
  return visibleIds
}
