import { ref, type Ref, nextTick } from 'vue'
import { type Node, type Edge } from '@vue-flow/core'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { NodeUpdateBatcher } from '@/utils/canvas/NodeUpdateBatcher'
// TASK-089: Canvas state lock to prevent sync from overwriting user changes
import { isAnyCanvasStateLocked, getLockedTaskPosition } from '@/utils/canvasStateLock'

interface SyncDependencies {
    nodes: Ref<Node[]>
    edges: Ref<Edge[]>
    filteredTasks: Ref<Task[]>
    recentlyRemovedEdges: Ref<Set<string>>
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

            // --- Process Sections ---
            sections.forEach(section => {
                // TASK-072 FIX: Always use recursive counting so parent groups include tasks from child groups
                const taskCount = canvasStore.getTaskCountInGroupRecursive(section.id, Array.isArray(deps.filteredTasks.value) ? deps.filteredTasks.value : [])

                // TASK-072: Handle nested groups - set parent node and convert to relative position
                let parentNode: string | undefined = undefined
                let position = { x: section.position.x, y: section.position.y }

                if (section.parentGroupId) {
                    const parentGroup = sections.find(s => s.id === section.parentGroupId)
                    if (parentGroup) {
                        parentNode = `section-${parentGroup.id}`
                        // Convert absolute position to relative (like we do for tasks)
                        const relX = section.position.x - parentGroup.position.x
                        const relY = section.position.y - parentGroup.position.y

                        position = {
                            x: Number.isFinite(relX) ? relX : 0,
                            y: Number.isFinite(relY) ? relY : 0
                        }
                    }
                }

                // Calculate z-index based on nesting depth (deeper = higher z-index)
                const getDepth = (groupId: string, depth = 0): number => {
                    const group = sections.find(s => s.id === groupId)
                    if (!group || !group.parentGroupId || depth > 10) return depth
                    return getDepth(group.parentGroupId, depth + 1)
                }
                const zIndex = getDepth(section.id)
                const nodeId = `section-${section.id}`

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
                        width: section.position.width || 300,
                        height: section.position.height || 200,
                        isCollapsed: section.isCollapsed || false,
                        theme: (section as unknown as { theme?: string }).theme || 'default',
                        taskCount, // BUG-034: Add task count (now uses recursive for nested)
                        type: section.type, // BUG-034: Add type for styling
                        color: section.color // FIX: Add color for reactivity
                    },
                    style: {
                        width: `${Number.isFinite(section.position.width) ? section.position.width : 300}px`,
                        height: `${Number.isFinite(section.position.height) ? section.position.height : 200}px`,
                        zIndex // TASK-072: Deeper nested groups render above parents
                    },
                    draggable: true, // Allow dragging sections
                    selectable: true,
                    connectable: false,
                    // Use efficient resize/drag handling
                    dragHandle: '.section-header', // Only drag from header
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

            tasks.forEach(task => {
                // Only verify task has canvas position
                if (task.canvasPosition) {
                    // Find parent section
                    let parentNode = undefined
                    // TASK-089 FIX: Respect locked positions to prevent position resets during deletion
                    // If a task's position is locked (recently dragged), use the locked position
                    const lockedPosition = getLockedTaskPosition(task.id)
                    let position = lockedPosition
                        ? { x: lockedPosition.x, y: lockedPosition.y }
                        : { ...task.canvasPosition }

                    // BUG-002 FIX: Check if this task already exists in current nodes
                    // If so, preserve its parentNode state (prevents multi-drag position corruption)
                    // Use .has() to check existence - handles both tasks WITH parentNode AND root-level tasks
                    const taskExistsInNodes = existingNodeParents.has(task.id)
                    const existingParent = existingNodeParents.get(task.id)
                    let skipContainmentCalc = false

                    if (taskExistsInNodes) {
                        if (existingParent) {
                            // Task has a parentNode - preserve the relationship
                            const sectionId = existingParent.replace('section-', '')
                            const section = sections.find(s => s.id === sectionId)
                            if (section) {
                                parentNode = existingParent

                                // BUG-003 FIX: If position is locked, preserve EXISTING node position
                                // This prevents drift when converting absolute→relative with changed section position
                                // The existing Vue Flow node already has the correct relative position
                                const existingPos = existingNodePositions.get(task.id)
                                if (lockedPosition && existingPos) {
                                    position = { x: existingPos.x, y: existingPos.y }
                                } else {
                                    // No lock - recalculate relative position from absolute
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
                            // BUG-003 FIX: Preserve existing position when locked
                            const existingPos = existingNodePositions.get(task.id)
                            if (lockedPosition && existingPos) {
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
                        const taskCenterX = position.x + TASK_WIDTH / 2
                        const taskCenterY = position.y + TASK_HEIGHT / 2

                        // TASK-072 FIX: Find the MOST SPECIFIC (smallest/nested) section that contains the task
                        // If task is inside both parent and nested group, prefer the nested group
                        const containingSections = sections.filter(s => {
                            const sx = s.position.x
                            const sy = s.position.y
                            const sw = s.position.width || 300
                            const sh = s.position.height || 200
                            return taskCenterX >= sx && taskCenterX <= sx + sw &&
                                taskCenterY >= sy && taskCenterY <= sy + sh
                        })
                        // Sort by area (smallest first) and pick the smallest containing section
                        // Smaller sections are more specific (nested groups are smaller than their parents)
                        const section = containingSections.length > 0
                            ? containingSections.sort((a, b) => {
                                const areaA = (a.position.width || 300) * (a.position.height || 200)
                                const areaB = (b.position.width || 300) * (b.position.height || 200)
                                return areaA - areaB
                            })[0]
                            : undefined

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
                        zIndex: 10, // Tasks always above sections
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

            // Validate edges
            const validEdges = allEdges.filter(edge => {
                if (!edge || !edge.id || !edge.source || !edge.target) {
                    console.warn('⚠️ Invalid edge detected during sync:', edge)
                    return false
                }
                return true
            })

            deps.edges.value = validEdges
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

            // Reinitialize database connection
            console.log('🔄 [SYSTEM] Reinitializing database connection...')
            const windowDb = (window as unknown as { pomoFlowDb?: { info: () => Promise<{ db_name: string; doc_count: number }> } }).pomoFlowDb
            if (typeof window !== 'undefined' && windowDb) {
                try {
                    const dbInfo = await windowDb.info()
                    console.log('✅ [SYSTEM] Database connection verified:', {
                        name: dbInfo.db_name,
                        doc_count: dbInfo.doc_count
                    })
                } catch (dbError) {
                    console.error('❌ [SYSTEM] Database verification failed:', dbError)
                    throw new Error('Database connection could not be verified')
                }
            }

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

    return {
        syncNodes,
        syncEdges,
        batchedSyncNodes,
        batchedSyncEdges,
        performSystemRestart,
        cleanupStaleNodes // Exported just in case, though mostly internal
    }
}
