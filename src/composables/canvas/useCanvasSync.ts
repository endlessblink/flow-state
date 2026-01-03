import { ref, type Ref, nextTick } from 'vue'
import { type Node, type Edge } from '@vue-flow/core'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { NodeUpdateBatcher } from '@/utils/canvas/NodeUpdateBatcher'
// TASK-089: Canvas state lock to prevent sync from overwriting user changes
import { isAnyCanvasStateLocked } from '@/utils/canvasStateLock'

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
                        position = {
                            x: section.position.x - parentGroup.position.x,
                            y: section.position.y - parentGroup.position.y
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
                        type: section.type // BUG-034: Add type for styling
                    },
                    style: {
                        width: `${section.position.width || 300}px`,
                        height: `${section.position.height || 200}px`,
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
            tasks.forEach(task => {
                // Only verify task has canvas position
                if (task.canvasPosition) {
                    // Find parent section
                    let parentNode = undefined
                    let position = { ...task.canvasPosition }

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
                        // Vue Flow expects position to be RELATIVE when parentNode is set
                        // See: https://github.com/bcakmakoglu/vue-flow/discussions/1202
                        position = {
                            x: position.x - section.position.x,
                            y: position.y - section.position.y
                        }
                    }

                    desiredNodeMap.set(task.id, {
                        id: task.id,
                        type: 'taskNode',
                        position,
                        data: { task },
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

            // Remove invalid nodes
            if (nodesToRemove.size > 0) {
                // Filter in-place reduction
                const filtered = currentNodes.filter(n => !nodesToRemove.has(n.id))
                deps.nodes.value = filtered
                hasChanges = true
            }

            // Apply updates
            nodesToUpdate.forEach(({ index, node }) => {
                // We update the existing object properties to preserve component instance if possible
                // OR we replace the object at the index if needed.
                // Vue Flow generally tracks by ID.
                const target = deps.nodes.value.find(n => n.id === node.id)
                if (target) {
                    let changed = false
                    // Update Position
                    if (Math.abs(target.position.x - node.position.x) > 0.1 || Math.abs(target.position.y - node.position.y) > 0.1) {
                        target.position = node.position
                        changed = true
                    }
                    // Update Data (Reactive replacement)
                    // Simple JSON compare or just assignment? Assignment is cheaper than full compare usually
                    // But to avoid watchers firing, maybe compare?
                    // Let's rely on shallow checks or just assign.
                    // Ideally we merge data.
                    if (JSON.stringify(target.data) !== JSON.stringify(node.data)) {
                        target.data = node.data
                        changed = true
                    }
                    // Parenting
                    if (target.parentNode !== node.parentNode) {
                        target.parentNode = node.parentNode
                        changed = true
                    }
                    // ZIndex
                    if (target.zIndex !== node.zIndex) {
                        target.zIndex = node.zIndex
                        changed = true
                    }
                    // Style
                    if (JSON.stringify(target.style) !== JSON.stringify(node.style)) {
                        target.style = node.style
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

            tasks.forEach(task => {
                if (task.dependsOn && task.dependsOn.length > 0) {
                    task.dependsOn.forEach(dependencyId => {
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
                                    sourceTask: tasks.find(t => t.id === dependencyId),
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
    let _nodeUpdateBatcher: NodeUpdateBatcher | null = new NodeUpdateBatcher(deps.vueFlowRef)
    deps.resourceManager.setNodeBatcher(_nodeUpdateBatcher)

    const batchedSyncNodes = (priority: 'high' | 'normal' | 'low' = 'normal') => {
        if (_nodeUpdateBatcher) {
            _nodeUpdateBatcher.schedule(() => {
                // TASK-089: Added isAnyCanvasStateLocked() check
                if (!deps.isHandlingNodeChange.value &&
                    !deps.isSyncing.value &&
                    !deps.isNodeDragging.value &&
                    !deps.isDragSettlingRef.value &&
                    !deps.resizeState.value.isResizing &&
                    !deps.isResizeSettling.value &&
                    !isAnyCanvasStateLocked()) {
                    syncNodes()
                }
            }, priority)
        } else {
            // TASK-089: Guard fallback path as well
            if (!isAnyCanvasStateLocked()) {
                syncNodes()
            } else {
                console.log('🛡️ [TASK-089] syncNodes blocked in batchedSyncNodes fallback - canvas state locked')
            }
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
