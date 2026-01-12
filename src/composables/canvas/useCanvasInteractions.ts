import { ref, reactive, computed, type Ref } from 'vue'
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
                // Use _rawGroups to include hidden groups
                const groupsForLookup = canvasStore._rawGroups || canvasStore.groups || []
                const group = groupsForLookup.find(g => g.id === groupId)
                if (!group) continue

                // Compute absolute position for the group
                // Use _rawGroups to include hidden groups in position lookups
                const allGroups = canvasStore._rawGroups || canvasStore.groups || []
                const absolutePos = computeNodeAbsolutePosition(node, allGroups)

                // Build spatial representation of the group for containment check
                const groupWidth = group.position.width
                const groupHeight = group.position.height

                const spatialGroup = {
                    position: absolutePos,
                    width: groupWidth,
                    height: groupHeight,
                }

                // Find deepest containing group, excluding this group itself
                const targetParent = getDeepestContainingGroup(
                    spatialGroup,
                    allGroups,
                    groupId // exclude this group from being its own parent
                )

                // Get old parent for comparison
                const oldParentGroupId = group.parentGroupId ?? null

                // DEBUG: Log group drop details for child→root transition debugging
                console.log('[DEBUG GROUP DROP]', {
                    groupId,
                    groupName: group.name,
                    oldParentGroupId,
                    targetParentId: targetParent?.id ?? null,
                    center: {
                        x: spatialGroup.position.x + spatialGroup.width / 2,
                        y: spatialGroup.position.y + spatialGroup.height / 2,
                    },
                })

                // ================================================================
                // CYCLE PREVENTION: Don't allow cyclic parent assignments
                // ================================================================
                let newParentGroupId = targetParent?.id ?? null

                // 1) Don't allow a group to be its own parent (redundant but explicit)
                if (newParentGroupId === groupId) {
                    console.warn('[GROUP] Prevented self-parenting', { groupId })
                    newParentGroupId = null
                }

                // 2) Don't allow making a descendant the parent (would create a cycle)
                if (newParentGroupId) {
                    const descendants = collectDescendantGroups(groupId, allGroups)
                    const descendantIds = new Set(descendants.map(d => d.id))
                    if (descendantIds.has(newParentGroupId)) {
                        console.warn('[GROUP] Prevented cyclic parent assignment', {
                            groupId,
                            groupName: group.name,
                            attemptedParentId: newParentGroupId,
                            attemptedParentName: targetParent?.name,
                            descendantIds: Array.from(descendantIds),
                        })
                        // Keep old parent to avoid cycle
                        newParentGroupId = oldParentGroupId
                    }
                }

                // ================================================================
                // POSITION JUMP FIX: Adjust node.position BEFORE setting parentNode
                // ================================================================
                // When parent changes, Vue Flow immediately interprets node.position
                // as relative to the new parent. We must adjust the position value
                // so the visual position stays the same.
                //
                // - absolutePos: where the group visually IS (absolute world coords)
                // - node.position: what Vue Flow uses (relative to parentNode)
                //
                // To keep visual position after parent change:
                // - If going INTO a parent: newRelative = absolute - parentAbsolute
                // - If going to ROOT: newRelative = absolute (no offset)
                if (oldParentGroupId !== newParentGroupId) {
                    if (newParentGroupId) {
                        // Going into a parent group - convert to relative position
                        const newParentAbsolute = getGroupAbsolutePosition(newParentGroupId, allGroups)
                        const newRelativePos = {
                            x: absolutePos.x - newParentAbsolute.x,
                            y: absolutePos.y - newParentAbsolute.y
                        }
                        // Guard against NaN values
                        if (isFinite(newRelativePos.x) && isFinite(newRelativePos.y)) {
                            node.position = newRelativePos
                        }
                    } else {
                        // Going to root (no parent) - use absolute position
                        node.position = absolutePos
                    }
                }

                // Update Vue Flow node's parentNode AND extent to match
                // MUST happen AFTER position adjustment to avoid visual jump
                // CRITICAL: Both parentNode AND extent must be set together!
                // - When going INTO a parent: set both parentNode and extent: 'parent'
                // - When going to ROOT: clear both to undefined
                if (newParentGroupId) {
                    node.parentNode = CanvasIds.groupNodeId(newParentGroupId)
                    node.extent = 'parent'
                } else {
                    node.parentNode = undefined
                    node.extent = undefined
                }

                // Update store with ABSOLUTE position AND parentGroupId
                canvasStore.updateSection(groupId, {
                    position: {
                        x: absolutePos.x,
                        y: absolutePos.y,
                        width: spatialGroup.width,
                        height: spatialGroup.height,
                    },
                    parentGroupId: newParentGroupId,
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
                    updateSectionTaskCounts(oldParentId || undefined, newParentId || undefined)
                }

                // 5. Update Vue Flow parentNode to match new containment
                if (newParentId) {
                    node.parentNode = CanvasIds.groupNodeId(newParentId)
                } else {
                    node.parentNode = undefined
                }

                // 6. Sync task to DB with optimistic locking
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
