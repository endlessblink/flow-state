import { ref, type Ref, nextTick } from 'vue'
import { type Node, type Edge } from '@vue-flow/core'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { NodeUpdateBatcher } from '@/utils/canvas/NodeUpdateBatcher'
import { getTaskCenter, findSmallestContainingRect } from '@/utils/geometry'
// TASK-089/TASK-142: Canvas state lock to prevent sync from overwriting user changes
import { isAnyCanvasStateLocked, getLockedTaskPosition, isGroupPositionLocked, getLockedGroupPosition } from '@/utils/canvasStateLock'
// TASK-151: Use centralized parent-child logic
import { useCanvasParentChild } from './useCanvasParentChild'

interface SyncDependencies {
    nodes: Ref<Node[]>
    edges: Ref<Edge[]>
    filteredTasks: Ref<Task[]>
    recentlyRemovedEdges: Ref<Set<string>>
    recentlyDeletedGroups: Ref<Set<string>> // TASK-146: Prevent Zombie Groups
    vueFlowRef: Ref<any>
    isHandlingNodeChange: Ref<boolean>
    isSyncing: Ref<boolean>
    isNodeDragging: Ref<boolean>
    isDragSettlingRef: Ref<boolean>
    resizeState: Ref<{ isResizing: boolean }>
    isResizeSettling: Ref<boolean>
    resourceManager: any // Type this properly if possible, or use any for now
    validateStores: () => { taskStore: boolean; canvasStore: boolean; uiStore: boolean }
    setOperationLoading: (op: string, loading: boolean) => void
    setOperationError: (type: string, message: string, retryable?: boolean) => void
    clearOperationError: () => void
}

export function useCanvasSync(deps: SyncDependencies) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const uiStore = useUIStore()

    // Internal helper for graceful store access
    const safeStoreOperation = <T>(
        operation: () => T,
        fallback: T,
        operationName: string,
        storeName: string
    ): T => {
        // Basic check - we assume stores are initialized if we're running
        try {
            return operation()
        } catch (error) {
            console.error(`❌ ${operationName} failed:`, error)
            return fallback
        }
    }

    // Clean up any stale Vue Flow DOM nodes
    // DISABLED: This function was causing all nodes to be removed due to direct DOM manipulation
    const cleanupStaleNodes = () => {
        // console.log('🧹 [DISABLED] Stale node cleanup skipped - Vue Flow manages its own DOM')
    }

    // Sync nodes from store with parent-child relationships and collapsible sections
    const syncNodes = () => {
        // Guard: Set syncing flag to prevent update loops in CanvasView
        deps.isSyncing.value = true

        try {
            // Add section nodes FIRST (so they render in background) with graceful degradation
            const sections = safeStoreOperation(
                () => canvasStore.sections || [],
                [] as CanvasSection[], // Fallback: empty sections array
                'canvas sections access',
                'canvasStore'
            )

            // Get tasks with graceful degradation
            // Use filteredTasks directly to respect sidebar filters (smart views)
            const tasks = deps.filteredTasks.value || []

            // 1. Build map of desired nodes (Goals)
            const desiredNodeMap = new Map<string, Node>()

            // TASK-151 FIX: Centralized Parent-Child Logic
            // Must be declared here to be available for both sections and tasks loops
            const {
                getSectionAbsolutePosition,
                isActuallyInsideParent,
                calculateZIndex,
                findSmallestContainingSection
            } = useCanvasParentChild(deps.nodes, canvasStore.sections)

            // --- Process Sections ---
            // TASK-131 FIX: Track existing section positions to prevent drift (like tasks)
            const existingSectionPositions = new Map<string, { x: number; y: number }>()
            deps.nodes.value.forEach(n => {
                if (n.type === 'sectionNode') {
                    existingSectionPositions.set(n.id, { x: n.position.x, y: n.position.y })
                }
            })

            sections.forEach(section => {
                // TASK-146 FIX: Prevent Zombie Groups (reappearing after delete)
                // SAFEGUARD: Check if dependency handles exist (HMR race condition protection)
                if (deps.recentlyDeletedGroups && deps.recentlyDeletedGroups.value && deps.recentlyDeletedGroups.value.has(section.id)) {
                    // console.log(`🧟 [ZOMBIE-KILL] Blocked deleted group "${section.name}" (ID: ${section.id}) from reappearing`)
                    return
                }

                // TASK-072 FIX: Always use recursive counting so parent groups include tasks from child groups
                const taskCount = canvasStore.getTaskCountInGroupRecursive(section.id, Array.isArray(deps.filteredTasks.value) ? deps.filteredTasks.value : [])

                // TASK-072: Handle nested groups - set parent node and convert to relative position
                let parentNode: string | undefined = undefined
                // SAFETY: Initialize with defaults if position is missing (legacy corruption protection)
                let position = { x: section.position?.x ?? 0, y: section.position?.y ?? 0 }
                const nodeId = `section-${section.id}`
                const existingPos = existingSectionPositions.get(nodeId)

                // TASK-151 FIX: Logic now initialized at top of function


                // TASK-141 FIX: Recursive helper REPLACED by centralized one
                // getSectionAbsolutePosition is now imported

                // TASK-141 FIX: Helper to validate if section is ACTUALLY inside its claimed parent
                // isActuallyInsideParent is now imported

                // TASK-142 FIX: If group position is locked, preserve Vue Flow's current position completely
                const isLocked = isGroupPositionLocked(section.id)
                if (isLocked && existingPos) {
                    position = { x: existingPos.x, y: existingPos.y }
                    // For locked sections, still need to determine parentNode but skip position recalc
                    // TASK-141: Validate that parentGroupId is actually correct
                    if (section.parentGroupId) {
                        const parentGroup = sections.find(s => s.id === section.parentGroupId)
                        if (parentGroup && isActuallyInsideParent(section, parentGroup)) {
                            parentNode = `section-${parentGroup.id}`
                        } else if (parentGroup) {
                            console.warn(`⚠️ [TASK-141] Section "${section.name}" has stale parentGroupId - NOT inside "${parentGroup.name}"`)
                        }
                    }
                } else if (section.parentGroupId && section.parentGroupId !== 'NONE') {
                    // TASK-141 FIX: Section has parentGroupId - its position is ALREADY RELATIVE to parent
                    const parentGroup = sections.find(s => s.id === section.parentGroupId)
                    if (parentGroup) {
                        parentNode = `section-${parentGroup.id}`
                        // Position is already stored as relative - use it directly
                        // Preserve existing Vue Flow position if available to prevent micro-jumps
                        if (existingPos) {
                            position = { x: existingPos.x, y: existingPos.y }
                        } else {
                            // Use stored relative position directly (it's already relative to parent)
                            position = { x: section.position?.x ?? 0, y: section.position?.y ?? 0 }
                        }
                    }
                } else {
                    // TASK-145 FIX: DISABLE AUTO-DETECT for groups.
                    // Relying on implicit visual containment for G2G (Group-to-Group) nesting causes jitter/jumping
                    // because it toggles between Absolute and Relative coordinates based on slight pixel changes.
                    // We now rely strictly on explicit parentGroupId set by the DragDrop handler.

                    // TASK-149 FIX: Remove 10px tolerance - it caused micro-jumps
                    // Trust the authoritative source: locked = Vue Flow, unlocked = store
                    // Position already set from store above, no fuzzy matching needed
                }

                // TASK-141 FIX: z-index based on SIZE - smaller groups render ON TOP (higher z-index)
                // REPLACED with centralized calculation
                const zIndex = calculateZIndex(section, false)
                // nodeId already defined above at line 93

                // TASK-150 FIX: Prevent group position resets during drag/settle operations
                // If we are dragging ANY node, we should trust the current visual position of the groups
                // to prevent them from snapping back/jumping if a store update comes in mid-drag.
                if (existingPos && (deps.isNodeDragging.value || deps.isDragSettlingRef.value)) {
                    position = { x: existingPos.x, y: existingPos.y }
                }

                // DEBUG: Log significant position changes for groups
                if (existingPos) {
                    const dx = Math.abs(existingPos.x - position.x)
                    const dy = Math.abs(existingPos.y - position.y)

                    if (dx > 20 || dy > 20) {
                        // Change warn to debug to reduce spam during initial settlement
                        console.debug(`⚠️ [GROUP-RESET-DEBUG] "${section.name}" position changing significantly:`, {
                            from: existingPos,
                            to: position,
                            delta: { dx: dx.toFixed(0), dy: dy.toFixed(0) },
                        })
                    }
                }

                desiredNodeMap.set(nodeId, {
                    id: nodeId,
                    type: 'sectionNode',
                    position,
                    parentNode, // TASK-072: Set parent for nested groups
                    data: {
                        id: section.id, // BUG-034: Add id for component lookup
                        name: section.name, // BUG-034: Add name for display
                        label: section.name,
                        section,
                        width: section.position?.width ?? 300,
                        height: section.position?.height ?? 200,
                        isCollapsed: section.isCollapsed || false,
                        theme: (section as unknown as { theme?: string }).theme || 'default',
                        taskCount, // BUG-034: Add task count (now uses recursive for nested)
                        type: section.type, // BUG-034: Add type for styling
                        color: section.color // FIX: Add color for reactivity
                    },
                    style: {
                        width: `${Number.isFinite(section.position?.width) ? section.position?.width : 300}px`,
                        height: `${Number.isFinite(section.position?.height) ? section.position?.height : 200}px`,
                        zIndex // TASK-072: Deeper nested groups render above parents
                    },
                    draggable: true, // Allow dragging sections
                    selectable: true,
                    connectable: false,
                    expandParent: false // Don't expand parent nodes
                })
            })

            // --- Process Tasks ---
            // BUG-002 FIX: Build map of existing node parentNode relationships BEFORE processing
            // This preserves parent-child relationships established during drag operations
            const existingNodeParents = new Map<string, string | undefined>()
            // BUG-003 FIX: Also track existing node POSITIONS to preserve them when locked
            const existingNodePositions = new Map<string, { x: number; y: number }>()
            deps.nodes.value.forEach(n => {
                if (n.type === 'taskNode') {
                    existingNodeParents.set(n.id, n.parentNode)
                    existingNodePositions.set(n.id, { x: n.position.x, y: n.position.y })
                }
            })

            // PERFORMANCE FIX: Pre-compute sectionRects ONCE outside the tasks loop
            // This avoids O(n*m) array allocations where n=tasks, m=sections
            const sectionRects = sections.map(s => ({
                ...s,
                // SAFETY: Safeguard against undefined position (legacy data)
                x: s.position?.x ?? 0,
                y: s.position?.y ?? 0,
                width: s.position?.width ?? 300,
                height: s.position?.height ?? 200
            }))

            tasks.forEach(task => {
                // Only verify task has canvas position
                if (task.canvasPosition) {
                    // Find parent section
                    let parentNode = undefined
                    // TASK-142 FIX: Check if position is locked FIRST
                    // When locked, ALWAYS preserve Vue Flow's current position - no recalculation
                    const lockedPosition = getLockedTaskPosition(task.id)
                    const existingPos = existingNodePositions.get(task.id)
                    const existingParent = existingNodeParents.get(task.id)
                    const taskExistsInNodes = existingNodeParents.has(task.id)

                    // TASK-142 DEBUG: Log lock status for tasks that might be reset
                    if (taskExistsInNodes && existingPos && !lockedPosition) {
                        console.log(`🔓 [TASK-142] Task ${task.id.substring(0, 8)} has NO LOCK - will recalculate position`)
                    }

                    // TASK-142: If locked AND existing node exists, completely preserve current state
                    // This prevents ALL position resets during user interaction
                    if (lockedPosition && taskExistsInNodes && existingPos) {
                        desiredNodeMap.set(task.id, {
                            id: task.id,
                            type: 'taskNode',
                            position: { x: existingPos.x, y: existingPos.y },
                            data: { task: { ...task } },
                            parentNode: existingParent, // Preserve current parent
                            extent: undefined,
                            expandParent: false,
                            zIndex: 1000, // TASK-141: Tasks always above groups (groups use 1-99)
                            draggable: true,
                            connectable: true,
                            selectable: true
                        })
                        return // Skip all further processing for this locked task
                    }

                    let position = lockedPosition
                        ? { x: lockedPosition.x, y: lockedPosition.y }
                        : { ...task.canvasPosition }

                    // BUG-002 FIX: Check if this task already exists in current nodes
                    // If so, preserve its parentNode state (prevents multi-drag position corruption)
                    let skipContainmentCalc = false

                    if (taskExistsInNodes) {
                        if (existingParent) {
                            // Task has a parentNode - preserve the relationship
                            const sectionId = existingParent.replace('section-', '')
                            const section = sections.find(s => s.id === sectionId)
                            if (section) {
                                parentNode = existingParent

                                // TASK-149 FIX: Use Vue Flow position if it exists (it's authoritative for visual state)
                                // Otherwise calculate relative from absolute
                                if (existingPos) {
                                    position = { x: existingPos.x, y: existingPos.y }
                                } else {
                                    // No existing Vue Flow position - calculate relative from absolute
                                    const relX = position.x - section.position.x
                                    const relY = position.y - section.position.y
                                    if (Number.isFinite(relX) && Number.isFinite(relY)) {
                                        position = { x: relX, y: relY }
                                    }
                                }
                                skipContainmentCalc = true
                            }
                            // If section no longer exists, fall through to containment check
                        } else {
                            // Task exists at ROOT level (no parentNode) - keep it at root
                            // TASK-149 FIX: Vue Flow position is authoritative for existing nodes
                            if (existingPos) {
                                position = { x: existingPos.x, y: existingPos.y }
                            }
                            // Don't recalculate containment - user intentionally placed it outside sections
                            skipContainmentCalc = true
                        }
                    }

                    // Only calculate containment for NEW tasks (not in current nodes)
                    if (!skipContainmentCalc) {
                        // Check if task belongs to a section visually
                        // BUG-034 FIX: Use task CENTER for bounds check (consistent with getTasksInSectionBounds)
                        const TASK_WIDTH = 220
                        const TASK_HEIGHT = 100
                        const center = {
                            x: position.x + TASK_WIDTH / 2,
                            y: position.y + TASK_HEIGHT / 2
                        }

                        // TASK-072 FIX: Find the MOST SPECIFIC (smallest/nested) section that contains the task
                        // REPLACED: Use findSmallestContainingSection from centralized logic
                        // We pass the full task rect for robust checking
                        const section = findSmallestContainingSection({
                            x: position.x,
                            y: position.y,
                            width: TASK_WIDTH, // 220
                            height: TASK_HEIGHT // 100
                        })

                        if (section) {
                            // Task is visually inside a section - make it a child
                            parentNode = `section-${section.id}`
                            // BUG-034 FIX: Convert ABSOLUTE to RELATIVE for Vue Flow parent-child system
                            const relX = position.x - section.position.x
                            const relY = position.y - section.position.y

                            // Fix: Only assign parent if relative calculation is valid
                            // This prevents tasks from stacking at (0,0) relative to group if calculation fails
                            if (Number.isFinite(relX) && Number.isFinite(relY)) {
                                parentNode = `section-${section.id}`
                                position = { x: relX, y: relY }
                            }
                            // Else: Keep position as Absolute (from task.canvasPosition). Keep parentNode as undefined.
                        }
                    }

                    desiredNodeMap.set(task.id, {
                        id: task.id,
                        type: 'taskNode',
                        position,
                        // BUG-FIX: Spread task object to create new reference
                        // This ensures v-memo detects changes when task properties (status, priority, etc.) are updated
                        // Without this, task mutations don't trigger re-renders because same object reference is reused
                        data: { task: { ...task } },
                        parentNode, // Set parent if found
                        extent: undefined, // Allow free movement - we use absolute coordinates (BUG-034 fix)
                        expandParent: false, // Don't expand parent on drag
                        zIndex: 1000, // TASK-141: Tasks always above groups (groups use 1-99)
                        draggable: true,
                        connectable: true,
                        selectable: true
                    })
                }
            })

            // 2. Diff & Patch Logic
            const currentNodes = [...deps.nodes.value]
            const nodesToRemove = new Set<string>()
            const nodesToAdd: Node[] = []
            const nodesToUpdate: { index: number; node: Node }[] = []

            // Check existing nodes
            currentNodes.forEach((node, index) => {
                const desired = desiredNodeMap.get(node.id)
                if (!desired) {
                    // Node no longer exists
                    nodesToRemove.add(node.id)
                } else {
                    // Node exists - check for updates (Simple Update)
                    // We always update data/position to ensure sync, providing Vue Flow diff handles the DOM
                    // Optimization: We could deep compare here, but Vue Flow handles minimal DOM updates if refs are stable
                    nodesToUpdate.push({ index, node: desired })
                    desiredNodeMap.delete(node.id) // Mark as processed
                }
            })

            // Remaining nodes in map are NEW
            for (const newNode of desiredNodeMap.values()) {
                nodesToAdd.push(newNode)
            }

            // 3. Apply Updates safely
            let hasChanges = false

            // Remove invalid nodes FIRST
            if (nodesToRemove.size > 0) {
                deps.nodes.value = deps.nodes.value.filter(n => !nodesToRemove.has(n.id))
                hasChanges = true
            }

            // Apply updates using ID-based lookup (BUG-011 FIX)
            // IMPORTANT: After removal, indices in nodesToUpdate are no longer valid
            // We must look up nodes by ID, not by index
            nodesToUpdate.forEach(({ node }) => {
                const target = deps.nodes.value.find(n => n.id === node.id)
                if (target) {
                    let changed = false

                    // 1. Position optimization
                    if (Math.abs(target.position.x - node.position.x) > 0.01 ||
                        Math.abs(target.position.y - node.position.y) > 0.01) {
                        target.position = node.position
                        changed = true
                    }

                    // 2. Data optimization (Deep compare for sections, Reference for tasks)
                    if (node.type === 'taskNode') {
                        // For tasks, we compare specific properties instead of full object spread every time
                        // This prevents Vue Flow from re-rendering the custom node if only unrelated props changed
                        const oldTask = target.data.task as Task
                        const newTask = node.data.task as Task

                        if (oldTask.id !== newTask.id ||
                            oldTask.status !== newTask.status ||
                            oldTask.priority !== newTask.priority ||
                            oldTask.title !== newTask.title ||
                            oldTask.updatedAt !== newTask.updatedAt) {
                            target.data = node.data
                            changed = true
                        }
                    } else {
                        // Section nodes: compare name and dimensions
                        if (target.data.label !== node.data.label ||
                            target.data.width !== node.data.width ||
                            target.data.height !== node.data.height ||
                            target.data.isCollapsed !== node.data.isCollapsed) {
                            target.data = node.data
                            changed = true
                        }
                    }

                    // 3. Metadata properties
                    if (target.parentNode !== node.parentNode) {
                        target.parentNode = node.parentNode
                        changed = true
                    }
                    if (target.zIndex !== node.zIndex) {
                        target.zIndex = node.zIndex
                        changed = true
                    }

                    if (changed) hasChanges = true
                }
            })

            // Add new nodes
            if (nodesToAdd.length > 0) {
                deps.nodes.value = [...deps.nodes.value, ...nodesToAdd]
                hasChanges = true
            }

            if (hasChanges) {
                // console.log(`🔄 [SYNC] Smart Sync: +${nodesToAdd.length}, -${nodesToRemove.size}, ~${nodesToUpdate.length} updates`)
            }

            // Clean up any stale Vue Flow DOM nodes after sync
            nextTick(() => {
                try {
                    cleanupStaleNodes()
                } catch (cleanupError) {
                    console.error('❌ Failed to cleanup stale nodes:', cleanupError)
                }
            })
        } catch (error) {
            console.error('❌ Critical error in syncNodes():', error)
            // Attempt to recover by clearing nodes to force re-render
            console.log('🔧 Recovery: Clearing nodes to force re-render')
        } finally {
            // Always reset syncing flag
            deps.isSyncing.value = false
        }
    }

    // Sync edges from store
    const syncEdges = () => {
        try {
            const allEdges: Edge[] = []

            // Get tasks with graceful degradation
            const tasks = safeStoreOperation(
                () => taskStore.tasks || [],
                [] as Task[], // Fallback: empty tasks array
                'tasks access for syncEdges',
                'taskStore'
            )

            const taskIds = new Set(tasks.map(t => t.id))

            tasks.forEach((task: Task) => {
                if (task.dependsOn && task.dependsOn.length > 0) {
                    task.dependsOn.forEach((dependencyId: string) => {
                        // Verify dependency exists and is valid
                        if (taskIds.has(dependencyId)) {
                            const edgeId = `e-${dependencyId}-${task.id}`

                            // Check if this edge was recently removed by user action
                            if (deps.recentlyRemovedEdges.value.has(edgeId)) {
                                return
                            }

                            allEdges.push({
                                id: edgeId,
                                source: dependencyId,
                                target: task.id,
                                type: 'smoothstep', // Default edge type
                                animated: false,
                                style: { stroke: '#6366f1', strokeWidth: 2 },
                                data: {
                                    sourceTask: tasks.find((t: Task) => t.id === dependencyId),
                                    targetTask: task
                                },
                                // Enable interactivity
                                updatable: true,
                                selectable: true,
                                focusable: true
                            })
                        }
                    })
                }
            })

            // Validate edges - check that source and target nodes actually exist
            const currentNodeIds = new Set(deps.nodes.value.map(n => n.id))
            const validEdges = allEdges.filter(edge => {
                if (!edge || !edge.id || !edge.source || !edge.target) {
                    console.warn('⚠️ Invalid edge detected during sync:', edge)
                    return false
                }
                // Verify both source and target nodes exist
                if (!currentNodeIds.has(edge.source) || !currentNodeIds.has(edge.target)) {
                    // Silently filter out - don't spam console
                    return false
                }
                return true
            })

            deps.edges.value = validEdges
            // BUG-026: Disabled excessive logging - fires hundreds of times per second
            // console.log(`🔗 [SYNC-EDGES] Synced ${validEdges.length} edges. Task IDs present: ${taskIds.size}`)
        } catch (error) {
            console.error('❌ Critical error in syncEdges():', error)
            console.log('🔧 Recovery: Keeping existing edges array unchanged')
        }
    }

    // Optimized sync functions using the batching system
    const _nodeUpdateBatcher: NodeUpdateBatcher | null = new NodeUpdateBatcher(deps.vueFlowRef)
    deps.resourceManager.setNodeBatcher(_nodeUpdateBatcher)

    const batchedSyncNodes = (priority: 'high' | 'normal' | 'low' = 'normal') => {
        if (_nodeUpdateBatcher) {
            _nodeUpdateBatcher.schedule(() => {
                // TASK-089: Removed isAnyCanvasStateLocked() global check
                // This was blocking ALL updates (including status changes/new tasks) if anything was locked.
                // syncNodes() now handles individual locks internally.
                if (!deps.isHandlingNodeChange.value &&
                    !deps.isSyncing.value &&
                    !deps.isNodeDragging.value &&
                    !deps.isDragSettlingRef.value &&
                    !deps.resizeState.value.isResizing &&
                    !deps.isResizeSettling.value) {
                    syncNodes()
                }
            }, priority)
        } else {
            // TASK-089: Removed global lock check here too
            syncNodes()
        }
    }

    const batchedSyncEdges = (priority: 'high' | 'normal' | 'low' = 'normal') => {
        if (_nodeUpdateBatcher) {
            _nodeUpdateBatcher.schedule(() => {
                if (!deps.isHandlingNodeChange.value && !deps.isSyncing.value) {
                    syncEdges()
                }
            }, priority)
        } else {
            syncEdges()
        }
    }

    // System restart mechanism for critical failures
    const performSystemRestart = async () => {
        console.log('🔄 [SYSTEM] Performing critical system restart...')
        deps.setOperationLoading('loading', true)
        deps.setOperationError('System Restart', 'Restarting application...', false)

        try {
            // Clear all reactive state
            deps.clearOperationError()
            deps.nodes.value = []
            deps.edges.value = []
            deps.recentlyRemovedEdges.value.clear()

            // Reset store states safely
            const health = deps.validateStores()
            if (health.canvasStore) {
                canvasStore.setSelectedNodes([])
                canvasStore.selectedNodeIds = []
            }

            // Reset reactive states
            deps.isHandlingNodeChange.value = false
            deps.isSyncing.value = false
            // We can't clear all operationLoading keys here easily without ref access to the object,
            // but setOperationLoading handles the 'loading' key which is most important.

            // TASK-136: PouchDB database verification removed - app uses Supabase

            // Resync data
            // console.log('🔄 [SYSTEM] Resynchronizing data...')
            // if (isFirefox) console.log(`🦊 [SYNC] Firefox/Zen detected - using optimized batch settings (${batchSize})`)
            await nextTick()
            syncNodes()
            syncEdges()

            deps.setOperationLoading('loading', false)
            console.log('✅ [SYSTEM] System restart completed successfully')

            // Show success notification
            if ((window as any).__notificationApi) {
                (window as any).__notificationApi({
                    type: 'success',
                    title: 'System Restarted',
                    content: 'Application has been successfully restarted and all systems are operational.'
                })
            }

            return true
        } catch (error) {
            deps.setOperationError('System Restart', `Critical restart failed: ${error instanceof Error ? error.message : String(error)}`, true)
            deps.setOperationLoading('loading', false)
            console.error('❌ [SYSTEM] Critical restart failed:', error)

            // Show error notification
            if ((window as any).__notificationApi) {
                (window as any).__notificationApi({
                    type: 'error',
                    title: 'System Restart Failed',
                    content: 'Unable to restart the application. Please refresh the page manually.'
                })
            }

            return false
        }
    }

    /**
     * Surgically remove a single task node and its connected edges.
     * This prevents the position reset that occurs with full syncNodes().
     *
     * @param taskId - The ID of the task node to remove
     * @returns true if node was found and removed, false otherwise
     *
     * @see TASK-131: Canvas View Stabilization
     * @see BUG-020: Task Positions Reset on Deletion
     */
    const removeTaskNode = (taskId: string): boolean => {
        // Find and remove the node
        const nodeIndex = deps.nodes.value.findIndex(n => n.id === taskId)
        if (nodeIndex === -1) {
            console.log(`🔍 [SURGICAL-DELETE] Task node ${taskId} not found (may be in inbox)`)
            return false
        }

        // Remove the node
        deps.nodes.value.splice(nodeIndex, 1)

        // Remove any edges connected to this node (both source and target)
        const edgesBefore = deps.edges.value.length
        deps.edges.value = deps.edges.value.filter(
            e => e.source !== taskId && e.target !== taskId
        )
        const edgesRemoved = edgesBefore - deps.edges.value.length

        console.log(`✂️ [SURGICAL-DELETE] Removed task node ${taskId} and ${edgesRemoved} connected edges`)
        return true
    }

    /**
     * Surgically remove multiple task nodes at once.
     * More efficient than calling removeTaskNode() in a loop.
     *
     * @param taskIds - Array of task IDs to remove
     * @returns Number of nodes actually removed
     */
    const removeTaskNodes = (taskIds: string[]): number => {
        const taskIdSet = new Set(taskIds)
        const nodesBefore = deps.nodes.value.length

        // Filter out the nodes to delete
        deps.nodes.value = deps.nodes.value.filter(n => !taskIdSet.has(n.id))

        // Remove all edges connected to any of the deleted nodes
        deps.edges.value = deps.edges.value.filter(
            e => !taskIdSet.has(e.source) && !taskIdSet.has(e.target)
        )

        const nodesRemoved = nodesBefore - deps.nodes.value.length
        console.log(`✂️ [SURGICAL-BULK-DELETE] Removed ${nodesRemoved} task nodes`)
        return nodesRemoved
    }

    return {
        syncNodes,
        syncEdges,
        batchedSyncNodes,
        batchedSyncEdges,
        performSystemRestart,
        cleanupStaleNodes, // Exported just in case, though mostly internal
        removeTaskNode,
        removeTaskNodes
    }
}
