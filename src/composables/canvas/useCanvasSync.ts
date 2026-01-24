import { ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useVueFlow } from '@vue-flow/core'
import {
    sanitizePosition
} from '@/utils/canvas/coordinates'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { positionManager } from '@/services/canvas/PositionManager'
import { validateAllInvariants, assertNoDuplicateIds } from '@/utils/canvas/invariants'
import { CANVAS } from '@/constants/canvas'

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
function sortGroupsByHierarchy<T extends HierarchicalGroup>(groups: T[]): Array<T & { _depth: number }> {
    // Helper to get depth (0 = root, 1 = direct child of root, etc.)
    const getDepth = (groupId: string, visited: Set<string> = new Set()): number => {
        const group = groups.find(g => g.id === groupId)
        if (!group) return 0
        if (!group.parentGroupId || group.parentGroupId === 'NONE') return 0
        if (visited.has(groupId)) return 0 // Cycle protection

        visited.add(groupId)
        return 1 + getDepth(group.parentGroupId, visited)
    }

    // Calculate depth for each group
    const groupsWithDepth = groups.map(g => ({
        ...g,
        _depth: getDepth(g.id)
    }))

    // Sort by depth: root groups (depth 0) first, then children (depth 1), etc.
    groupsWithDepth.sort((a, b) => a._depth - b._depth)

    return groupsWithDepth
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
    const { getNodes, setNodes } = useVueFlow()

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
     * Sync store data to canvas nodes (READ PATH)
     *
     * =========================================================================
     * GEOMETRY WRITE POLICY (TASK-240 Phase 2.5)
     * =========================================================================
     * Sync is a READ-ONLY projection from store → Vue Flow display.
     *
     * This function MUST NEVER write to:
     *   - taskStore (task positions, parentId, any task data)
     *   - canvasStore.groups (group positions, parentGroupId, any group data)
     *
     * ALLOWED writes:
     *   - nodeVersionMap (optimistic locking metadata, not user data)
     *   - Vue Flow nodes via setNodes() (display layer, not persistence)
     *
     * RATIONALE:
     * Writing to stores from sync would create feedback loops:
     *   Store changes → sync runs → sync writes to store → sync runs → ...
     * This causes position drift and groups "merging back together".
     *
     * Only useCanvasInteractions.onNodeDragStop() may write geometry.
     * =========================================================================
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

            // TASK-213: POSITION MANAGER INTEGRATION
            // 1. Feed Store data into PositionManager via batchUpdate('remote-sync').
            //    This ensures that if legal (no lock), PositionManager is updated.
            //    If locked (user dragging), the update is ignored, preserving the drag.
            const updates = []

            // Collect Group Updates
            for (const g of groups) {
                if (g.position) {
                    updates.push({
                        id: g.id,
                        x: g.position.x,
                        y: g.position.y,
                        parentId: (!g.parentGroupId || g.parentGroupId === 'NONE') ? null : g.parentGroupId
                    })
                }
            }

            // Collect Task Updates
            for (const t of tasksToSync) {
                if (t.canvasPosition) {
                    updates.push({
                        id: t.id,
                        x: t.canvasPosition.x,
                        y: t.canvasPosition.y,
                        parentId: (!t.parentId || t.parentId === 'NONE') ? null : t.parentId
                    })
                }
            }

            // BUG-1047 DEBUG: Log sync positions before PM update
            const taskUpdates = updates.filter(u => !groups.some(g => g.id === u.id))
            if (taskUpdates.length > 0) {
                console.log('🔍 [BUG-1047] syncStoreToCanvas feeding to PM:', taskUpdates.slice(0, 3).map(u => ({
                    id: u.id.slice(0, 8),
                    x: Math.round(u.x),
                    y: Math.round(u.y)
                })))
            }

            // Commit updates (locks will prevent overwrites of dragged items)
            positionManager.batchUpdate(updates, 'remote-sync')

            const newNodes: any[] = []

            // ================================================================
            // PROCESS GROUPS
            // ================================================================
            // CRITICAL: Sort groups so that parent groups are processed before children.
            // Vue Flow needs parent nodes to exist before children reference them via parentNode.
            // This ensures correct parent-child relationships on initial render after reload.

            // === ASSERT: No duplicate group IDs before node creation (AUTHORITATIVE) ===
            // Uses assertNoDuplicateIds for consistent detection across layers
            if (import.meta.env.DEV) {
                const groupCheck = assertNoDuplicateIds(groups, 'groups input to syncStoreToCanvas')
                if (groupCheck.hasDuplicates) {
                    console.error('[ASSERT-FAILED] Duplicate groupIds in groups before node creation', {
                        duplicates: groupCheck.duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
                        totalCount: groupCheck.totalCount,
                        uniqueIdCount: groupCheck.uniqueIdCount
                    })
                }
            }

            const sortedGroups = sortGroupsByHierarchy(groups)

            // Create a Set of visible group IDs for fast lookup
            const visibleGroupIds = new Set(groups.map(g => g.id))

            for (const group of sortedGroups) {
                const nodeId = CanvasIds.groupNodeId(group.id)

                // TASK-213: Read from PositionManager (Authoritative Source)
                const pmNode = positionManager.getPosition(group.id)
                // If missing from PM (rare), fallback to store, but PM should have it from batchUpdate
                if (!pmNode) continue

                const absolutePos = pmNode.position
                let parentId = pmNode.parentId // Trust PM's parentId

                // Calculate Relative Position for Vue Flow
                let vueFlowPos = absolutePos
                // Only convert to relative if we have a valid, visible parent
                if (parentId && visibleGroupIds.has(parentId)) {
                    const relative = positionManager.getRelativePosition(group.id)
                    if (relative) vueFlowPos = relative
                }

                const displayPos = sanitizePosition(vueFlowPos, { x: 100, y: 100 })

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

                // Compute parentNode for hierarchy
                const parentNodeId = parentId ? CanvasIds.groupNodeId(parentId) : undefined

                // BUG-226 FIX: Apply depth-based zIndex bonus
                // ensures child groups (higher depth) are always on top of parent groups
                const depth = (group as any)._depth || 0
                const zIndex = 11 + (depth * 10) // Base group Z is 10 (CANVAS.Z_INDEX_GROUP)

                newNodes.push({
                    id: nodeId,
                    type: 'sectionNode',
                    position: displayPos,
                    parentNode: parentNodeId,
                    zIndex, // Explicit zIndex bonus
                    // FIX: Removed extent: 'parent' so groups can be dragged OUT of their parent.
                    // With extent: 'parent', Vue Flow constrains movement to parent bounds,
                    // preventing groups from being detached via drag. Without it, groups can be
                    // freely dragged, and onNodeDragStop handles re-parenting via spatial containment.
                    // (Same approach as tasks - see line ~284)
                    expandParent: false,
                    data: {
                        id: group.id,
                        label: group.name || 'Group',
                        name: group.name || 'Group',
                        color: group.color || '#3b82f6',
                        width: group.position?.width || CANVAS.DEFAULT_GROUP_WIDTH,
                        height: group.position?.height || CANVAS.DEFAULT_GROUP_HEIGHT,
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
                        width: `${group.position?.width || CANVAS.DEFAULT_GROUP_WIDTH}px`,
                        height: `${group.position?.height || CANVAS.DEFAULT_GROUP_HEIGHT}px`
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

                // TASK-213: Read from PositionManager (Authoritative Source)
                const pmNode = positionManager.getPosition(task.id)
                if (!pmNode) continue

                const absolutePos = pmNode.position

                // BUG-1047 DEBUG: Log PM position for first few tasks
                if (tasksToSync.indexOf(task) < 3) {
                    console.log('🔍 [BUG-1047] PM returning position for task:', {
                        id: task.id.slice(0, 8),
                        pmPosition: { x: Math.round(absolutePos.x), y: Math.round(absolutePos.y) },
                        storePosition: task.canvasPosition ? { x: Math.round(task.canvasPosition.x), y: Math.round(task.canvasPosition.y) } : null
                    })
                }
                let parentId = pmNode.parentId

                // Calculate Relative Position for Vue Flow
                let vueFlowPos = absolutePos
                // Only convert to relative if we have a valid, visible parent
                if (parentId && visibleGroupIds.has(parentId)) {
                    const relative = positionManager.getRelativePosition(task.id)
                    if (relative) vueFlowPos = relative
                }

                const displayPos = sanitizePosition(vueFlowPos, { x: 200, y: 200 })

                // Determine parent node for Vue Flow
                // DRIFT LOGGING: Track original parentId before any modifications
                const originalParentId = task.parentId

                // SAFETY: Cycle Detection
                if (parentId && hasParentCycle(task.id, parentId, groups)) {
                    console.error(`🔄 [CYCLE DETECTED] Creating task ${task.id} would create cycle with parent ${parentId}. Breaking link.`)
                    parentId = null
                }

                // FIX: Only set parentNode if parent group is VISIBLE (will be rendered in Vue Flow)
                // If parent group is hidden, treat task as root node

                if (parentId && !visibleGroupIds.has(parentId)) {
                    console.warn(`⚠️ [SYNC-PARENT-CLEARED] Task ${task.id.slice(0, 8)}... (${task.title?.slice(0, 20)}) parent ${parentId?.slice(0, 8)} is NOT visible - treating as root`, {
                        originalParentId,
                        visibleGroupCount: visibleGroupIds.size,
                        visibleGroupIds: Array.from(visibleGroupIds).map(id => id.slice(0, 8))
                    })
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
                        // BUG-FIX: Shallow clone task to break reference equality.
                        // Without this, idempotence check compares same object (old === new),
                        // causing sync to skip setNodes() even when task properties changed.
                        task: { ...task },
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

                    // Check Position - small threshold to detect intentional position changes
                    if (Math.abs(nodeA.position.x - nodeB.position.x) > 0.1 ||
                        Math.abs(nodeA.position.y - nodeB.position.y) > 0.1) return true

                    // Check Parent
                    if (nodeA.parentNode !== nodeB.parentNode) return true

                    // Check Dimensions (for groups)
                    if (nodeA.data?.width !== nodeB.data?.width ||
                        nodeA.data?.height !== nodeB.data?.height) return true

                    // TASK-DATA REACTION: Check critical task properties
                    // If these change, we MUST update the node even if position is same
                    if (nodeA.type === 'taskNode' && nodeB.type === 'taskNode') {
                        const taskA = nodeA.data?.task
                        const taskB = nodeB.data?.task

                        if (taskA && taskB) {
                            if (taskA.status !== taskB.status) return true
                            if (taskA.priority !== taskB.priority) return true
                            if (taskA.dueDate !== taskB.dueDate) return true
                            if (taskA.title !== taskB.title) return true
                        }
                    }

                    // GROUP-DATA REACTION: Check group labels/colors
                    if (nodeA.type === 'sectionNode' && nodeB.type === 'sectionNode') {
                        if (nodeA.data?.label !== nodeB.data?.label ||
                            nodeA.data?.color !== nodeB.data?.color ||
                            nodeA.data?.collapsed !== nodeB.data?.collapsed) return true
                    }
                }

                return false
            }

            if (isDifferent(newNodes, currentNodes)) {
                // DRIFT LOGGING: Track when nodes change parent status
                const taskNodesOld = currentNodes.filter(n => n.type === 'taskNode')
                const taskNodesNew = newNodes.filter((n: any) => n.type === 'taskNode')

                for (const newNode of taskNodesNew) {
                    const oldNode = taskNodesOld.find((o: any) => o.id === newNode.id)
                    if (oldNode && oldNode.parentNode !== newNode.parentNode) {
                        console.warn(`🔀 [SYNC-PARENT-CHANGE] Task ${newNode.id.slice(0, 8)}... parentNode: "${oldNode.parentNode ?? 'root'}" → "${newNode.parentNode ?? 'root'}"`, {
                            taskTitle: newNode.data?.label?.slice(0, 20),
                            oldPosition: oldNode.position,
                            newPosition: newNode.position
                        })
                    }
                }

                // ================================================================
                // DUPLICATE DETECTION - Node Builder Layer (AUTHORITATIVE)
                // ================================================================
                // Uses assertNoDuplicateIds for consistent detection across layers
                // This is the final checkpoint before nodes are rendered
                if (import.meta.env.DEV) {
                    // 1. Check tasksToSync for duplicates (upstream issue)
                    const taskSyncCheck = assertNoDuplicateIds(tasksToSync, 'tasksToSync')
                    if (taskSyncCheck.hasDuplicates) {
                        console.error('[ASSERT-FAILED] Duplicate taskIds in tasksToSync before node creation', {
                            duplicates: taskSyncCheck.duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
                            totalCount: taskSyncCheck.totalCount,
                            uniqueIdCount: taskSyncCheck.uniqueIdCount
                        })
                    }

                    // 2. Check task nodes for duplicates
                    const taskNodes = newNodes.filter((n: any) => n.type === 'taskNode')
                    const taskNodeObjects = taskNodes.map((n: any) => ({
                        id: n.data?.task?.id || n.id
                    }))
                    const taskNodeCheck = assertNoDuplicateIds(taskNodeObjects, 'taskNodes')

                    if (taskNodeCheck.hasDuplicates) {
                        console.error('[DUPLICATE-NODES]', {
                            duplicates: taskNodeCheck.duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
                            totalTaskNodes: taskNodeCheck.totalCount,
                            uniqueTaskIds: taskNodeCheck.uniqueIdCount,
                            source: 'syncStoreToCanvas'
                        })
                    }

                    console.debug('[NODE-BUILDER]', {
                        totalNodes: newNodes.length,
                        taskNodes: taskNodeCheck.totalCount,
                        uniqueTaskIds: taskNodeCheck.uniqueIdCount,
                        hasDuplicates: taskNodeCheck.hasDuplicates
                    })

                    // 3. Check group nodes for duplicates
                    const groupNodes = newNodes.filter((n: any) => n.type === 'sectionNode')
                    const groupNodeObjects = groupNodes.map((n: any) => ({
                        id: n.data?.id || n.id
                    }))
                    const groupNodeCheck = assertNoDuplicateIds(groupNodeObjects, 'groupNodes')

                    if (groupNodeCheck.hasDuplicates) {
                        console.error('[DUPLICATE-GROUP-NODES]', {
                            duplicates: groupNodeCheck.duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
                            totalGroupNodes: groupNodeCheck.totalCount,
                            uniqueGroupIds: groupNodeCheck.uniqueIdCount,
                            source: 'syncStoreToCanvas'
                        })
                    }

                    console.debug('[GROUP-NODE-BUILDER]', {
                        totalNodes: newNodes.length,
                        groupNodes: groupNodeCheck.totalCount,
                        uniqueGroupIds: groupNodeCheck.uniqueIdCount
                    })

                    // ================================================================
                    // GEOMETRY DRIFT DETECTION - Compare store positions vs node positions
                    // ================================================================
                    // This catches drift at the moment nodes are about to be rendered.
                    // For root nodes (no parent), store position should equal node position.
                    // Any mismatch indicates position drift from an unexpected source.
                    const DRIFT_EPSILON = 0.5

                    // Check task nodes for drift
                    for (const taskNode of taskNodes) {
                        const task = taskNode.data?.task
                        if (!task?.canvasPosition) continue

                        const storeAbsolute = task.canvasPosition
                        const nodePosition = taskNode.position
                        const hasParent = task.parentId && task.parentId !== 'NONE'

                        // For root tasks, store position should match node position directly
                        if (!hasParent) {
                            const dx = Math.abs((storeAbsolute.x ?? 0) - (nodePosition?.x ?? 0))
                            const dy = Math.abs((storeAbsolute.y ?? 0) - (nodePosition?.y ?? 0))
                            if (dx > DRIFT_EPSILON || dy > DRIFT_EPSILON) {
                                console.warn('[GEOMETRY-DRIFT]', {
                                    type: 'task',
                                    id: task.id?.slice(0, 8),
                                    title: task.title?.slice(0, 20),
                                    parentId: task.parentId,
                                    storePosition: { x: storeAbsolute.x, y: storeAbsolute.y },
                                    nodePosition: { x: nodePosition?.x, y: nodePosition?.y },
                                    delta: { x: dx.toFixed(1), y: dy.toFixed(1) }
                                })
                            }
                        }
                    }

                    // Check group nodes for drift
                    for (const groupNode of groupNodes) {
                        const group = groupNode.data?.group || canvasStore._rawGroups?.find((g: any) => g.id === groupNode.data?.id)
                        if (!group?.position) continue

                        const storeAbsolute = group.position
                        const nodePosition = groupNode.position
                        const hasParent = group.parentGroupId && group.parentGroupId !== 'NONE'

                        // For root groups, store position should match node position directly
                        if (!hasParent) {
                            const dx = Math.abs((storeAbsolute.x ?? 0) - (nodePosition?.x ?? 0))
                            const dy = Math.abs((storeAbsolute.y ?? 0) - (nodePosition?.y ?? 0))
                            if (dx > DRIFT_EPSILON || dy > DRIFT_EPSILON) {
                                console.warn('[GEOMETRY-DRIFT]', {
                                    type: 'group',
                                    id: group.id?.slice(0, 8),
                                    name: group.name?.slice(0, 20),
                                    parentGroupId: group.parentGroupId,
                                    storePosition: { x: storeAbsolute.x, y: storeAbsolute.y },
                                    nodePosition: { x: nodePosition?.x, y: nodePosition?.y },
                                    delta: { x: dx.toFixed(1), y: dy.toFixed(1) }
                                })
                            }
                        }
                    }
                }

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
