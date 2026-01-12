import { ref, watch } from 'vue'
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
    const { nodeVersionMap } = storeToRefs(canvasStore)
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
            for (const group of groups) {
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

                newNodes.push({
                    id: nodeId,
                    type: 'sectionNode',
                    position: displayPos,
                    parentNode: parentId ? CanvasIds.groupNodeId(parentId) : undefined,
                    extent: parentId ? 'parent' : undefined,
                    // FIX: Removed expandParent: true
                    // expandParent causes Vue Flow to auto-resize parent groups when
                    // children are placed outside bounds. This caused unexpected group
                    // resizing when dragging tasks into groups.
                    // extent: 'parent' already constrains child movement within parent bounds.
                    expandParent: false,
                    data: {
                        id: group.id,
                        label: group.name || 'Group',
                        color: group.color || '#3b82f6',
                        width: group.position?.width || 300,
                        height: group.position?.height || 200,
                        collapsed: group.isCollapsed || false
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
            for (const task of tasksToSync) {
                if (!task.canvasPosition) continue

                // Initialize version if not already tracked
                // nodeVersionMap is Ref<Map> from storeToRefs
                if (nodeVersionMap.value && nodeVersionMap.value instanceof Map && !nodeVersionMap.value.has(task.id)) {
                    nodeVersionMap.value.set(task.id, task.positionVersion ?? 0)
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
