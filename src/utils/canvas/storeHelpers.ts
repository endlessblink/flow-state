import { type Task } from '@/types/tasks'
import { type CanvasGroup, type ContainerBounds } from '@/types/canvas'
import { assertNoDuplicateIds } from '@/utils/canvas/invariants'
import { getGroupAbsolutePosition } from '@/utils/canvas/coordinates'
import { isNodeCompletelyInside } from '@/utils/canvas/spatialContainment'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'

/**
 * DIAGNOSTIC HELPER: Log group ID histogram to detect duplicates (AUTHORITATIVE)
 */
export const logGroupIdHistogram = (label: string, groups: CanvasGroup[]) => {
    if (!import.meta.env.DEV) return

    const checkResult = assertNoDuplicateIds(groups, label)

    if (checkResult.hasDuplicates) {
        console.error('[GROUP-ID-HISTOGRAM] DUPLICATES', label, {
            duplicates: checkResult.duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
            totalCount: checkResult.totalCount,
            uniqueIdCount: checkResult.uniqueIdCount
        })
    } else if (groups.length > 0) {
        console.debug('[GROUP-ID-HISTOGRAM]', label, {
            uniqueIdCount: checkResult.uniqueIdCount,
            totalCount: checkResult.totalCount
        })
    }
}

/**
 * CYCLE & INVALID PARENT CLEANUP: Break cycles and clear invalid parentGroupId references
 *
 * This function runs on load to fix data integrity issues:
 * 1. Breaks parent cycles (A → B → A)
 * 2. Clears references to non-existent groups
 * 3. Clears references to task IDs (groups can only have group parents)
 */
export function breakGroupCycles(groups: CanvasGroup[]): CanvasGroup[] {
    console.log('[GROUPS] breakGroupCycles called with', groups.length, 'groups')

    const byId = new Map(groups.map(g => [g.id, g]))
    const validGroupIds = new Set(groups.map(g => g.id))
    let cyclesBroken = 0
    let invalidParentsCleared = 0

    for (const g of groups) {
        if (!g.parentGroupId || g.parentGroupId === 'NONE') continue

        // CHECK 1: Parent must be a valid group ID (not a task ID, not non-existent)
        if (!validGroupIds.has(g.parentGroupId)) {
            console.warn('[GROUPS] Clearing invalid parentGroupId (not a valid group)', {
                groupId: g.id,
                groupName: g.name,
                invalidParentGroupId: g.parentGroupId,
            })
            g.parentGroupId = null
            invalidParentsCleared++
            continue
        }

        // CHECK 2: No cycles
        const visited = new Set<string>()
        let current: CanvasGroup | undefined = g
        let hasCycle = false

        while (current && current.parentGroupId && current.parentGroupId !== 'NONE') {
            if (visited.has(current.id)) {
                hasCycle = true
                break
            }
            visited.add(current.id)
            current = byId.get(current.parentGroupId)
        }

        if (current && visited.has(current.id)) {
            hasCycle = true
        }

        if (hasCycle) {
            console.warn('[GROUPS] Breaking cycle by clearing parentGroupId', {
                groupId: g.id,
                groupName: g.name,
                oldParentGroupId: g.parentGroupId,
            })
            g.parentGroupId = null
            cyclesBroken++
        }
    }

    if (cyclesBroken > 0 || invalidParentsCleared > 0) {
        console.log(`[GROUPS] Fixed ${cyclesBroken} cycle(s), ${invalidParentsCleared} invalid parent(s)`)
    }

    return groups
}

/**
 * EMERGENCY FIX: Reset all groups to root level (clears all parentGroupId)
 *
 * Use this when groups are incorrectly moving together due to corrupted parent relationships.
 * This makes all groups independent (root level) so they move independently.
 */
export function resetAllGroupsToRoot(groups: CanvasGroup[]): CanvasGroup[] {
    let clearedCount = 0

    for (const g of groups) {
        if (g.parentGroupId && g.parentGroupId !== 'NONE') {
            console.log('[GROUPS] Resetting to root:', {
                groupId: g.id,
                groupName: g.name,
                wasParent: g.parentGroupId,
            })
            g.parentGroupId = null
            clearedCount++
        }
    }

    if (clearedCount > 0) {
        console.log(`[GROUPS] Reset ${clearedCount} group(s) to root level`)
    }

    return groups
}

/**
 * Helper: Normalize Smart Group names and colors
 */
export const applySmartGroupNormalizations = (group: Omit<CanvasGroup, 'id'> | Partial<CanvasGroup>) => {
    if (!group.name) return

    const nameLower = group.name.toLowerCase().trim()

    if (nameLower === 'overdue') {
        group.name = 'Overdue'
        group.color = '#ef4444'
        return
    }

    const powerInfo = detectPowerKeyword(group.name)
    if (powerInfo) {
        group.name = powerInfo.displayName

        if (!group.color || group.color === '#6366f1') {
            switch (powerInfo.category) {
                case 'priority':
                    if (powerInfo.value === 'high') group.color = '#ef4444'
                    else if (powerInfo.value === 'medium') group.color = '#f59e0b'
                    else if (powerInfo.value === 'low') group.color = '#3b82f6'
                    break
                case 'status':
                    if (powerInfo.value === 'done') group.color = '#10b981'
                    else if (powerInfo.value === 'in_progress') group.color = '#f59e0b'
                    break
                case 'date':
                    group.color = '#8b5cf6'
                    break
            }
        }
    }
}

/**
 * Visual Containment Count - counts tasks that are VISUALLY inside the group bounds
 */
export const getTaskCountInGroupRecursive = (groupId: string, groups: CanvasGroup[], tasks: Task[], visited = new Set<string>()): number => {
    if (visited.has(groupId)) {
        console.warn(`🔄[CANVAS] Cycle detected in group hierarchy at ${groupId}`)
        return 0
    }
    visited.add(groupId)

    const group = groups.find(g => g.id === groupId)
    if (!group) return 0

    const groupAbsolutePos = getGroupAbsolutePosition(groupId, groups)

    const containerBounds: ContainerBounds = {
        position: groupAbsolutePos,
        width: group.position.width,
        height: group.position.height
    }

    let count = tasks.filter(t => {
        if (!t.canvasPosition || t._soft_deleted) return false
        const taskNode = { position: t.canvasPosition }
        return isNodeCompletelyInside(taskNode, containerBounds)
    }).length

    const childGroups = groups.filter(g => g.parentGroupId === groupId)
    for (const child of childGroups) {
        count += getTaskCountInGroupRecursive(child.id, groups, tasks, visited)
    }

    return count
}

/**
 * Get all descendant group IDs for a given root group (depth-first)
 */
export const getAllDescendantGroupIds = (rootGroupId: string, groups: CanvasGroup[]): string[] => {
    const result: string[] = [rootGroupId]
    const visited = new Set<string>([rootGroupId])

    const collectDescendants = (parentId: string) => {
        const children = groups.filter(g => g.parentGroupId === parentId)
        for (const child of children) {
            if (!visited.has(child.id)) {
                visited.add(child.id)
                result.push(child.id)
                collectDescendants(child.id)
            }
        }
    }

    collectDescendants(rootGroupId)
    return result
}
