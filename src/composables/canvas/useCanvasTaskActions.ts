import { type Ref, nextTick } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasModalsStore } from '@/stores/canvas/modals'
import { markGroupDeleted, confirmGroupDeleted } from '@/utils/deletedGroupsTracker'
import { storeToRefs } from 'pinia'

export interface TaskActionsDeps {
    syncNodes: () => void
    batchSyncNodes?: (priority?: 'high' | 'normal' | 'low') => void
    closeCanvasContextMenu: () => void
    screenToFlowCoordinate: (position: { x: number; y: number }) => { x: number; y: number }
    recentlyDeletedGroups?: Ref<Set<string>>
    undoHistory: any // Using 'any' for now to match original file, ideally type this properly later
}

export function useCanvasTaskActions(deps: TaskActionsDeps) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const modalsStore = useCanvasModalsStore()
    const { undoHistory } = deps

    // --- Bulk Delete State from Pinia Store (BUG-211 FIX) ---
    // Previously used local refs which were never populated by hotkeys
    const {
        isBulkDeleteModalOpen,
        bulkDeleteItems,
        bulkDeleteIsPermanent,
        isQuickTaskCreateOpen,
        quickTaskPosition
    } = storeToRefs(modalsStore)

    // Helper: Ghost Removal (duplicated from GroupActions for independence)
    const removeGhostNodeRef = (id: string) => {
        if (canvasStore.nodes) {
            const nodeId = id.startsWith('section-') ? id : `section-${id}`
            canvasStore.nodes = canvasStore.nodes.filter(n => n.id !== nodeId)
        }
    }

    // --- Actions ---

    const createTaskHere = (screenPos?: { x: number; y: number }) => {
        const functionName = 'createTaskHere'

        try {
            const vueFlowElement = document.querySelector('.vue-flow')

            // BUG-212 FIX: Handle empty canvas state gracefully
            // When canvas is empty, Vue Flow may not be fully initialized
            // In this case, fall back to creating task in inbox (position 0,0)
            if (!vueFlowElement) {
                console.warn(`⚠️ ${functionName}: Vue Flow element not found, creating in inbox`)
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

            // BUG-212 FIX: If coordinate conversion fails (empty canvas), use default canvas position
            if (!Number.isFinite(flowCoords.x) || !Number.isFinite(flowCoords.y)) {
                console.warn(`⚠️ ${functionName}: Invalid coordinates from viewport, using default position`)
                // Use a sensible default position on the canvas (not 0,0 which means inbox)
                quickTaskPosition.value = { x: 200, y: 200 }
                deps.closeCanvasContextMenu()
                isQuickTaskCreateOpen.value = true
                return
            }

            quickTaskPosition.value = flowCoords
            deps.closeCanvasContextMenu()
            isQuickTaskCreateOpen.value = true

        } catch (error) {
            console.error(`❌ ${functionName}: FAILED`, error)
            // BUG-212 FIX: Even on error, open the modal with inbox fallback
            quickTaskPosition.value = { x: 0, y: 0 }
            deps.closeCanvasContextMenu()
            isQuickTaskCreateOpen.value = true
        }
    }

    const createTaskInGroup = (groupOrId: string | any) => {
        const groupId = typeof groupOrId === 'string' ? groupOrId : groupOrId.id
        const group = canvasStore.groups.find(g => g.id === groupId)
        if (!group) return

        // Calculate center of group for new task
        const groupCenter = {
            x: group.position.x + (group.position.width / 2) - 100, // Approx half task width
            y: group.position.y + (group.position.height / 2) - 40 // Approx half task height
        }

        quickTaskPosition.value = groupCenter
        deps.closeCanvasContextMenu()
        isQuickTaskCreateOpen.value = true
    }

    const handleQuickTaskCreate = async (title: string, description: string) => {
        const functionName = 'handleQuickTaskCreate'

        try {
            if (!title?.trim()) throw new Error('Task title is required')

            const isDefaultPosition = quickTaskPosition.value.x === 0 && quickTaskPosition.value.y === 0
            const shouldCreateInInbox = isDefaultPosition

            await taskStore.createTaskWithUndo({
                title,
                description,
                canvasPosition: shouldCreateInInbox ? undefined : { ...quickTaskPosition.value },
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

            if (window.__notificationApi) {
                window.__notificationApi({
                    type: 'success',
                    title: 'Task Created',
                    content: shouldCreateInInbox
                        ? `Task "${title}" added to inbox`
                        : `Task "${title}" created on canvas`
                })
            }

        } catch (error) {
            console.error(`❌ ${functionName} failed:`, error)
            throw error
        }
    }

    const closeQuickTaskCreate = () => {
        isQuickTaskCreateOpen.value = false
        quickTaskPosition.value = { x: 0, y: 0 }
    }

    // --- Bulk Actions ---

    const moveSelectedTasksToInbox = async () => {
        const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !id.startsWith('section-'))
        if (selectedNodeIds.length === 0) return

        for (const nodeId of selectedNodeIds) {
            try {
                // Using passed undoHistory instance
                await undoHistory.updateTaskWithUndo(nodeId, {
                    isInInbox: true,
                    canvasPosition: undefined
                })
            } catch (e) {
                console.error(`Failed to move task ${nodeId}:`, e)
            }
        }
        canvasStore.setSelectedNodes([])
        if (deps.batchSyncNodes) deps.batchSyncNodes('high')
        deps.closeCanvasContextMenu()
    }

    const deleteSelectedTasks = async () => {
        const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !id.startsWith('section-'))
        if (selectedNodeIds.length === 0) return

        const msg = selectedNodeIds.length > 1
            ? `Delete ${selectedNodeIds.length} tasks permanently?`
            : 'Delete this task permanently?'

        if (!confirm(msg)) {
            deps.closeCanvasContextMenu()
            return
        }

        for (const nodeId of selectedNodeIds) {
            await undoHistory.deleteTaskWithUndo(nodeId)
        }

        canvasStore.setSelectedNodes([])
        if (deps.batchSyncNodes) deps.batchSyncNodes('high')
        deps.closeCanvasContextMenu()
    }

    // Confirm bulk delete (Shared between groups and tasks technically, but mostly task/mixed)
    const confirmBulkDelete = async () => {
        const items = bulkDeleteItems.value
        const isPermanent = bulkDeleteIsPermanent.value

        for (const item of items) {
            if (item.type === 'section') {
                // TASK-158 FIX: Use persistent deleted groups tracker
                markGroupDeleted(item.id)
                if (deps.recentlyDeletedGroups) {
                    deps.recentlyDeletedGroups.value.add(item.id)
                }

                const exists = canvasStore.sections.some(s => s.id === item.id)
                if (!exists) {
                    // Force removing ghost
                    // Note: removeGhostNodeRef only handles local ref update, 
                    // confirmGroupDeleted handles tracker confirm
                    removeGhostNodeRef(item.id)
                    confirmGroupDeleted(item.id)
                    deps.recentlyDeletedGroups?.value.delete(item.id)
                } else {
                    try {
                        await canvasStore.deleteSection(item.id)
                        confirmGroupDeleted(item.id)
                        deps.recentlyDeletedGroups?.value.delete(item.id)
                    } catch (e) {
                        console.error(`❌ [TASK-158] Bulk delete failed for ${item.id}`, e)
                    }
                }
            } else if (isPermanent) {
                await taskStore.permanentlyDeleteTask(item.id)
            } else {
                // Soft delete (to inbox)
                await undoHistory.updateTaskWithUndo(item.id, {
                    canvasPosition: undefined,
                    isInInbox: true,
                    instances: [],
                    scheduledDate: undefined,
                    scheduledTime: undefined
                })
            }
        }

        // Clear selection and state
        canvasStore.setSelectedNodes([])
        bulkDeleteItems.value = []
        isBulkDeleteModalOpen.value = false
        await nextTick()
        deps.syncNodes()
    }

    const cancelBulkDelete = () => {
        bulkDeleteItems.value = []
        isBulkDeleteModalOpen.value = false
    }

    return {
        // State
        isQuickTaskCreateOpen,
        quickTaskPosition,
        isBulkDeleteModalOpen,
        bulkDeleteItems,
        bulkDeleteIsPermanent,

        // Actions
        createTaskHere,
        createTaskInGroup,
        handleQuickTaskCreate,
        closeQuickTaskCreate,
        moveSelectedTasksToInbox,
        deleteSelectedTasks,
        confirmBulkDelete,
        cancelBulkDelete
    }
}
