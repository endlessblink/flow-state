import { nextTick } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useCanvasCore } from './useCanvasCore'
import { CanvasIds } from '@/utils/canvas/canvasIds'

/**
 * useCanvasGroups
 *
 * Consolidates all group-related logic:
 * - Task counting (Single Source of Truth: parentId)
 * - Containment checks (using Vue Flow computed positions)
 * - Group Actions (Create, Delete, Update)
 * - Hierarchy management
 */
export function useCanvasGroups() {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const { getNodes } = useCanvasCore()

    // --- Helpers ---

    const isPointInRect = (x: number, y: number, rect: { x: number, y: number, width: number, height: number }) => {
        return x >= rect.x && x <= rect.x + rect.width &&
            y >= rect.y && y <= rect.y + rect.height
    }

    // --- Containment Logic ---

    // Find the deep-most section that contains the center of a task
    const findSectionForTask = (taskCenter: { x: number, y: number }, excludeId?: string): CanvasSection | null => {
        const sections = getNodes.value.filter(n => CanvasIds.isGroupNode(n.id) && !n.hidden)

        const validContainers = sections.filter(node => {
            const { id: sectionId } = CanvasIds.parseNodeId(node.id)
            if (sectionId === excludeId) return false

            // Use computed position (absolute) from Vue Flow
            const absX = node.computedPosition?.x ?? node.position.x
            const absY = node.computedPosition?.y ?? node.position.y
            const width = node.data?.width ?? 300
            const height = node.data?.height ?? 200

            return isPointInRect(taskCenter.x, taskCenter.y, {
                x: absX,
                y: absY,
                width,
                height
            })
        })

        if (validContainers.length === 0) return null

        // Sort by area (ascending: smallest first) - we want the most specific (deepest) group
        return validContainers.sort((a, b) => {
            const areaA = (a.data?.width ?? 300) * (a.data?.height ?? 200)
            const areaB = (b.data?.width ?? 300) * (b.data?.height ?? 200)
            return areaA - areaB
        }).map(n => {
            const { id } = CanvasIds.parseNodeId(n.id)
            return canvasStore.groups.find(g => g.id === id)!
        }).filter(Boolean)[0] || null
    }

    // Used during drag to find where a task is hovering
    const getContainingGroupForTask = (x: number, y: number, w: number = 220, h: number = 100) => {
        const centerX = x + w / 2
        const centerY = y + h / 2
        return findSectionForTask({ x: centerX, y: centerY })
    }

    const findAllContainingSections = (_nodeRect: { x: number, y: number, width: number, height: number }) => {
        // Implementation for group-in-group drag could go here if needed.
        // For now, focusing on Task->Group drop.
        return []
    }

    const getSectionAbsolutePosition = (sectionId: string) => {
        const node = getNodes.value.find(n => n.id === CanvasIds.groupNodeId(sectionId))
        return node?.computedPosition || { x: 0, y: 0 }
    }

    // --- Task Counting Logic ---

    // Optimized Recursive Count (CYCLE-SAFE)
    // Relies STRICTLY on parentId relationship, avoiding expensive spatial checks for counting.
    // Uses visited set to prevent infinite recursion if cycles exist in data.
    // FIX: Uses _rawGroups to include hidden groups in hierarchy traversal
    const getTaskCountInGroupRecursive = (
        groupId: string,
        tasks: Task[],
        visited: Set<string> = new Set()
    ): number => {
        // Cycle protection: don't revisit groups we've already counted
        if (visited.has(groupId)) {
            console.warn('[GROUPS] Detected cycle while counting tasks', { groupId })
            return 0
        }
        visited.add(groupId)

        // 1. Direct Children
        let count = tasks.filter(t => t.parentId === groupId && !t._soft_deleted).length

        // 2. Recursive Children (in subgroups)
        // FIX: Use _rawGroups instead of canvasStore.groups to include hidden groups
        // canvasStore.groups is filtered to visible only, which breaks hierarchy traversal
        const allGroups = canvasStore._rawGroups
        const childGroups = allGroups.filter(g => g.parentGroupId === groupId)
        for (const child of childGroups) {
            count += getTaskCountInGroupRecursive(child.id, tasks, visited)
        }

        return count
    }

    // Update a single section's task count node data
    // FIX: Update BOTH directTaskCount and aggregatedTaskCount (not just taskCount)
    // GroupNodeSimple.vue reads directTaskCount/aggregatedTaskCount from props.data
    const updateSingleSectionCount = (sectionId: string, _tasks: Task[]) => {
        const sectionNodeId = CanvasIds.groupNodeId(sectionId)

        // Read from store's reactive computeds (source of truth)
        const directCount = canvasStore.taskCountByGroupId.get(sectionId) ?? 0
        const aggregatedCount = canvasStore.aggregatedTaskCountByGroupId.get(sectionId) ?? directCount

        // Direct reactivity update on Vue Flow node data
        const node = getNodes.value.find(n => n.id === sectionNodeId)
        if (node && node.data) {
            const oldDirect = node.data.directTaskCount
            const oldAggregated = node.data.aggregatedTaskCount

            // Update ALL count properties to ensure UI consistency
            node.data.directTaskCount = directCount
            node.data.aggregatedTaskCount = aggregatedCount
            node.data.taskCount = aggregatedCount // Legacy compat

            // Log when counts actually change for debugging
            if (oldDirect !== directCount || oldAggregated !== aggregatedCount) {
                console.log(`📊 [COUNT-UPDATE] ${sectionId.slice(0, 8)}: direct ${oldDirect}→${directCount}, aggregated ${oldAggregated}→${aggregatedCount}`)
            }
        }
    }

    // Helper to get ancestor chain for bubbling updates
    // FIX: Uses _rawGroups to include hidden groups in hierarchy traversal
    const getAncestorGroupIds = (groupId: string, visited = new Set<string>()): string[] => {
        if (visited.has(groupId)) return []
        visited.add(groupId)

        const allGroups = canvasStore._rawGroups
        const group = allGroups.find(g => g.id === groupId)
        if (!group || !group.parentGroupId) return []

        const ancestors: string[] = [group.parentGroupId]
        ancestors.push(...getAncestorGroupIds(group.parentGroupId, visited))
        return ancestors
    }

    // Main entry point for updating counts
    const updateSectionTaskCounts = async (oldSectionId?: string, newSectionId?: string) => {
        // Ensure store is fresh
        await nextTick()

        const tasks = taskStore.tasks.filter(t => !t._soft_deleted)
        const sectionsToUpdate = new Set<string>()

        if (oldSectionId) {
            sectionsToUpdate.add(oldSectionId)
            getAncestorGroupIds(oldSectionId).forEach(id => sectionsToUpdate.add(id))
        }

        if (newSectionId) {
            sectionsToUpdate.add(newSectionId)
            getAncestorGroupIds(newSectionId).forEach(id => sectionsToUpdate.add(id))
        }

        sectionsToUpdate.forEach(sectionId => {
            updateSingleSectionCount(sectionId, tasks)
        })
    }

    return {
        // Counting
        getTaskCountInGroupRecursive,
        updateSectionTaskCounts,
        updateSingleSectionCount,
        getAncestorGroupIds,

        // Containment / Hierarchy
        getContainingGroupForTask,
        getSectionAbsolutePosition,
        findAllContainingSections
    }
}
