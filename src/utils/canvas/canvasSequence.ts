import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'
import type { SharedOrderSection } from '@/utils/taskOrdering'

/**
 * BUG-2106: the synced task sequence follows Canvas reading order — top-level
 * groups left-to-right (then top-to-bottom), with smart Today membership
 * projected into the Today group. Tasks outside any group sort after all
 * groups. Within a section the shared `order` decides (see taskOrdering).
 */
export function buildCanvasSequenceSections(
  groups: CanvasGroup[],
  tasks: Task[],
  todayTaskIds: Set<string>,
  todayGroupId?: string,
): Map<string, SharedOrderSection> {
  const visible = groups.filter(group => group.isVisible !== false)
  const byId = new Map(visible.map(group => [group.id, group]))
  const rootOf = (group: CanvasGroup): CanvasGroup => {
    const seen = new Set<string>()
    let current = group
    while (current.parentGroupId && byId.has(current.parentGroupId) && !seen.has(current.id)) {
      seen.add(current.id)
      current = byId.get(current.parentGroupId)!
    }
    return current
  }
  const roots = [...new Set(visible.map(rootOf))]
    .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0) || (a.position?.y ?? 0) - (b.position?.y ?? 0))
  const rootRank = new Map(roots.map((group, index) => [group.id, index]))

  const sections = new Map<string, SharedOrderSection>()
  for (const task of tasks) {
    const groupId = todayGroupId && todayTaskIds.has(task.id) ? todayGroupId : task.parentId
    const group = groupId ? byId.get(groupId) : undefined
    if (!group) continue
    const root = rootOf(group)
    const rank = rootRank.get(root.id)
    if (rank === undefined) continue
    sections.set(task.id, { rank, key: root.id, label: root.name })
  }
  return sections
}
