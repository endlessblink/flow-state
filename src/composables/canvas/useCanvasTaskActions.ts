import { type Ref, nextTick } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasModalsStore } from '@/stores/canvas/modals'
import { markGroupDeleted, confirmGroupDeleted } from '@/utils/deletedGroupsTracker'
import { storeToRefs } from 'pinia'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { CANVAS } from '@/constants/canvas'



export interface TaskActionsDeps {
    syncNodes: (tasks?: Task[]) => void
    batchSyncNodes?: (priority?: 'high' | 'normal' | 'low') => void
    closeCanvasContextMenu: () => void
    screenToFlowCoordinate: (position: { x: number; y: number }) => { x: number; y: number }
    recentlyDeletedGroups?: Ref<Set<string>>
    undoHistory: any
}

export function useCanvasTaskActions(deps: TaskActionsDeps) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const modalsStore = useCanvasModalsStore()
    const { undoHistory } = deps

    const {
        isBulkDeleteModalOpen,
        bulkDeleteItems,
        bulkDeleteIsPermanent,
        isQuickTaskCreateOpen,
        quickTaskPosition
    } = storeToRefs(modalsStore)

    const removeGhostNodeRef = (id: string) => {
        if (canvasStore.nodes) {
            const nodeId = CanvasIds.groupNodeId(id)
            canvasStore.nodes = canvasStore.nodes.filter(n => n.id !== nodeId)
        }
    }

    const createTaskHere = (screenPos?: { x: number; y: number }) => {
        try {
            const vueFlowElement = document.querySelector('.vue-flow')
            if (!vueFlowElement) {
                quickTaskPosition.value = { x: 0, y: 0 }
                deps.closeCanvasContextMenu()
                isQuickTaskCreateOpen.value = true
                return
            }

            let finalPos = screenPos
            if (!finalPos) {
                const rect = vueFlowElement.getBoundingClientRect()
                finalPos = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                }
            }

            const flowCoords = deps.screenToFlowCoordinate(finalPos)
            if (!Number.isFinite(flowCoords.x) || !Number.isFinite(flowCoords.y)) {
                quickTaskPosition.value = { x: 200, y: 200 }
                deps.closeCanvasContextMenu()
                isQuickTaskCreateOpen.value = true
                return
            }

            quickTaskPosition.value = flowCoords
            deps.closeCanvasContextMenu()
            isQuickTaskCreateOpen.value = true

        } catch (_error) {
            quickTaskPosition.value = { x: 0, y: 0 }
            deps.closeCanvasContextMenu()
            isQuickTaskCreateOpen.value = true
        }
    }

    const createTaskInGroup = (groupOrId: string | any, screenPos?: { x: number; y: number }) => {
        const groupId = typeof groupOrId === 'string' ? groupOrId : groupOrId.id
        const group = canvasStore._rawGroups.find(g => g.id === groupId)

        console.log('[TASK-288-DEBUG] createTaskInGroup action called', {
            groupId,
            screenPos,
            groupFound: !!group
        })

        if (!group) return

        // Group's canvas position (for clamping only)
        const groupX = group.position?.x || 0
        const groupY = group.position?.y || 0
        const groupWidth = group.position?.width || CANVAS.DEFAULT_GROUP_WIDTH
        const groupHeight = group.position?.height || CANVAS.DEFAULT_GROUP_HEIGHT

        console.log('[TASK-288-DEBUG] Group position:', {
            groupX,
            groupY,
            groupWidth,
            groupHeight,
            rawPosition: group.position
        })

        let absolutePos: { x: number; y: number }

        if (screenPos) {
            // Convert screen position to flow coordinates
            // CRITICAL: canvasPosition stores ABSOLUTE coordinates, not relative!
            // The node builder handles conversion to relative for Vue Flow
            const flowCoords = deps.screenToFlowCoordinate(screenPos)

            console.log('[TASK-288-DEBUG] Coordinate conversion:', {
                screenPos,
                flowCoords,
                CANVAS_DEFAULT_TASK_WIDTH: CANVAS.DEFAULT_TASK_WIDTH,
                CANVAS_DEFAULT_TASK_HEIGHT: CANVAS.DEFAULT_TASK_HEIGHT
            })

            // Store ABSOLUTE position (centered on click point)
            // Node builder will convert to relative when building Vue Flow nodes
            absolutePos = {
                x: flowCoords.x - (CANVAS.DEFAULT_TASK_WIDTH / 2),
                y: flowCoords.y - (CANVAS.DEFAULT_TASK_HEIGHT / 2)
            }

            console.log('[TASK-288-DEBUG] Absolute position (before clamp):', absolutePos)

            // Clamp to group bounds (absolute coordinates)
            const padding = 10
            const minX = groupX + padding
            const maxX = groupX + groupWidth - CANVAS.DEFAULT_TASK_WIDTH - padding
            const minY = groupY + padding + 40 // +40 for header
            const maxY = groupY + groupHeight - CANVAS.DEFAULT_TASK_HEIGHT - padding

            absolutePos.x = Math.max(minX, Math.min(absolutePos.x, maxX))
            absolutePos.y = Math.max(minY, Math.min(absolutePos.y, maxY))

            console.log('[TASK-288-DEBUG] Absolute position (after clamp):', absolutePos)
        } else {
            // Fallback: center of group (absolute coordinates)
            absolutePos = {
                x: groupX + (groupWidth / 2) - (CANVAS.DEFAULT_TASK_WIDTH / 2),
                y: groupY + (groupHeight / 2) - (CANVAS.DEFAULT_TASK_HEIGHT / 2)
            }
            console.log('[TASK-288-DEBUG] Using fallback center position (absolute):', absolutePos)
        }

        const finalPosition = {
            ...absolutePos,
            parentId: group.id
        }

        console.log('[TASK-288-DEBUG] Final quickTaskPosition:', finalPosition)

        quickTaskPosition.value = finalPosition
        deps.closeCanvasContextMenu()
        isQuickTaskCreateOpen.value = true
    }

    /**
     * GEOMETRY WRITER: Creates task with initial canvas position (TASK-255)
     * This is an ALLOWED geometry write as it's an explicit user action (creating a task).
     */
    const handleQuickTaskCreate = async (title: string, description: string) => {
        try {
            if (!title?.trim()) return

            const isDefaultPosition = quickTaskPosition.value.x === 0 && quickTaskPosition.value.y === 0
            const shouldCreateInInbox = isDefaultPosition

            const { x, y, parentId, parentTaskId } = quickTaskPosition.value

            console.log('[TASK-288-DEBUG] handleQuickTaskCreate - Creating task with position:', {
                quickTaskPosition: { ...quickTaskPosition.value },
                isDefaultPosition,
                shouldCreateInInbox,
                finalPosition: shouldCreateInInbox ? 'INBOX' : { x, y },
                finalParentId: shouldCreateInInbox ? 'NONE' : parentId,
                parentTaskId: parentTaskId || 'NONE'
            })

            await taskStore.createTaskWithUndo({
                title,
                description,
                canvasPosition: shouldCreateInInbox ? undefined : { x, y },
                parentId: shouldCreateInInbox ? undefined : parentId,
                parentTaskId: shouldCreateInInbox ? undefined : parentTaskId,  // Creates connection if set
                status: 'planned',
                isInInbox: shouldCreateInInbox
            })

            if (deps.batchSyncNodes) {
                deps.batchSyncNodes('high')
            } else {
                deps.syncNodes()
            }

            isQuickTaskCreateOpen.value = false
            quickTaskPosition.value = { x: 0, y: 0 }

        } catch (error) {
            console.error('Failed to create task', error)
        }
    }

    const closeQuickTaskCreate = () => {
        isQuickTaskCreateOpen.value = false
        quickTaskPosition.value = { x: 0, y: 0 }
    }

    /**
     * Creates a new task at the specified position, pre-connected to a parent task.
     * Called when user drops a connection cable on empty canvas space.
     */
    const createConnectedTask = (position: { x: number; y: number }, parentTaskId: string) => {
        // Center task on drop position
        const centeredX = position.x - (CANVAS.DEFAULT_TASK_WIDTH / 2)
        const centeredY = position.y - (CANVAS.DEFAULT_TASK_HEIGHT / 2)

        // Store position with parent task connection info
        quickTaskPosition.value = {
            x: centeredX,
            y: centeredY,
            parentTaskId  // This will create the connection when task is created
        }

        deps.closeCanvasContextMenu()
        isQuickTaskCreateOpen.value = true
    }

    /**
     * GEOMETRY WRITER: Removes tasks from canvas by clearing canvasPosition (TASK-255)
     * This is an ALLOWED geometry write as it's an explicit user action (move to inbox).
     */
    const moveSelectedTasksToInbox = async () => {
        const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !CanvasIds.isGroupNode(id))
        if (selectedNodeIds.length === 0) return

        try {
            for (const nodeId of selectedNodeIds) {
                await undoHistory.updateTaskWithUndo(nodeId, {
                    isInInbox: true,
                    canvasPosition: undefined
                })
            }
            canvasStore.setSelectedNodes([])
            if (deps.batchSyncNodes) deps.batchSyncNodes('high')
            deps.closeCanvasContextMenu()
        } catch (error) {
            console.error('[ASYNC-ERROR] moveSelectedTasksToInbox failed', error)
        }
    }

    const deleteSelectedTasks = async () => {
        const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !CanvasIds.isGroupNode(id))
        if (selectedNodeIds.length === 0) return

        if (!confirm('Delete selected tasks permanently?')) return

        try {
            for (const nodeId of selectedNodeIds) {
                await undoHistory.deleteTaskWithUndo(nodeId)
            }

            canvasStore.setSelectedNodes([])
            if (deps.batchSyncNodes) deps.batchSyncNodes('high')
            deps.closeCanvasContextMenu()
        } catch (error) {
            console.error('[ASYNC-ERROR] deleteSelectedTasks failed', error)
        }
    }

    const confirmBulkDelete = async () => {
        const items = bulkDeleteItems.value
        const isPermanent = bulkDeleteIsPermanent.value

        try {
            for (const item of items) {
                if (item.type === 'section') {
                    markGroupDeleted(item.id)
                    if (deps.recentlyDeletedGroups) deps.recentlyDeletedGroups.value.add(item.id)

                    if (!canvasStore.sections.some(s => s.id === item.id)) {
                        removeGhostNodeRef(item.id)
                        confirmGroupDeleted(item.id)
                        deps.recentlyDeletedGroups?.value.delete(item.id)
                    } else {
                        await canvasStore.deleteSection(item.id)
                        confirmGroupDeleted(item.id)
                        deps.recentlyDeletedGroups?.value.delete(item.id)
                    }
                } else if (isPermanent) {
                    await undoHistory.permanentlyDeleteTaskWithUndo(item.id)
                } else {
                    await undoHistory.updateTaskWithUndo(item.id, {
                        canvasPosition: undefined,
                        isInInbox: true,
                        instances: [],
                        scheduledDate: undefined,
                        scheduledTime: undefined
                    })
                }
            }

            canvasStore.setSelectedNodes([])
            bulkDeleteItems.value = []
            isBulkDeleteModalOpen.value = false
            await nextTick()
            deps.syncNodes()
        } catch (error) {
            console.error('[ASYNC-ERROR] confirmBulkDelete failed', error)
        }
    }

    const cancelBulkDelete = () => {
        bulkDeleteItems.value = []
        isBulkDeleteModalOpen.value = false
    }

    /**
     * GEOMETRY WRITER: Arranges all done tasks in a grid at bottom-left of canvas (TASK-255)
     * This is an ALLOWED geometry write as it's an explicit user action.
     *
     * Grid layout:
     * - Starting position: x=100, y=2000 (bottom-left area)
     * - Task card size: ~200x80
     * - Gap: 16px
     * - Columns: 5 tasks per row
     */
    const arrangeDoneTasksInGrid = async () => {
        // Find all done tasks that have a canvas position
        const doneTasks = taskStore.tasks.filter(
            (t) => t.status === 'done' && t.canvasPosition
        )

        if (doneTasks.length === 0) {
            console.log('[ARRANGE-DONE] No done tasks with canvas positions to arrange')
            return
        }

        console.log(`[ARRANGE-DONE] Arranging ${doneTasks.length} done tasks in grid`)

        // Grid configuration
        const startX = 100
        const startY = 2000
        const cardWidth = 200
        const cardHeight = 80
        const gap = 16
        const columns = 5

        try {
            for (let i = 0; i < doneTasks.length; i++) {
                const task = doneTasks[i]
                const col = i % columns
                const row = Math.floor(i / columns)

                const newX = startX + col * (cardWidth + gap)
                const newY = startY + row * (cardHeight + gap)

                await undoHistory.updateTaskWithUndo(task.id, {
                    parentId: undefined, // Remove from any group
                    canvasPosition: { x: newX, y: newY }
                })
            }

            // Sync canvas after all updates
            if (deps.batchSyncNodes) {
                deps.batchSyncNodes('high')
            } else {
                deps.syncNodes()
            }

            console.log(`[ARRANGE-DONE] Successfully arranged ${doneTasks.length} tasks`)
        } catch (error) {
            console.error('[ASYNC-ERROR] arrangeDoneTasksInGrid failed', error)
        }
    }

    return {
        isQuickTaskCreateOpen,
        quickTaskPosition,
        isBulkDeleteModalOpen,
        bulkDeleteItems,
        bulkDeleteIsPermanent,
        createTaskHere,
        createTaskInGroup,
        createConnectedTask,
        handleQuickTaskCreate,
        closeQuickTaskCreate,
        moveSelectedTasksToInbox,
        deleteSelectedTasks,
        confirmBulkDelete,
        cancelBulkDelete,
        arrangeDoneTasksInGrid
    }
}
