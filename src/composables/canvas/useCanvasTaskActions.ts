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

        } catch (error) {
            quickTaskPosition.value = { x: 0, y: 0 }
            deps.closeCanvasContextMenu()
            isQuickTaskCreateOpen.value = true
        }
    }

    const createTaskInGroup = (groupOrId: string | any) => {
        const groupId = typeof groupOrId === 'string' ? groupOrId : groupOrId.id
        const group = canvasStore._rawGroups.find(g => g.id === groupId)

        if (!group) return

        // Position is relative to the group since we set parentId
        const groupWidth = group.position?.width || 300
        const groupHeight = group.position?.height || 200

        const groupCenter = {
            x: (groupWidth / 2) - 110, // Center - half task width approx
            y: (groupHeight / 2) - 50, // Center - half task height approx
            parentId: group.id
        }

        quickTaskPosition.value = groupCenter
        deps.closeCanvasContextMenu()
        isQuickTaskCreateOpen.value = true
    }

    const handleQuickTaskCreate = async (title: string, description: string) => {
        try {
            if (!title?.trim()) return

            const isDefaultPosition = quickTaskPosition.value.x === 0 && quickTaskPosition.value.y === 0
            const shouldCreateInInbox = isDefaultPosition

            const { x, y, parentId } = quickTaskPosition.value

            await taskStore.createTaskWithUndo({
                title,
                description,
                canvasPosition: shouldCreateInInbox ? undefined : { x, y },
                parentId: shouldCreateInInbox ? undefined : parentId,
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

    const moveSelectedTasksToInbox = async () => {
        const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !CanvasIds.isGroupNode(id))
        if (selectedNodeIds.length === 0) return

        for (const nodeId of selectedNodeIds) {
            await undoHistory.updateTaskWithUndo(nodeId, {
                isInInbox: true,
                canvasPosition: undefined
            })
        }
        canvasStore.setSelectedNodes([])
        if (deps.batchSyncNodes) deps.batchSyncNodes('high')
        deps.closeCanvasContextMenu()
    }

    const deleteSelectedTasks = async () => {
        const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !CanvasIds.isGroupNode(id))
        if (selectedNodeIds.length === 0) return

        if (!confirm('Delete selected tasks permanently?')) return

        for (const nodeId of selectedNodeIds) {
            await undoHistory.deleteTaskWithUndo(nodeId)
        }

        canvasStore.setSelectedNodes([])
        if (deps.batchSyncNodes) deps.batchSyncNodes('high')
        deps.closeCanvasContextMenu()
    }

    const confirmBulkDelete = async () => {
        const items = bulkDeleteItems.value
        const isPermanent = bulkDeleteIsPermanent.value

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
                await taskStore.permanentlyDeleteTask(item.id)
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
    }

    const cancelBulkDelete = () => {
        bulkDeleteItems.value = []
        isBulkDeleteModalOpen.value = false
    }

    return {
        isQuickTaskCreateOpen,
        quickTaskPosition,
        isBulkDeleteModalOpen,
        bulkDeleteItems,
        bulkDeleteIsPermanent,
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
