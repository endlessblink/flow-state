import { ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useVueFlow } from '@vue-flow/core'
import {
    sanitizePosition,
    groupPositionToVueFlow,
    taskPositionToVueFlow
} from '@/utils/canvas/coordinates'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import type { CanvasGroup } from '@/stores/canvas/types'
import { validateAllInvariants, logHierarchySummary } from '@/utils/canvas/invariants'

// =============================================================================
// MODULE-LEVEL HELPERS (defined before composable to ensure availability)
// =============================================================================

/**
 * Interface for groups that can be sorted by hierarchy
 */
interface HierarchicalGroup {
    id: string
    parentGroupId?: string | null
}

/**
 * Sort groups by hierarchy depth (parents before children)
 * Ensures Vue Flow can resolve parentNode references correctly.
 *
 * Uses topological sort: root groups (no parent) first, then their children, etc.
 * This guarantees that when a child group is added, its parent already exists.
 *
 * @param groups - Array of groups with id and optional parentGroupId
 * @returns Sorted array with root groups first, then depth 1, depth 2, etc.
 */
function sortGroupsByHierarchy<T extends HierarchicalGroup>(groups: T[]): T[] {
    // Helper to get depth (0 = root, 1 = direct child of root, etc.)
    const getDepth = (groupId: string, visited: Set<string> = new Set()): number => {
        const group = groups.find(g => g.id === groupId)
        if (!group) return 0
        if (!group.parentGroupId || group.parentGroupId === 'NONE') return 0
        if (visited.has(groupId)) return 0 // Cycle protection

        visited.add(groupId)
        return 1 + getDepth(group.parentGroupId, visited)
    }

    // Calculate depth for each group and sort by depth (ascending)
    const groupsWithDepth = groups.map(g => ({
        group: g,
        depth: getDepth(g.id)
    }))

    // Sort by depth: root groups (depth 0) first, then children (depth 1), etc.
    groupsWithDepth.sort((a, b) => a.depth - b.depth)

    return groupsWithDepth.map(gwd => gwd.group)
}

// =============================================================================
// COMPOSABLE
// =============================================================================

/**
 * Canvas Sync Composable
 *
 * ============================================================================
 * READ PATH: DB/Store → Vue Flow
 * ============================================================================
 *
 * This composable handles the READ PATH of the Fully Absolute Architecture:
 * - Reads absolute positions from store (which mirrors DB)
 * - Converts to relative positions for nested nodes (Vue Flow requirement)
 * - Creates Vue Flow nodes with correct position and parentNode
 *
 * KEY PRINCIPLE:
 * - DB/Store stores ABSOLUTE world coordinates for ALL nodes
 * - Vue Flow displays nested nodes with RELATIVE positions
 * - Conversion happens HERE using groupPositionToVueFlow/taskPositionToVueFlow
 */
export function useCanvasSync() {
    const canvasStore = useCanvasStore()
    const { nodeVersionMap, aggregatedTaskCountByGroupId, taskCountByGroupId } = storeToRefs(canvasStore)
    const taskStore = useTaskStore()
    const { getNodes, setNodes, addNodes, removeNodes } = useVueFlow()

    const isSyncing = ref(false)

    /**
     * Helper to detect if assigning a parent would create a cycle
     * Traces up the parent chain to ensure we don't point back to ourselves
     */
    const hasParentCycle = (nodeId: string, potentialParentId: string | null, groups: any[]): boolean => {
        if (!potentialParentId) return false
        if (nodeId === potentialParentId) return true // Self-reference

        let currentId = potentialParentId
        const visited = new Set<string>()

        // Safety Break: max depth
        let depth = 0
        const MAX_DEPTH = 50

        while (currentId && currentId !== 'NONE' && depth < MAX_DEPTH) {
            if (currentId === nodeId) return true // Cycle detected!
            if (visited.has(currentId)) return true // Circular chain found upstream

            visited.add(currentId)

            const parentGroup = groups.find(g => g.id === currentId)
            if (!parentGroup) break // End of known chain

            currentId = parentGroup.parentGroupId
            depth++
        }

        return false
    }

    /**
     * Sync store data to canvas nodes
     *
     * READ PATH FLOW:
     * 1. Read groups/tasks from store (absolute positions)
     * 2. For each item, compute Vue Flow position:
     *    - Root items: use absolute directly
     *    - Nested items: convert absolute → relative using parent's absolute
     * 3. Create Vue Flow nodes with correct position and parentNode
     *
     * BUG #3 FIX: Always use fresh store positions instead of preserving
     * stale Vue Flow positions. This ensures cross-tab sync works correctly.
     */
    const syncStoreToCanvas = (tasks?: Task[]) => {
        if (isSyncing.value) return
        isSyncing.value = true

        try {
            const tasksToSync = tasks || taskStore.tasks.filter(t => t.canvasPosition)
            const groups = canvasStore.groups || []
            const currentNodes = getNodes.value

            // BUG #3 FIX: Removed existingPositions preservation
            // Previously we preserved existing Vue Flow positions to "avoid visual jumps",
            // but this caused stale positions to win over fresh store data on cross-tab sync.
            // Now we ALWAYS use the fresh position from the store (source of truth).

            const newNodes: any[] = []

            // ================================================================
            // PROCESS GROUPS
            // ================================================================
            // CRITICAL: Sort groups so that parent groups are processed before children.
            // Vue Flow needs parent nodes to exist before children reference them via parentNode.
            // This ensures correct parent-child relationships on initial render after reload.
            const sortedGroups = sortGroupsByHierarchy(groups)

            // Create a Set of visible group IDs for fast lookup
            const visibleGroupIds = new Set(groups.map(g => g.id))

            for (const group of sortedGroups) {
                const nodeId = CanvasIds.groupNodeId(group.id)

                // FULLY ABSOLUTE ARCHITECTURE:
                // group.position in store is ABSOLUTE (world coordinates)
                // Convert to Vue Flow position (relative for nested, absolute for root)
                // BUG #3 FIX: Always use fresh vueFlowPos from store
                const vueFlowPos = groupPositionToVueFlow(group, groups)
                const displayPos = sanitizePosition(vueFlowPos, { x: 100, y: 100 })

                // Determine parent node for Vue Flow
                let parentId = group.parentGroupId && group.parentGroupId !== 'NONE'
                    ? group.parentGroupId
                    : null

                // SAFETY: Cycle Detection
                if (parentId && hasParentCycle(group.id, parentId, groups)) {
                    console.error(`🔄 [CYCLE DETECTED] Creating group ${group.id} would create cycle with parent ${parentId}. Breaking link.`)
                    parentId = null
                }

                // FIX: Only set parentNode if parent is VISIBLE (will be rendered in Vue Flow)
                // If parent exists but is hidden, treat as root node to avoid "Only child nodes can use a parent extent" warning
                if (parentId && !visibleGroupIds.has(parentId)) {
                    console.warn(`[SYNC] Parent group ${parentId} is hidden, treating ${group.id} as root node`)
                    parentId = null
                }

                // Get BOTH direct and aggregated task counts
                // Direct = tasks where task.parentId === group.id (only this group)
                // Aggregated = direct + all tasks in descendant groups
                const directTaskCount = taskCountByGroupId.value.get(group.id) ?? 0
                const aggregatedTaskCount = aggregatedTaskCountByGroupId.value.get(group.id) ?? directTaskCount

                newNodes.push({
                    id: nodeId,
                    type: 'sectionNode',
                    position: displayPos,
                    parentNode: parentId ? CanvasIds.groupNodeId(parentId) : undefined,
                    // FIX: Removed extent: 'parent' for groups so they can be dragged OUT of parent.
                    // With extent: 'parent', Vue Flow constrains movement to parent bounds,
                    // preventing child groups from being dragged outside to become root groups.
                    // Without it, groups can be freely dragged, and onNodeDragStop handles
                    // re-parenting via spatial containment (same pattern as tasks).
                    expandParent: false,
                    data: {
                        id: group.id,
                        label: group.name || 'Group',
                        name: group.name || 'Group',
                        color: group.color || '#3b82f6',
                        width: group.position?.width || 300,
                        height: group.position?.height || 200,
                        collapsed: group.isCollapsed || false,
                        // Pass BOTH counts - component decides which to show
                        directTaskCount,
                        aggregatedTaskCount,
                        // Pass STORE's parentGroupId (not Vue Flow's parentId) so component
                        // correctly determines if it's a root or child group for count logic
                        parentGroupId: group.parentGroupId,
                        // Legacy: keep taskCount for backwards compat (use aggregated)
                        taskCount: aggregatedTaskCount
                    },
                    style: {
                        width: `${group.position?.width || 300}px`,
                        height: `${group.position?.height || 200}px`
                    }
                })
            }

            // ================================================================
            // PROCESS TASKS
            // ================================================================
            // Initialize task position versions in nodeVersionMap for optimistic locking
            // This ensures syncNodePosition has version info when saving positions

            // Defensive: ensure nodeVersionMap.value is a valid Map
            if (!nodeVersionMap.value || !(nodeVersionMap.value instanceof Map)) {
                nodeVersionMap.value = new Map()
            }
            const versionMap = nodeVersionMap.value

            for (const task of tasksToSync) {
                if (!task.canvasPosition) continue

                // Initialize version if not already tracked
                if (!versionMap.has(task.id)) {
                    versionMap.set(task.id, task.positionVersion ?? 0)
                }

                const nodeId = task.id

                // FULLY ABSOLUTE ARCHITECTURE:
                // task.canvasPosition in store is ABSOLUTE (world coordinates)
                // Convert to Vue Flow position (relative for nested, absolute for root)
                // BUG #3 FIX: Always use fresh vueFlowPos from store
                const vueFlowPos = taskPositionToVueFlow(task, groups)
                if (!vueFlowPos) continue

                const displayPos = sanitizePosition(vueFlowPos, { x: 200, y: 200 })

                // Determine parent node for Vue Flow
                let parentId = task.parentId && task.parentId !== 'NONE'
                    ? task.parentId
                    : null

                // SAFETY: Cycle Detection
                if (parentId && hasParentCycle(task.id, parentId, groups)) {
                    console.error(`🔄 [CYCLE DETECTED] Creating task ${task.id} would create cycle with parent ${parentId}. Breaking link.`)
                    parentId = null
                }

                // FIX: Only set parentNode if parent group is VISIBLE (will be rendered in Vue Flow)
                // If parent group is hidden, treat task as root node
                if (parentId && !visibleGroupIds.has(parentId)) {
                    parentId = null
                }

                newNodes.push({
                    id: nodeId,
                    type: 'taskNode',
                    position: displayPos,
                    parentNode: parentId ? CanvasIds.groupNodeId(parentId) : undefined,
                    // FIX: Removed extent: 'parent' so tasks can be dragged OUT of groups.
                    // With extent: 'parent', Vue Flow constrains movement to parent bounds,
                    // preventing tasks from being dragged outside. Without it, tasks can be
                    // freely dragged, and onNodeDragStop handles re-parenting via spatial containment.
                    expandParent: false,
                    data: {
                        task,
                        label: task.title
                    }
                })
            }

            // ================================================================
            // IDEMPOTENCE CHECK
            // ================================================================
            // Prevent recursive updates if generated nodes match existing nodes
            // We compare essential properties: id, position, parentNode, data (height/width)
            const isDifferent = (a: any[], b: any[]) => {
                if (a.length !== b.length) return true
                // Create a map for faster lookup
                const bMap = new Map(b.map((n: any) => [n.id, n]))

                for (const nodeA of a) {
                    const nodeB = bMap.get(nodeA.id)
                    if (!nodeB) return true

                    // Check Position
                    if (Math.abs(nodeA.position.x - nodeB.position.x) > 0.1 ||
                        Math.abs(nodeA.position.y - nodeB.position.y) > 0.1) return true

                    // Check Parent
                    if (nodeA.parentNode !== nodeB.parentNode) return true

                    // Check Dimensions (for groups)
                    if (nodeA.data?.width !== nodeB.data?.width ||
                        nodeA.data?.height !== nodeB.data?.height) return true
                }

                return false
            }

            if (isDifferent(newNodes, currentNodes)) {
                setNodes(newNodes)

                // ================================================================
                // INVARIANT VALIDATION (Dev Only)
                // ================================================================
                // Run invariant checks after sync to catch any violations early
                // This helps identify bugs before they cause visual issues
                if (import.meta.env.DEV) {
                    // Use nextTick to ensure Vue Flow has processed the nodes
                    nextTick(() => {
                        const vueFlowNodes = getNodes.value
                        const storeGroups = canvasStore._rawGroups || []
                        const storeTasks = taskStore.tasks || []

                        validateAllInvariants(
                            vueFlowNodes,
                            storeGroups,
                            storeTasks,
                            'syncStoreToCanvas'
                        )

                        // ================================================================
                        // CHILD→ROOT INVARIANT CHECK
                        // ================================================================
                        // Verify: If a group has no parentGroupId in store,
                        // its Vue Flow node must NOT have parentNode set.
                        // This catches bugs where detach logic fails to clear parentNode.
                        const nodeMap = new Map(vueFlowNodes.map(n => [n.id, n]))
                        for (const group of storeGroups) {
                            const nodeId = CanvasIds.groupNodeId(group.id)
                            const node = nodeMap.get(nodeId)
                            const hasStoreParent = group.parentGroupId && group.parentGroupId !== 'NONE'

                            if (!hasStoreParent && node?.parentNode) {
                                console.error('[INVARIANT A-child-root] Group has no parentGroupId but node.parentNode is set', {
                                    groupId: group.id,
                                    groupName: group.name,
                                    storeParentGroupId: group.parentGroupId,
                                    nodeParentNode: node.parentNode,
                                })
                            }
                        }
                    })
                }
            }
        } finally {
            isSyncing.value = false
        }
    }

    /**
     * Initialize realtime subscription for store changes
     * Note: Watchers are handled by useCanvasOrchestrator to avoid duplicate triggers
     */
    const initRealtimeSubscription = () => {
        // No-op: Orchestrator handles watching to avoid infinite loops
        // The orchestrator calls syncStoreToCanvas directly when stores change
    }

    return {
        syncStoreToCanvas,
        initRealtimeSubscription,
        isSyncing
    }
}
