import { ref, reactive, nextTick, type Ref, onMounted, onUnmounted } from 'vue'
import { type Node, type NodeDragEvent, useVueFlow } from '@vue-flow/core'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'
import { useCanvasGroups } from './useCanvasGroups'
import { useCanvasCore } from './useCanvasCore'
import { useCanvasOperationState } from './useCanvasOperationState'
import { useCanvasResizeState } from './useCanvasResizeState'
import { useCanvasResizeCalculation } from './useCanvasResizeCalculation'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { getDeepestContainingGroup, DEFAULT_TASK_WIDTH, DEFAULT_TASK_HEIGHT, isNodeCompletelyInside } from '@/utils/canvas/spatialContainment'
import { useNodeSync } from './useNodeSync'
import { canvasSyncInProgress } from './useCanvasSync'
import { useNodeStateManager, NodeState } from './state-machine'
import { storeToRefs } from 'pinia'
import { getGroupAbsolutePosition, toAbsolutePosition } from '@/utils/canvas/coordinates'
import { useCanvasSectionProperties } from './useCanvasSectionProperties'
import { positionManager } from '@/services/canvas/PositionManager'
import { DRAG_SETTLE_TIMEOUT_MS, RESIZE_SETTLE_TIMEOUT_MS } from '@/config/timing'
import { lockManager } from '@/services/canvas/LockManager'
import { getPlatformDiagnostics, isLinuxTauri } from '@/utils/contextMenuCoordinates'

// =============================================================================
// DESCENDANT COLLECTION HELPERS (BUG #1 FIX)
// =============================================================================
// These helpers recursively collect ALL descendants (not just direct children)
// so that when a parent group moves, all nested items are synced to DB.

/**
 * Collect all descendant groups recursively (CYCLE-SAFE)
 * For hierarchy A → B → C, calling with A returns [B, C]
 *
 * Uses visited set to prevent infinite recursion if cycles exist in data.
 */
function collectDescendantGroups(
    rootId: string,
    groups: CanvasGroup[],
    visited: Set<string> = new Set()
): CanvasGroup[] {
    // Cycle protection: don't revisit nodes we've already processed
    if (visited.has(rootId)) return []
    visited.add(rootId)

    const directChildren = groups.filter(g => g.parentGroupId === rootId)

    return directChildren.flatMap(child => [
        child,
        ...collectDescendantGroups(child.id, groups, visited)
    ])
}

/**
 * Collect all descendant tasks (tasks in the group AND all descendant groups)
 * For hierarchy A → B → C with tasks in each, returns all tasks
 */
function collectDescendantTasks(rootId: string, tasks: Task[], groups: CanvasGroup[]): Task[] {
    const descendants: Task[] = []

    // Helper: check if task is spatially inside a group (BUG-1191)
    const isTaskInsideGroup = (task: Task, groupId: string): boolean => {
        if (!task.canvasPosition) return false
        const group = groups.find(g => g.id === groupId)
        if (!group) return false
        const groupAbsPos = getGroupAbsolutePosition(groupId, groups)
        const taskCenterX = task.canvasPosition.x + DEFAULT_TASK_WIDTH / 2
        const taskCenterY = task.canvasPosition.y + DEFAULT_TASK_HEIGHT / 2
        return (
            taskCenterX >= groupAbsPos.x &&
            taskCenterX <= groupAbsPos.x + group.position.width &&
            taskCenterY >= groupAbsPos.y &&
            taskCenterY <= groupAbsPos.y + group.position.height
        )
    }

    // Direct tasks in this group (with spatial validation)
    const directTasks = tasks.filter(t => t.parentId === rootId && isTaskInsideGroup(t, rootId))
    descendants.push(...directTasks)

    // Tasks in ALL descendant groups (recursive, with spatial validation)
    const descendantGroups = collectDescendantGroups(rootId, groups)
    for (const group of descendantGroups) {
        const groupTasks = tasks.filter(t => t.parentId === group.id && isTaskInsideGroup(t, group.id))
        descendants.push(...groupTasks)
    }

    return descendants
}

// =============================================================================
// GROUP PARENT UPDATE HELPER
// =============================================================================
// This helper encapsulates ALL parent transition logic for groups:
// - Center-based containment detection
// - Cycle prevention
// - Vue Flow node updates (parentNode, position)
// - Store updates (parentGroupId)
//
// CRITICAL INVARIANT: Groups must NOT have extent: 'parent' set!
// This allows them to escape their parent via drag.

interface GroupParentUpdateResult {
    oldParentId: string | null
    newParentId: string | null
    transitionType: 'root-to-child' | 'child-to-root' | 'child-to-child' | 'no-change'
    cyclePreventedAttemptedParent?: string
}

/**
 * Update a group's parent after drag, using center-based containment.
 *
 * BEHAVIOR:
 * 1. Computes targetParentId using center of group's bounding box
 * 2. If center is inside a group → becomes child of that group
 * 3. If center is outside all groups → becomes root (parentGroupId = null)
 * 4. Prevents cycles (can't make a descendant the parent)
 * 5. Updates Vue Flow node.parentNode (but NOT extent!)
 * 6. Returns detailed transition info for logging
 *
 * @param args.groupId - The group being moved
 * @param args.absoluteRect - The group's absolute bounding box {x, y, width, height}
 * @param args.node - The Vue Flow node to update
 * @param args.allGroups - All groups for containment lookup
 * @returns Result with old/new parent and transition type
 */
function updateGroupParentAfterDrag(args: {
    groupId: string
    absoluteRect: { x: number; y: number; width: number; height: number }
    node: any
    allGroups: CanvasGroup[]
}): GroupParentUpdateResult {
    const { groupId, absoluteRect, node, allGroups } = args

    // Find current group in store
    const group = allGroups.find(g => g.id === groupId)
    const oldParentId = group?.parentGroupId ?? null

    // Build spatial representation for containment check
    const spatialGroup = {
        position: { x: absoluteRect.x, y: absoluteRect.y },
        width: absoluteRect.width,
        height: absoluteRect.height,
    }

    // Find containing group by CENTER (not overlap)
    const targetParent = getDeepestContainingGroup(spatialGroup, allGroups, groupId)
    let newParentId: string | null = targetParent?.id ?? null

    if (import.meta.env.DEV) {
        const centerX = absoluteRect.x + absoluteRect.width / 2
        const centerY = absoluteRect.y + absoluteRect.height / 2

        console.log(`[CANVAS:INTERACT] Checking containment for "${group?.name || groupId}"`, {
            center: { x: Math.round(centerX), y: Math.round(centerY) },
            oldParent: oldParentId ?? '(root)',
            detectedParent: newParentId ?? '(root)',
        })
    }

    // ================================================================
    // CYCLE PREVENTION
    // ================================================================
    let cyclePreventedAttemptedParent: string | undefined

    // 1) Don't allow self-parenting
    if (newParentId === groupId) {
        console.warn(`[GROUP-PARENT] Prevented self-parenting for ${groupId}`)
        newParentId = null
    }

    // 2) Don't allow making a descendant the parent (creates A→B→A cycle)
    if (newParentId) {
        const descendants = collectDescendantGroups(groupId, allGroups)
        const descendantIds = new Set(descendants.map(d => d.id))
        if (descendantIds.has(newParentId)) {
            console.warn(`[GROUP-PARENT] Prevented cycle: "${group?.name}" cannot have descendant "${targetParent?.name}" as parent`)
            cyclePreventedAttemptedParent = newParentId
            // BUG FIX: When cycle prevented, DON'T keep old parent!
            // The user dragged outside, they want to escape. Set to root.
            // Only exception: if they tried to drop INTO their own child.
            // In that case, we keep position but become root.
            newParentId = null
        }
    }

    // ================================================================
    // POSITION ADJUSTMENT (before parentNode change)
    // ================================================================
    // When parent changes, Vue Flow interprets node.position relative to new parent.
    // Adjust position so visual location stays the same.
    if (oldParentId !== newParentId) {
        if (newParentId) {
            // Going INTO a parent: convert absolute → relative
            const newParentAbsolute = getGroupAbsolutePosition(newParentId, allGroups)
            const newRelativePos = {
                x: absoluteRect.x - newParentAbsolute.x,
                y: absoluteRect.y - newParentAbsolute.y
            }
            if (isFinite(newRelativePos.x) && isFinite(newRelativePos.y)) {
                node.position = newRelativePos
            }
        } else {
            // Going to ROOT: use absolute position directly
            node.position = { x: absoluteRect.x, y: absoluteRect.y }
        }
    }

    // ================================================================
    // VUE FLOW NODE UPDATE
    // ================================================================
    // CRITICAL: Do NOT set extent: 'parent'!
    // This would lock the group inside and prevent future escape.
    if (newParentId) {
        node.parentNode = CanvasIds.groupNodeId(newParentId)
        // NOTE: Intentionally NOT setting node.extent = 'parent'
    } else {
        node.parentNode = undefined
        node.extent = undefined
    }

    // Determine transition type for logging
    let transitionType: GroupParentUpdateResult['transitionType'] = 'no-change'
    if (oldParentId !== newParentId) {
        if (!oldParentId && newParentId) {
            transitionType = 'root-to-child'
        } else if (oldParentId && !newParentId) {
            transitionType = 'child-to-root'
        } else {
            transitionType = 'child-to-child'
        }

        if (import.meta.env.DEV) {
            const oldName = oldParentId ? allGroups.find(g => g.id === oldParentId)?.name : '(root)'
            const newName = newParentId ? allGroups.find(g => g.id === newParentId)?.name : '(root)'
            console.log(`[CANVAS:INTERACT] Transition: ${transitionType}`, {
                group: group?.name || groupId,
                from: oldName,
                to: newName,
            })
        }
    }

    return {
        oldParentId,
        newParentId,
        transitionType,
        cyclePreventedAttemptedParent,
    }
}

// =============================================================================
// ABSOLUTE POSITION COMPUTATION HELPER
// =============================================================================
// This helper reliably computes the absolute world position of a Vue Flow node,
// even when computedPosition is not available or stale.
//
// KEY INSIGHT: When expandParent is false, Vue Flow may not always populate
// computedPosition correctly. We need to manually compute it when necessary.

/**
 * Compute absolute world position for a Vue Flow node
 *
 * CONTAINMENT FIX: Instead of trusting computedPosition (which may be stale
 * or unavailable after setting expandParent: false), we manually compute
 * the absolute position using the store's absolute group positions.
 *
 * @param node - The Vue Flow node
 * @param allGroups - All groups from the canvas store (have absolute positions)
 * @returns Absolute world position {x, y}
 */
function computeNodeAbsolutePosition(
    node: Node,
    allGroups: CanvasGroup[]
): { x: number; y: number } {
    // First try computedPosition - this is the most reliable if available
    const vfNode = node as any
    if (vfNode.computedPosition &&
        typeof vfNode.computedPosition.x === 'number' &&
        typeof vfNode.computedPosition.y === 'number' &&
        isFinite(vfNode.computedPosition.x) &&
        isFinite(vfNode.computedPosition.y)) {
        return {
            x: vfNode.computedPosition.x,
            y: vfNode.computedPosition.y
        }
    }

    // If no parentNode, position is already absolute
    if (!node.parentNode) {
        return { x: node.position.x, y: node.position.y }
    }

    // Has parentNode - position is RELATIVE to parent
    // We need to compute absolute by adding parent's absolute position
    const parentId = node.parentNode.startsWith('section-')
        ? node.parentNode.replace('section-', '')
        : node.parentNode

    const parentAbsolute = getGroupAbsolutePosition(parentId, allGroups)
    const absolute = toAbsolutePosition(node.position, parentAbsolute)

    return { x: absolute.x, y: absolute.y }
}

export interface SelectionBox {
    x: number
    y: number
    width: number
    height: number
    startX: number
    startY: number
    isVisible: boolean
}

/**
 * useCanvasInteractions
 *
 * ============================================================================
 * DRAG/RESIZE HANDLERS - WRITE PATH
 * ============================================================================
 *
 * This composable handles user interactions that trigger the WRITE PATH:
 * - Drag end: saves new absolute positions to DB
 * - Resize end: saves new absolute positions and dimensions to DB
 *
 * FULLY ABSOLUTE ARCHITECTURE:
 * - Uses Vue Flow's computedPosition for absolute world coordinates
 * - Saves ABSOLUTE positions to DB for ALL nodes (tasks AND groups)
 * - When parent group moves, syncs both child tasks AND child groups
 *
 * KEY: Parent-drag triggers child sync because Vue Flow moves children
 * visually, but DB doesn't auto-update. We must explicitly sync.
 */
export function useCanvasInteractions(deps?: {
    findNode: (id: string) => any
    updateNode: (id: string, node: any) => void
    nodes: Ref<any[]>
    applyNodeChanges?: (changes: any[]) => void
}) {
    // Vue Flow context hooks with fallback
    let vueFlow: ReturnType<typeof useVueFlow> | null = null
    try {
        if (!deps) vueFlow = useVueFlow()
    } catch (e) {
        console.warn('⚠️ [CANVAS-INTERACTIONS] useVueFlow context fallback')
    }

    const { getNodes } = useCanvasCore()
    const findNode = deps?.findNode || vueFlow?.findNode || (() => null)
    const updateNode = deps?.updateNode || vueFlow?.updateNode || (() => { })
    const applyNodeChanges = deps?.applyNodeChanges || vueFlow?.applyNodeChanges || (() => { })
    const nodes = (deps?.nodes || vueFlow?.nodes || ref([])) as Ref<any[]>

    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const { nodeVersionMap } = storeToRefs(canvasStore)
    const { updateSectionTaskCounts } = useCanvasGroups()
    const { startDrag, endDrag, startResize, endResize } = useCanvasOperationState()
    const { setNodeState } = useNodeStateManager()

    // Smart Section Properties
    const { getSectionProperties } = useCanvasSectionProperties({
        taskStore,
        getAllContainingSections: (_x, _y, _w, _h) => {
            // This is used for nesting, but onNodeDragStop handles its own containment
            return []
        }
    })

    // Interaction sub-states
    const { resizeState, isResizeSettling, resizeLineStyle, edgeHandleStyle } = useCanvasResizeState()
    const { validateDimensions, calculateChildInverseDelta } = useCanvasResizeCalculation()

    // --- DRAG HANDLERS ---

    /**
     * Handle drag start - SINGLE SOURCE OF TRUTH for initiating drag state
     *
     * GUARDS:
     * 1. `startDrag()` checks if global operation state is idle (prevents duplicate drags)
     * 2. `setNodeState()` is idempotent (no warning if node already in DRAGGING_LOCAL)
     * 3. `canvasStore.isDragging` is only set TRUE once per drag session
     *
     * If Vue Flow fires duplicate events, the guards prevent duplicate state transitions.
     */
    const onNodeDragStart = (event: NodeDragEvent) => {
        const { nodes: involvedNodes } = event

        if (import.meta.env.DEV) {
            console.log(`[CANVAS:INTERACT] Drag start - ${involvedNodes.length} nodes`,
                involvedNodes.map((n: any) => ({
                    id: n.id?.slice(0, 12),
                    position: n.position ? { x: Math.round(n.position.x), y: Math.round(n.position.y) } : null,
                    positionAbsolute: n.positionAbsolute ? { x: Math.round(n.positionAbsolute.x), y: Math.round(n.positionAbsolute.y) } : null,
                    parentNode: n.parentNode?.slice(0, 12) ?? null
                }))
            )
        }

        // Guard: Only proceed if we can start a new drag (operation state is idle)
        // This is the AUTHORITATIVE guard that prevents duplicate drag starts
        if (startDrag(involvedNodes.map(n => n.id))) {
            // Set per-node state (idempotent - safe to call even if already DRAGGING_LOCAL)
            involvedNodes.forEach(node => {
                setNodeState(node.id, NodeState.DRAGGING_LOCAL)
                // TASK-213: Acquire Lock
                // FIX: Use raw ID (not Vue Flow node ID) to match PositionManager's key format
                const { id: rawId } = CanvasIds.parseNodeId(node.id)
                lockManager.acquire(rawId, 'user-drag')
            })
            // Set store-level drag flag ONCE per drag session
            canvasStore.isDragging = true
        }
        // If startDrag() returned false, we are already dragging - ignore duplicate event
    }

    const onNodeDrag = (event: NodeDragEvent) => {
        // Vue Flow updates node.position automatically (Visuals)

        // TASK-213: Update PositionManager (Truth)
        const allGroups = canvasStore._rawGroups || canvasStore.groups || []
        event.nodes.forEach(node => {
            const absPos = computeNodeAbsolutePosition(node, allGroups)
            const parentId = node.parentNode
                ? (node.parentNode.startsWith('section-') ? node.parentNode.replace('section-', '') : node.parentNode)
                : null

            // FIX: Use raw ID (not Vue Flow node ID) to match PositionManager's key format
            const { id: rawId } = CanvasIds.parseNodeId(node.id)
            positionManager.updatePosition(rawId, absPos, 'user-drag', parentId)
        })
    }

    // useNodeSync expects Ref<Map> from storeToRefs for proper reactivity
    const { syncNodePosition } = useNodeSync(nodeVersionMap)

    /**
     * Handle drag stop - save new absolute positions to DB
     *
     * =========================================================================
     * GEOMETRY WRITE POLICY (TASK-240 Phase 2.5)
     * =========================================================================
     * This function (onNodeDragStop) is the ONLY place where user-initiated
     * geometry changes are allowed:
     *   - task.parentId
     *   - task.canvasPosition
     *   - group.parentGroupId
     *   - group.position
     *
     * All other code paths (Smart Groups, sync, orchestrator, overdue collectors)
     * must be READ-ONLY for geometry fields. They may change metadata (dueDate,
     * priority, status, tags) but NEVER parent or position fields.
     *
     * This policy prevents sync loops and position drift.
     * =========================================================================
     *
     * FULLY ABSOLUTE ARCHITECTURE:
     * 1. Use computedPosition for absolute world coordinates
     * 2. Detect new parent using spatial containment
     * 3. Update store with absolute position
     * 4. Sync to DB with optimistic locking
     * 5. For groups: also sync child tasks AND child groups
     */
    const onNodeDragStop = async (event: NodeDragEvent) => {
        // BUG-1061 FIX #5: Skip if triggered by setNodes() during canvas sync
        // Vue Flow may fire nodeDragStop when setNodes() updates node positions programmatically.
        // This creates a reactive loop: drag → Smart Group update → sync → setNodes → drag fires again.
        if (canvasSyncInProgress.value) {
            if (import.meta.env.DEV) {
                console.log('[CANVAS:INTERACT] Drag stop blocked - triggered during canvas sync')
            }
            return
        }

        const { nodes: involvedNodes } = event
        // BUG-1209: Do NOT set isDragging=false here — it opens a window where realtime
        // handlers see "not dragging" while async save is still in progress.
        // Moved to the finally block below, after all saves complete.

        if (import.meta.env.DEV) {
            const callId = Math.random().toString(36).slice(2, 8)
            console.log(`[CANVAS:INTERACT] Drag stop - callId=${callId}, involvedNodes=${involvedNodes.length}`,
                involvedNodes.map(n => `${n.id.slice(0, 12)}(${n.type})`))
        }

        try {

            for (const node of involvedNodes) {
                if (CanvasIds.isGroupNode(node.id)) {
                    // ============================================================
                    // GROUP DRAG END
                    // ============================================================
                    const { id: groupId } = CanvasIds.parseNodeId(node.id)
                    const allGroups = canvasStore._rawGroups || canvasStore.groups || []
                    const group = allGroups.find(g => g.id === groupId)
                    if (!group) continue

                    // Compute absolute position for the group
                    // BUG-1209/TASK-1289: Snap to 16px grid to prevent cumulative micro-drift
                    const rawAbsolutePos = computeNodeAbsolutePosition(node, allGroups)
                    const absolutePos = { x: Math.round(rawAbsolutePos.x / 16) * 16, y: Math.round(rawAbsolutePos.y / 16) * 16 }
                    const groupWidth = group.position.width
                    const groupHeight = group.position.height

                    // Use the unified helper for parent update logic
                    // This handles: containment detection, cycle prevention, position adjustment,
                    // Vue Flow node updates (parentNode but NOT extent)
                    const parentResult = updateGroupParentAfterDrag({
                        groupId,
                        absoluteRect: {
                            x: absolutePos.x,
                            y: absolutePos.y,
                            width: groupWidth,
                            height: groupHeight,
                        },
                        node,
                        allGroups,
                    })

                    if (import.meta.env.DEV) {
                        const beforeGroupPos = group.position
                        console.log(`[CANVAS:INTERACT] Group drag write "${group.name?.slice(0, 20)}" (${groupId.slice(0, 8)})`, {
                            before: beforeGroupPos ? { x: Math.round(beforeGroupPos.x), y: Math.round(beforeGroupPos.y) } : null,
                            after: { x: Math.round(absolutePos.x), y: Math.round(absolutePos.y) },
                            parentChange: parentResult.transitionType !== 'no-change' ? parentResult.transitionType : 'same',
                            source: 'onNodeDragStop'
                        })
                    }

                    // Update store with ABSOLUTE position AND parentGroupId
                    canvasStore.updateSection(groupId, {
                        position: {
                            x: absolutePos.x,
                            y: absolutePos.y,
                            width: groupWidth,
                            height: groupHeight,
                        },
                        parentGroupId: parentResult.newParentId,
                        positionFormat: 'absolute',
                    })

                    // TASK-213: Update PositionManager
                    positionManager.updatePosition(groupId, absolutePos, 'user-drag', parentResult.newParentId)

                    // Sync group to DB (persists parent_group_id)
                    // Re-fetch allGroups after store update to ensure we have latest data
                    const updatedAllGroups = canvasStore._rawGroups || canvasStore.groups || []
                    setNodeState(groupId, NodeState.SYNCING)
                    await syncNodePosition(groupId, node, updatedAllGroups, 'groups')
                    setNodeState(groupId, NodeState.IDLE)

                    // ================================================================
                    // SYNC DESCENDANTS: Tasks and Groups
                    // ================================================================
                    // When parent moves, Vue Flow moves all children visually.
                    // We must sync their NEW absolute positions to DB.

                    const descendantTasks = collectDescendantTasks(groupId, taskStore.tasks, updatedAllGroups)
                    const descendantGroups = collectDescendantGroups(groupId, updatedAllGroups)

                    // BUG-1209: Wait for Vue Flow to re-render with parent's new position
                    // so computedPosition is fresh for descendant position calculations.
                    await nextTick()

                    // Sync descendant GROUPS first (parents before their children)
                    for (const descendantGroup of descendantGroups) {
                        const childNodeId = CanvasIds.groupNodeId(descendantGroup.id)
                        const childNode = findNode(childNodeId)
                        if (!childNode) continue

                        setNodeState(descendantGroup.id, NodeState.SYNCING)
                        await syncNodePosition(descendantGroup.id, childNode, updatedAllGroups, 'groups')
                        setNodeState(descendantGroup.id, NodeState.IDLE)
                    }

                    // Sync descendant TASKS
                    for (const descendantTask of descendantTasks) {
                        const childNode = findNode(descendantTask.id)
                        if (!childNode) continue

                        setNodeState(descendantTask.id, NodeState.SYNCING)
                        await syncNodePosition(descendantTask.id, childNode, updatedAllGroups, 'tasks')
                        setNodeState(descendantTask.id, NodeState.IDLE)
                    }

                } else {
                    // ============================================================
                    // TASK DRAG END
                    // ============================================================
                    const task = taskStore.getTask(node.id)
                    if (!task) continue

                    // BUG-1209: Re-snapshot groups per iteration to pick up any changes
                    // from prior iterations (e.g., sibling that modified group positions)
                    const taskAllGroups = canvasStore._rawGroups || canvasStore.groups || []

                    // BUG-1191: Detect stale parentNode - task was dragged with wrong group
                    // Compare Vue Flow's parentNode with store's parentId
                    const vfParentGroupId = node.parentNode
                        ? (node.parentNode.startsWith('section-') ? node.parentNode.replace('section-', '') : node.parentNode)
                        : null
                    const storeParentId = task.parentId ?? null

                    if (vfParentGroupId !== storeParentId) {
                        if (import.meta.env.DEV) {
                            console.warn(`[BUG-1191] Stale parentNode for "${task.title?.slice(0, 25)}": VF=${vfParentGroupId?.slice(0, 8)}, Store=${storeParentId?.slice(0, 8) ?? 'null'}. Restoring position.`)
                        }
                        // Fix Vue Flow node to match store
                        node.parentNode = storeParentId ? CanvasIds.groupNodeId(storeParentId) : undefined
                        // Restore position from store (undo the wrong visual move)
                        if (task.canvasPosition) {
                            if (storeParentId) {
                                const correctParentAbsolute = getGroupAbsolutePosition(storeParentId, taskAllGroups)
                                node.position = {
                                    x: task.canvasPosition.x - correctParentAbsolute.x,
                                    y: task.canvasPosition.y - correctParentAbsolute.y
                                }
                            } else {
                                node.position = { x: task.canvasPosition.x, y: task.canvasPosition.y }
                            }
                        }
                        setNodeState(task.id, NodeState.IDLE)
                        continue
                    }

                    // 1. Compute ABSOLUTE position for containment check
                    // When node has parentNode, node.position is RELATIVE, not absolute
                    // computedPosition is preferred; fallback calculates from parent's absolute
                    const rawAbsolutePos = computeNodeAbsolutePosition(node, taskAllGroups)
                    // BUG-1209: Round to grid to prevent cumulative micro-drift from snap-to-grid
                    // (CanvasView uses 16px grid — store should always save grid-aligned values)
                    const absolutePos = { x: Math.round(rawAbsolutePos.x), y: Math.round(rawAbsolutePos.y) }

                    // 2. Build spatial task with explicit dimensions for center-based containment
                    const spatialTask = {
                        position: absolutePos,
                        width: (node as any).width ?? DEFAULT_TASK_WIDTH,
                        height: (node as any).height ?? DEFAULT_TASK_HEIGHT
                    }

                    // BUG-1061 FIX: Skip if task just followed its parent group (didn't move independently)
                    // When a group is dragged, Vue Flow reports child tasks as "involved".
                    // We should NOT recalculate parentId/Smart Groups for tasks that stayed in their group.
                    // Check: if task has a parent AND is still inside that parent, skip processing.
                    const oldParentId = task.parentId
                    if (import.meta.env.DEV) {
                        console.log(`[CANVAS:INTERACT] Task "${task.title?.slice(0, 20)}" oldParentId=${oldParentId?.slice(0, 8) ?? 'none'}`)
                    }
                    if (oldParentId) {
                        const currentParent = taskAllGroups.find(g => g.id === oldParentId)
                        if (currentParent) {
                            const parentAbsolutePos = getGroupAbsolutePosition(oldParentId, taskAllGroups)
                            const parentBounds = {
                                position: parentAbsolutePos,
                                width: currentParent.position.width,
                                height: currentParent.position.height
                            }
                            // If task center is still inside current parent, skip processing
                            // BUG-1084 FIX: Reduced padding from 10 to 2 to prevent false "outside" detection
                            const stillInside = isNodeCompletelyInside(spatialTask, parentBounds, 2)
                            if (import.meta.env.DEV) {
                                console.log(`[CANVAS:INTERACT] stillInside=${stillInside}`, {
                                    taskCenter: { x: Math.round(spatialTask.position.x + (spatialTask.width || 200) / 2), y: Math.round(spatialTask.position.y + (spatialTask.height || 40) / 2) },
                                    parentBounds: { x: Math.round(parentBounds.position.x), y: Math.round(parentBounds.position.y), w: parentBounds.width, h: parentBounds.height }
                                })
                            }
                            if (stillInside) {
                                // Task just moved with its group - only sync position, skip parent/Smart Group recalc
                                const posChanged = !task.canvasPosition ||
                                    Math.abs(absolutePos.x - task.canvasPosition.x) > 1 ||
                                    Math.abs(absolutePos.y - task.canvasPosition.y) > 1
                                if (posChanged) {
                                    // High Severity Issue #7: Mark task as pending write
                                    taskStore.addPendingWrite(task.id)
                                    try {
                                        await taskStore.updateTask(task.id, {
                                            canvasPosition: absolutePos,
                                            positionFormat: 'absolute'
                                        }, 'DRAG-FOLLOW-PARENT' as any)
                                        positionManager.updatePosition(task.id, absolutePos, 'user-drag', oldParentId)
                                    } finally {
                                        // BUG-1209: Delay clearing pendingWrite to catch realtime echo
                                        setTimeout(() => taskStore.removePendingWrite(task.id), DRAG_SETTLE_TIMEOUT_MS)
                                    }
                                }
                                setNodeState(task.id, NodeState.IDLE)
                                continue // Skip rest of TASK DRAG END (no parentId change, no Smart Group)
                            }
                        }
                    }

                    // 3. Detect new parent using spatial containment (center inside group bounds)
                    // BUG-1061 FIX #4: Prefer current parent if it still contains the task
                    // This prevents flip-flopping when task is in overlapping region of two groups
                    let targetGroup = getDeepestContainingGroup(spatialTask, taskAllGroups)
                    if (oldParentId && targetGroup?.id !== oldParentId) {
                        // Check if current parent also contains the task
                        const currentParent = taskAllGroups.find(g => g.id === oldParentId)
                        if (currentParent) {
                            const parentAbsPos = getGroupAbsolutePosition(oldParentId, taskAllGroups)
                            const parentBounds = {
                                position: parentAbsPos,
                                width: currentParent.position.width,
                                height: currentParent.position.height
                            }
                            // BUG-1084 FIX: Reduced padding from 10 to 2 (consistent with above)
                            const stillInCurrentParent = isNodeCompletelyInside(spatialTask, parentBounds, 2)
                            if (stillInCurrentParent) {
                                // Task is inside BOTH current parent and detected group - prefer current
                                if (import.meta.env.DEV) {
                                    console.log(`[CANVAS:INTERACT] Task inside both "${targetGroup?.name}" and current "${currentParent.name}" - keeping current`)
                                }
                                targetGroup = currentParent
                            }
                        }
                    }
                    const newParentId = targetGroup?.id ?? null
                    if (import.meta.env.DEV) {
                        console.log(`[CANVAS:INTERACT] Task "${task.title?.slice(0, 20)}" detected in "${targetGroup?.name ?? 'none'}" (${newParentId?.slice(0, 8) ?? 'root'})`)
                    }

                    // Skip if position didn't change meaningfully
                    // (prevents drift when task just followed parent group)
                    // TASK-370: Increased threshold from 1 to 5 to prevent phantom movement of siblings
                    if (oldParentId === newParentId && oldParentId !== null) {
                        const oldPos = task.canvasPosition || { x: 0, y: 0 }
                        const posDelta = Math.abs(absolutePos.x - oldPos.x) + Math.abs(absolutePos.y - oldPos.y)
                        if (posDelta < 5) {
                            continue
                        }
                    }

                    // 4. Optimistic Store Update (Absolute position + parentId)
                    // GEOMETRY WRITER: Primary drag handler (TASK-255)

                    if (import.meta.env.DEV) {
                        const beforePos = task.canvasPosition
                        console.log(`[CANVAS:INTERACT] Task drag write "${task.title?.slice(0, 20)}" (${task.id.slice(0, 8)})`, {
                            before: beforePos ? { x: Math.round(beforePos.x), y: Math.round(beforePos.y) } : null,
                            after: { x: Math.round(absolutePos.x), y: Math.round(absolutePos.y) },
                            parentChange: oldParentId !== newParentId ? `${oldParentId?.slice(0, 8) ?? 'root'} → ${newParentId?.slice(0, 8) ?? 'root'}` : 'same',
                            source: 'onNodeDragStop'
                        })
                    }

                    // TASK-1083: Combine position + smart-group updates into SINGLE save to prevent race condition
                    // Previously: two separate updateTask calls could race with realtime events
                    const dragUpdates: Record<string, any> = {
                        parentId: newParentId ?? undefined,
                        canvasPosition: absolutePos,
                        positionFormat: 'absolute'
                    }

                    // 6. Collect Smart Section Properties (Today, Tomorrow, Priorities, etc.)
                    // METADATA ONLY: Smart groups update dueDate/priority/status, never geometry (TASK-255)
                    // TASK-1177: Pass allGroups to enable parent chain property inheritance
                    if (targetGroup) {
                        if (import.meta.env.DEV) {
                            console.log(`[CANVAS:INTERACT] Smart Group check - Group: "${targetGroup.name}", Task: "${task.title}"`)
                        }
                        // TASK-1177: Pass allGroups to getSectionProperties for parent chain inheritance
                        // This allows child groups to inherit properties (like dueDate) from parent groups
                        const smartUpdates = getSectionProperties(
                            targetGroup as CanvasSection,
                            taskAllGroups as CanvasGroup[]
                        )
                        if (import.meta.env.DEV) {
                            console.log(`[CANVAS:INTERACT] Smart updates:`, smartUpdates)
                        }
                        // Filter out updates where the task already has the same value
                        // TASK-1177 FIX: Also skip empty/null dueDate values to prevent DB errors
                        for (const [key, value] of Object.entries(smartUpdates)) {
                            // Skip invalid dueDate values (empty string, null, undefined, "null" string)
                            if (key === 'dueDate' && (!value || value === 'null')) {
                                if (import.meta.env.DEV) {
                                    console.log(`[CANVAS:INTERACT] Skipping invalid dueDate: "${value}"`)
                                }
                                continue
                            }
                            const taskKey = key as keyof typeof task
                            if (task[taskKey] !== value) {
                                dragUpdates[key] = value
                                if (import.meta.env.DEV) {
                                    console.log(`[CANVAS:INTERACT] Adding "${key}" from "${targetGroup.name}" to combined update`)
                                }
                            }
                        }
                    }

                    // BUG-1209 FIX: Update Vue Flow node and PositionManager BEFORE the store write.
                    // Previously, the store write was first (line ~797), which triggered reactive
                    // watchers → syncStoreToCanvas() → read inconsistent state (new store parentId,
                    // old VF parentNode). By updating VF first, any sync triggered by the store
                    // write sees consistent VF state.

                    // 5. Update Vue Flow parentNode AND position to match new containment
                    // BUG FIX: Set position BEFORE parentNode to avoid a micro-tick where
                    // the old position is interpreted as relative to the new parent.
                    if (newParentId) {
                        // Convert absolute position to relative position for new parent
                        const newParentAbsolute = getGroupAbsolutePosition(newParentId, taskAllGroups)
                        node.position = {
                            x: absolutePos.x - newParentAbsolute.x,
                            y: absolutePos.y - newParentAbsolute.y
                        }
                        node.parentNode = CanvasIds.groupNodeId(newParentId)
                    } else {
                        // Root node: position is absolute (same as world position)
                        node.position = { x: absolutePos.x, y: absolutePos.y }
                        node.parentNode = undefined
                    }

                    // TASK-213: Update PositionManager (before store write for consistency)
                    positionManager.updatePosition(task.id, absolutePos, 'user-drag', newParentId ?? null)

                    // High Severity Issue #7: Mark task as pending write before save
                    taskStore.addPendingWrite(task.id)

                    try {
                        // SINGLE atomic save with all updates
                        await taskStore.updateTask(task.id, dragUpdates, 'DRAG') // BUG-1051: AWAIT to ensure persistence
                    } finally {
                        // BUG-1209: Delay clearing pendingWrite by 3s so the Supabase realtime echo
                        // (arriving 100ms-2s later) is still blocked by isPendingWrite().
                        // Previously cleared immediately, allowing echo to overwrite position.
                        setTimeout(() => taskStore.removePendingWrite(task.id), DRAG_SETTLE_TIMEOUT_MS)
                    }

                    if (oldParentId !== newParentId) {
                        // REACTIVITY FIX: Bump version FIRST to trigger count recomputation
                        // Then updateSectionTaskCounts can read the fresh values from computeds
                        canvasStore.bumpTaskParentVersion()
                        updateSectionTaskCounts(oldParentId || undefined, newParentId || undefined)
                    }

                    setNodeState(task.id, NodeState.IDLE)
                }
            }

        } finally {
            // BUG-1209: Set isDragging=false AFTER all async saves complete,
            // so realtime handlers don't overwrite positions mid-save.
            canvasStore.isDragging = false
            // TASK-213: Release Locks
            // FIX: Use raw ID (not Vue Flow node ID) to match the ID used during acquire
            involvedNodes.forEach(node => {
                const { id: rawId } = CanvasIds.parseNodeId(node.id)
                lockManager.release(rawId, 'user-drag')
            })
            endDrag(involvedNodes.map(n => n.id))
        }
    }

    // --- RESIZE HANDLERS ---

    // --- RESIZE HANDLERS ---

    const onSectionResizeStart = ({ sectionId: rawSectionId }: { sectionId: string; event: any }) => {
        const { id: sectionId } = CanvasIds.parseNodeId(rawSectionId)
        const section = canvasStore.groups.find(s => s.id === sectionId)
        if (!section) return

        const vueFlowNode = findNode(CanvasIds.groupNodeId(sectionId))
        const startX = vueFlowNode?.position.x ?? section.position.x
        const startY = vueFlowNode?.position.y ?? section.position.y

        setNodeState(sectionId, NodeState.RESIZING)
        startResize(sectionId, 'se')

        resizeState.value = {
            ...resizeState.value,
            isResizing: true,
            sectionId,
            startX,
            startY,
            startWidth: section.position.width,
            startHeight: section.position.height,
            currentX: startX,
            currentY: startY,
            currentWidth: section.position.width,
            currentHeight: section.position.height,
            childStartPositions: {}
        }

        const vueFlowParentId = CanvasIds.groupNodeId(sectionId)
        nodes.value.forEach(node => {
            if (node.parentNode === vueFlowParentId) {
                // FIX: Use raw ID for consistent locking with PositionManager
                const { id: childRawId } = CanvasIds.parseNodeId(node.id)
                resizeState.value.childStartPositions[childRawId] = { ...node.position }
                // TASK-213: Lock Children
                lockManager.acquire(childRawId, 'user-resize')
            }
        })

        // TASK-213: Lock Group
        lockManager.acquire(sectionId, 'user-resize')
    }

    const onSectionResize = ({ sectionId: _rawSectionId, event }: { sectionId: string; event: any }) => {
        const { id: sectionId } = CanvasIds.parseNodeId(_rawSectionId)
        const typedEvent = event as { params?: { width?: number; height?: number; x?: number; y?: number } }
        const width = typedEvent?.params?.width
        const height = typedEvent?.params?.height

        // STRICT GUARD: Ignore resize events if not in an active resize session
        // This prevents spurious events from NodeResizer on mount or layout shift
        if (!resizeState.value.isResizing) return

        // TOLERANCE CHECK: Ignore sub-pixel jitter to prevent ResizeObserver loops
        if (!width || !height) return

        // Must change by at least 1px to matter
        if (Math.abs(width - resizeState.value.currentWidth) < 1 &&
            Math.abs(height - resizeState.value.currentHeight) < 1) {
            return
        }

        resizeState.value.currentWidth = width
        resizeState.value.currentHeight = height

        const xParam = typedEvent?.params?.x
        const yParam = typedEvent?.params?.y
        if (typeof xParam === 'number') resizeState.value.currentX = xParam
        if (typeof yParam === 'number') resizeState.value.currentY = yParam

        const deltaX = resizeState.value.currentX - resizeState.value.startX
        const deltaY = resizeState.value.currentY - resizeState.value.startY

        if (deltaX !== 0 || deltaY !== 0) {
            // TASK-213: Update Group in PositionManager
            const groupNode = findNode(CanvasIds.groupNodeId(sectionId))
            const parentId = groupNode?.parentNode ? groupNode.parentNode.replace('section-', '') : null

            // TASK-213: Update Group in PositionManager via relative (local) coordinates
            positionManager.updateFromRelative(
                sectionId,
                { x: resizeState.value.currentX, y: resizeState.value.currentY },
                'user-resize',
                parentId
            )

            Object.entries(resizeState.value.childStartPositions).forEach(([childId, startPos]) => {
                const newRelPos = calculateChildInverseDelta(startPos, deltaX, deltaY)
                updateNode(childId, { position: newRelPos })

                // TASK-213: Update Child in PositionManager via relative (local) coordinates
                // We pass 'sectionId' as the parentId so PM can calculate absolute
                positionManager.updateFromRelative(childId, newRelPos, 'user-resize', sectionId)
            })
        }
    }

    const onSectionResizeEnd = async ({ sectionId: rawSectionId, event }: { sectionId: string; event: any }) => {
        const { id: sectionId } = CanvasIds.parseNodeId(rawSectionId)
        const vueFlowNode = findNode(CanvasIds.groupNodeId(sectionId))
        if (!vueFlowNode) return

        const typedEvent = event as { params?: { width?: number; height?: number } }
        const width = typedEvent?.params?.width
        const height = typedEvent?.params?.height
        if (!width || !height) return

        const section = canvasStore.groups.find(s => s.id === sectionId)
        if (!section) return

        isResizeSettling.value = true
        resizeState.value.isResizing = false
        endResize(sectionId)

        const { width: validatedWidth, height: validatedHeight } = validateDimensions(width, height)
        const newX = vueFlowNode.position.x
        const newY = vueFlowNode.position.y
        const deltaX = newX - resizeState.value.startX
        const deltaY = newY - resizeState.value.startY

        const absPos = { x: newX, y: newY }

        // 1. Optimistic Store Update (Absolute)
        canvasStore.updateGroup(sectionId, {
            position: {
                ...absPos,
                width: validatedWidth,
                height: validatedHeight
            },
            positionFormat: 'absolute'
        })

        // 2. Optimistic DB Sync
        // We find the Vue Flow node to pass to key logic
        if (vueFlowNode) {
            // Ensure width/height are set for sync
            vueFlowNode.data = { ...vueFlowNode.data, width: validatedWidth, height: validatedHeight }

            setNodeState(sectionId, NodeState.SYNCING)
            await syncNodePosition(sectionId, vueFlowNode, canvasStore.groups, 'groups')
            setNodeState(sectionId, NodeState.IDLE)
        }

        // ================================================================
        // BUG #4 FIX: Sync descendants when resize changes origin
        // ================================================================
        // If resize changed the group's origin (e.g., resizing from top-left),
        // we must sync all descendant positions to DB. When resizing from
        // bottom-right only, deltaX/deltaY will be 0 and no sync is needed.
        if (deltaX !== 0 || deltaY !== 0) {
            if (import.meta.env.DEV) {
                console.log(`[CANVAS:INTERACT] Resize origin changed by (${deltaX}, ${deltaY}), syncing descendants...`)
            }

            // Sync ALL Descendant Tasks (reuse helpers from BUG #1 fix)
            const descendantTasks = collectDescendantTasks(sectionId, taskStore.tasks, canvasStore.groups)
            for (const descendantTask of descendantTasks) {
                const childNode = findNode(descendantTask.id)
                if (childNode) {
                    setNodeState(descendantTask.id, NodeState.SYNCING)
                    syncNodePosition(descendantTask.id, childNode, canvasStore.groups, 'tasks')
                        .finally(() => setNodeState(descendantTask.id, NodeState.IDLE))
                }
            }

            // Sync ALL Descendant Groups
            const descendantGroups = collectDescendantGroups(sectionId, canvasStore.groups)
            for (const descendantGroup of descendantGroups) {
                const childNodeId = CanvasIds.groupNodeId(descendantGroup.id)
                const childNode = findNode(childNodeId)
                if (childNode) {
                    setNodeState(descendantGroup.id, NodeState.SYNCING)
                    syncNodePosition(descendantGroup.id, childNode, canvasStore.groups, 'groups')
                        .finally(() => setNodeState(descendantGroup.id, NodeState.IDLE))
                }
            }
        }
        // NOTE: When deltaX === 0 && deltaY === 0 (bottom-right resize only),
        // no child sync is needed because child absolute positions don't change.

        // ================================================================
        // BUG-1191 FIX: Reconcile parentId after resize
        // ================================================================
        // When a group is resized smaller, tasks that were inside may now
        // be outside the new bounds. Clear their parentId to prevent them
        // from being dragged with the group.
        const allTasks = taskStore.tasks
        const resizedGroup = canvasStore.groups.find(g => g.id === sectionId)
        if (resizedGroup) {
            const groupAbsPos = getGroupAbsolutePosition(sectionId, canvasStore.groups)
            const tasksInGroup = allTasks.filter(t => t.parentId === sectionId)
            for (const task of tasksInGroup) {
                if (!task.canvasPosition) continue
                const taskCenterX = task.canvasPosition.x + DEFAULT_TASK_WIDTH / 2
                const taskCenterY = task.canvasPosition.y + DEFAULT_TASK_HEIGHT / 2
                const isInside = (
                    taskCenterX >= groupAbsPos.x &&
                    taskCenterX <= groupAbsPos.x + validatedWidth &&
                    taskCenterY >= groupAbsPos.y &&
                    taskCenterY <= groupAbsPos.y + validatedHeight
                )
                if (!isInside) {
                    if (import.meta.env.DEV) {
                        console.log(`[BUG-1191] Task "${task.title?.slice(0, 25)}" outside resized group "${resizedGroup.name}". Clearing parentId.`)
                    }
                    // Clear parentId in store and DB
                    taskStore.updateTask(task.id, { parentId: undefined, positionFormat: 'absolute' }, 'DRAG' as any)
                    // Fix Vue Flow node
                    const taskNode = findNode(task.id)
                    if (taskNode) {
                        taskNode.parentNode = undefined
                        // Convert to absolute position (already stored as absolute)
                        if (task.canvasPosition) {
                            taskNode.position = { x: task.canvasPosition.x, y: task.canvasPosition.y }
                        }
                    }
                }
            }
        }

        // TASK-213: Release Locks
        lockManager.release(sectionId, 'user-resize')
        Object.keys(resizeState.value.childStartPositions).forEach(childId => {
            lockManager.release(childId, 'user-resize')
        })

        setTimeout(() => isResizeSettling.value = false, RESIZE_SETTLE_TIMEOUT_MS)
    }

    return {
        onNodeDragStart, onNodeDrag, onNodeDragStop,
        onSectionResizeStart, onSectionResize, onSectionResizeEnd,
        resizeState, isResizeSettling, resizeLineStyle, edgeHandleStyle
    }
}
