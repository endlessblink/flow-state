import { ref, reactive, computed, nextTick, type Ref } from 'vue'
import { type Node, type NodeDragEvent, useVueFlow } from '@vue-flow/core'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/stores/canvas/types'
import { useCanvasGroups } from './useCanvasGroups'
import { useCanvasCore } from './useCanvasCore'
import { useCanvasOperationState } from './useCanvasOperationState'
import { useCanvasResizeState } from './useCanvasResizeState'
import { useCanvasResizeCalculation } from './useCanvasResizeCalculation'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { getDeepestContainingGroup, DEFAULT_TASK_WIDTH, DEFAULT_TASK_HEIGHT } from '@/utils/canvas/spatialContainment'
import { useNodeSync } from './useNodeSync'
import { useNodeStateManager, NodeState } from './state-machine'
import { storeToRefs } from 'pinia'
import { getGroupAbsolutePosition, toAbsolutePosition } from '@/utils/canvas/coordinates'
import { useCanvasSectionProperties } from './useCanvasSectionProperties'

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

    // Direct tasks in this group
    const directTasks = tasks.filter(t => t.parentId === rootId)
    descendants.push(...directTasks)

    // Tasks in ALL descendant groups (recursive)
    const descendantGroups = collectDescendantGroups(rootId, groups)
    for (const group of descendantGroups) {
        const groupTasks = tasks.filter(t => t.parentId === group.id)
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

    // Log center position for debugging
    const centerX = absoluteRect.x + absoluteRect.width / 2
    const centerY = absoluteRect.y + absoluteRect.height / 2

    console.log(`[GROUP-PARENT] Checking containment for "${group?.name || groupId}"`, {
        center: { x: Math.round(centerX), y: Math.round(centerY) },
        oldParent: oldParentId ?? '(root)',
        detectedParent: newParentId ?? '(root)',
    })

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

        const oldName = oldParentId ? allGroups.find(g => g.id === oldParentId)?.name : '(root)'
        const newName = newParentId ? allGroups.find(g => g.id === newParentId)?.name : '(root)'
        console.log(`[GROUP-PARENT] ✓ Transition: ${transitionType}`, {
            group: group?.name || groupId,
            from: oldName,
            to: newName,
        })
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
        getAllContainingSections: (x, y, w, h) => {
            // This is used for nesting, but onNodeDragStop handles its own containment
            return []
        }
    })

    // Interaction sub-states
    const { resizeState, isResizeSettling, resizeLineStyle, edgeHandleStyle } = useCanvasResizeState()
    const { validateDimensions, calculateChildInverseDelta } = useCanvasResizeCalculation()

    // Selection state
    const selectionBox = reactive<SelectionBox>({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        startX: 0,
        startY: 0,
        isVisible: false
    })

    const selectedTask = ref<Task | null>(null)
    const isEditModalOpen = ref(false)

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
        const positions = new Map(involvedNodes.map(n => [n.id, { x: n.position.x, y: n.position.y }]))

        // Guard: Only proceed if we can start a new drag (operation state is idle)
        // This is the AUTHORITATIVE guard that prevents duplicate drag starts
        if (startDrag(involvedNodes.map(n => n.id), positions)) {
            // Set per-node state (idempotent - safe to call even if already DRAGGING_LOCAL)
            involvedNodes.forEach(node => setNodeState(node.id, NodeState.DRAGGING_LOCAL))
            // Set store-level drag flag ONCE per drag session
            canvasStore.isDragging = true
        }
        // If startDrag() returned false, we are already dragging - ignore duplicate event
    }

    const onNodeDrag = (_event: NodeDragEvent) => {
        // Vue Flow updates node.position automatically
    }

    // useNodeSync expects Ref<Map> from storeToRefs for proper reactivity
    const { syncNodePosition } = useNodeSync(nodeVersionMap)

    /**
     * Handle drag stop - save new absolute positions to DB
     *
     * FULLY ABSOLUTE ARCHITECTURE:
     * 1. Use computedPosition for absolute world coordinates
     * 2. Detect new parent using spatial containment
     * 3. Update store with absolute position
     * 4. Sync to DB with optimistic locking
     * 5. For groups: also sync child tasks AND child groups
     */
    const onNodeDragStop = async (event: NodeDragEvent) => {
        const { nodes: involvedNodes } = event
        canvasStore.isDragging = false

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
                const absolutePos = computeNodeAbsolutePosition(node, allGroups)
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

                // Use _rawGroups to include hidden groups in lookups
                const taskAllGroups = canvasStore._rawGroups || canvasStore.groups || []

                // 1. Compute ABSOLUTE position for containment check
                // When node has parentNode, node.position is RELATIVE, not absolute
                // computedPosition is preferred; fallback calculates from parent's absolute
                const absolutePos = computeNodeAbsolutePosition(node, taskAllGroups)

                // 2. Build spatial task with explicit dimensions for center-based containment
                const spatialTask = {
                    position: absolutePos,
                    width: (node as any).width ?? DEFAULT_TASK_WIDTH,
                    height: (node as any).height ?? DEFAULT_TASK_HEIGHT
                }

                // 3. Detect new parent using spatial containment (center inside group bounds)
                const targetGroup = getDeepestContainingGroup(spatialTask, taskAllGroups)
                const oldParentId = task.parentId
                const newParentId = targetGroup?.id ?? null

                // Skip if position didn't change meaningfully
                // (prevents drift when task just followed parent group)
                if (oldParentId === newParentId && oldParentId !== null) {
                    const oldPos = task.canvasPosition || { x: 0, y: 0 }
                    const posDelta = Math.abs(absolutePos.x - oldPos.x) + Math.abs(absolutePos.y - oldPos.y)
                    if (posDelta < 1) {
                        continue
                    }
                }

                // 4. Optimistic Store Update (Absolute position + parentId)
                taskStore.updateTask(task.id, {
                    parentId: newParentId ?? undefined,
                    canvasPosition: absolutePos,
                    positionFormat: 'absolute'
                })

                if (oldParentId !== newParentId) {
                    // REACTIVITY FIX: Bump version FIRST to trigger count recomputation
                    // Then updateSectionTaskCounts can read the fresh values from computeds
                    canvasStore.bumpTaskParentVersion()
                    updateSectionTaskCounts(oldParentId || undefined, newParentId || undefined)
                }

                // 5. Update Vue Flow parentNode to match new containment
                if (newParentId) {
                    node.parentNode = CanvasIds.groupNodeId(newParentId)
                } else {
                    node.parentNode = undefined
                }

                // 6. Apply Smart Section Properties (Today, Tomorrow, Priorities, etc.)
                if (targetGroup) {
                    const smartUpdates = getSectionProperties(targetGroup as CanvasSection)
                    if (Object.keys(smartUpdates).length > 0) {
                        console.log(`✨ [SMART-GROUP] Applying properties from "${targetGroup.name}" to task "${task.title}":`, smartUpdates)
                        taskStore.updateTask(task.id, smartUpdates)
                    }
                }

                // 7. Sync task to DB with optimistic locking
                setNodeState(task.id, NodeState.SYNCING)
                await syncNodePosition(task.id, node, taskAllGroups, 'tasks')
                setNodeState(task.id, NodeState.IDLE)
            }
        }
        endDrag(involvedNodes.map(n => n.id))
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
                resizeState.value.childStartPositions[node.id] = { ...node.position }
            }
        })
    }

    const onSectionResize = ({ sectionId: rawSectionId, event }: { sectionId: string; event: any }) => {
        const { id: sectionId } = CanvasIds.parseNodeId(rawSectionId)
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
            Object.entries(resizeState.value.childStartPositions).forEach(([childId, startPos]) => {
                const newRelPos = calculateChildInverseDelta(startPos, deltaX, deltaY)
                updateNode(childId, { position: newRelPos })
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
            console.log(`📐 [RESIZE] Origin changed by (${deltaX}, ${deltaY}), syncing descendants...`)

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

        setTimeout(() => isResizeSettling.value = false, 1000)
    }

    // --- SELECTION HANDLERS ---

    const handleTaskSelect = (task: Task, multiSelect: boolean) => {
        if (!task.id) return
        if (multiSelect) {
            canvasStore.toggleNodeSelection(task.id)
        } else {
            canvasStore.setSelectedNodes([task.id])
        }
    }

    const clearSelection = () => {
        canvasStore.setSelectedNodes([])
        selectedTask.value = null
    }

    const updateSelection = (event: MouseEvent) => {
        if (!selectionBox.isVisible) return
        const currentX = event.clientX
        const currentY = event.clientY
        selectionBox.width = Math.abs(currentX - selectionBox.startX)
        selectionBox.height = Math.abs(currentY - selectionBox.startY)
        selectionBox.x = Math.min(currentX, selectionBox.startX)
        selectionBox.y = Math.min(currentY, selectionBox.startY)
    }

    const startSelection = (event: MouseEvent) => {
        if (!event.shiftKey) return
        const { clientX, clientY } = event
        selectionBox.startX = clientX
        selectionBox.startY = clientY
        selectionBox.x = clientX
        selectionBox.y = clientY
        selectionBox.width = 0
        selectionBox.height = 0
        selectionBox.isVisible = true
        window.addEventListener('mousemove', updateSelection)
        window.addEventListener('mouseup', endSelection)
        event.preventDefault()
        event.stopPropagation()
    }

    const endSelection = (_event: MouseEvent) => {
        window.removeEventListener('mousemove', updateSelection)
        window.removeEventListener('mouseup', endSelection)
        if (!selectionBox.isVisible) return

        const viewport = getViewportFromDOM()
        const flowContainer = document.querySelector('.vue-flow__container') || document.querySelector('.canvas-container')
        if (!flowContainer) return
        const rect = flowContainer.getBoundingClientRect()

        const involvedNodes = getNodes.value
        const selectedIds: string[] = []
        const boxLeft = selectionBox.x
        const boxTop = selectionBox.y
        const boxRight = selectionBox.x + selectionBox.width
        const boxBottom = selectionBox.y + selectionBox.height

        involvedNodes.forEach(node => {
            const { x: graphX, y: graphY } = getAbsolutePositionRecursive(node, involvedNodes)
            const graphW = Number(node.dimensions?.width ?? node.width ?? 200)
            const graphH = Number(node.dimensions?.height ?? node.height ?? 100)
            const screenX = (graphX * viewport.zoom) + viewport.x + rect.left
            const screenY = (graphY * viewport.zoom) + viewport.y + rect.top
            const screenW = graphW * viewport.zoom
            const screenH = graphH * viewport.zoom

            if (node.type === 'sectionNode') {
                const isFullyContained = (
                    screenX >= boxLeft && (screenX + screenW) <= boxRight &&
                    screenY >= boxTop && (screenY + screenH) <= boxBottom
                )
                if (isFullyContained) selectedIds.push(node.id)
                return
            }

            const intersects = (
                screenX < boxRight && (screenX + screenW) > boxLeft &&
                screenY < boxBottom && (screenY + screenH) > boxTop
            )
            if (intersects) selectedIds.push(node.id)
        })

        if (selectedIds.length > 0) canvasStore.setSelectedNodes(selectedIds)
        selectionBox.isVisible = false
    }

    // --- RECURSIVE HELPERS ---

    const getAbsolutePositionRecursive = (node: Node, allNodes: Node[]): { x: number, y: number } => {
        let x = node.position.x
        let y = node.position.y
        let parentId = node.parentNode
        while (parentId) {
            const parent = allNodes.find(n => n.id === parentId)
            if (parent) {
                x += parent.position.x
                y += parent.position.y
                parentId = parent.parentNode
            } else break
        }
        return { x, y }
    }

    const getViewportFromDOM = (): { x: number, y: number, zoom: number } => {
        const transformPane = document.querySelector('.vue-flow__transformationpane') as HTMLElement
        if (!transformPane) return { x: 0, y: 0, zoom: 1 }
        const transform = transformPane.style.transform
        const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/)
        return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]), zoom: parseFloat(match[3]) } : { x: 0, y: 0, zoom: 1 }
    }

    return {
        onNodeDragStart, onNodeDrag, onNodeDragStop,
        onSectionResizeStart, onSectionResize, onSectionResizeEnd,
        selectionBox, selectedTask, isEditModalOpen, handleTaskSelect, clearSelection, startSelection, updateSelection, endSelection,
        resizeState, isResizeSettling, resizeLineStyle, edgeHandleStyle
    }
}
