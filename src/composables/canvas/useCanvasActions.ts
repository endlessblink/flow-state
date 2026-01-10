import { type Ref, ref, nextTick } from 'vue'
import { useVueFlow, type Node } from '@vue-flow/core'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { markGroupDeleted, confirmGroupDeleted } from '@/utils/deletedGroupsTracker'

// Imported Composables
import { useCanvasGroupActions } from './useCanvasGroupActions'
import { useCanvasTaskActions } from './useCanvasTaskActions'

interface ActionsDeps {
    viewport: Ref<{ x: number; y: number; zoom: number }>
    batchedSyncNodes: (priority?: 'high' | 'normal' | 'low') => void
    syncNodes: () => void
    closeCanvasContextMenu: () => void
    closeEdgeContextMenu: () => void
    closeNodeContextMenu: () => void
    // TASK-149: Pass recentlyDeletedGroups to prevent zombie groups
    recentlyDeletedGroups?: Ref<Set<string>>
}

// NOTE: State is now decomposed into sub-composables but we keep this interface 
// if we need to aggregate it for the view, but the ReturnType of this composable
// will naturally expose everything.
// 
// For backward compatibility with the View, we'll destructure and re-return everything.
/*
interface ActionsState {
    // ... moved to sub-composables
}
*/

// Note: arguments changed slightly - state is now internal/distributed
export function useCanvasActions(
    deps: ActionsDeps,
    // state argument removed or ignored as we build it up
    ignoredState: any,
    undoHistory: any
) {
    const canvasStore = useCanvasStore()
    const { getSelectedNodes, screenToFlowCoordinate, removeNodes } = useVueFlow()

    // --- Instantiate Sub-Composables ---

    // Groups
    const groupActions = useCanvasGroupActions({
        viewport: deps.viewport,
        syncNodes: deps.syncNodes,
        batchSyncNodes: deps.batchedSyncNodes,
        closeCanvasContextMenu: deps.closeCanvasContextMenu,
        screenToFlowCoordinate: (pos) => screenToFlowCoordinate(pos),
        recentlyDeletedGroups: deps.recentlyDeletedGroups
    })

    // Tasks
    const taskActions = useCanvasTaskActions({
        syncNodes: deps.syncNodes,
        batchSyncNodes: deps.batchedSyncNodes,
        closeCanvasContextMenu: deps.closeCanvasContextMenu,
        screenToFlowCoordinate: (pos) => screenToFlowCoordinate(pos),
        recentlyDeletedGroups: deps.recentlyDeletedGroups,
        undoHistory
    })

    // --- Orchestrator Logic (things that don't fit cleanly or bridge both) ---

    // Node Context Menu (Orchestrates between Groups and Tasks)
    const selectedNode = ref<Node | null>(null)
    const showNodeContextMenu = ref(false)
    const nodeContextMenuX = ref(0)
    const nodeContextMenuY = ref(0)

    // Canvas Context Menu State (Shared)
    const showCanvasContextMenu = ref(false)
    const canvasContextMenuX = ref(0)
    const canvasContextMenuY = ref(0)
    const canvasContextSection = ref<CanvasSection | null>(null)

    const handleNodeContextMenu = (event: { node: Node; event: MouseEvent | TouchEvent }) => {
        event.event.preventDefault()
        event.event.stopPropagation()

        if (!event.node.id.startsWith('section-')) return

        const mouseEvent = event.event as MouseEvent
        const sectionId = event.node.id.replace('section-', '')
        const section = canvasStore.sections.find(s => s.id === sectionId)

        if (section) {
            // Show the canvas context menu with group actions (TASK-070)
            canvasContextMenuX.value = mouseEvent.clientX || 0
            canvasContextMenuY.value = mouseEvent.clientY || 0
            canvasContextSection.value = section
            showCanvasContextMenu.value = true
        } else {
            // Ghost handling
            const ghostSection: CanvasSection = {
                id: sectionId,
                name: (event.node.data?.name as string) || 'Unknown Group (Ghost)',
                color: (event.node.data?.color as string) || '#6366f1',
                position: { x: 0, y: 0, width: 300, height: 200 },
                isCollapsed: false,
                type: 'custom',
                layout: 'freeform',
                isVisible: true
            }
            canvasContextMenuX.value = mouseEvent.clientX || 0
            canvasContextMenuY.value = mouseEvent.clientY || 0
            canvasContextSection.value = ghostSection
            showCanvasContextMenu.value = true
        }

        deps.closeEdgeContextMenu()
    }

    const closeNodeContextMenu = () => {
        showNodeContextMenu.value = false
        selectedNode.value = null
    }

    const deleteNode = async () => {
        if (!selectedNode.value) return

        if (selectedNode.value.id.startsWith('section-')) {
            const sectionId = selectedNode.value.id.replace('section-', '')
            // Check existence
            const section = canvasStore.sections.find(s => s.id === sectionId)

            // Delegate to group actions
            if (section) {
                groupActions.deleteGroup(section)
            } else {
                // Ghost?
                const ghost: CanvasSection = {
                    id: sectionId,
                    name: 'Ghost',
                    color: '#000',
                    position: { x: 0, y: 0, w: 0, h: 0 } as any,
                    type: 'custom',
                    layout: 'freeform',
                    isVisible: true,
                    isCollapsed: false
                }
                groupActions.deleteGroup(ghost)
            }
        }
        closeNodeContextMenu()
    }

    // --- Re-Export Everything ---
    return {
        // Group Actions & State
        createGroup: groupActions.createGroup,
        closeGroupModal: groupActions.closeGroupModal,
        handleGroupCreated: groupActions.handleGroupCreated,
        handleGroupUpdated: groupActions.handleGroupUpdated,
        editGroup: groupActions.editGroup,
        closeGroupEditModal: groupActions.closeGroupEditModal,
        handleGroupEditSave: groupActions.handleGroupEditSave,
        deleteGroup: groupActions.deleteGroup,
        confirmDeleteGroup: groupActions.confirmDeleteGroup,
        cancelDeleteGroup: groupActions.cancelDeleteGroup,

        isGroupModalOpen: groupActions.isGroupModalOpen,
        selectedGroup: groupActions.selectedGroup,
        groupModalPosition: groupActions.groupModalPosition,
        isGroupEditModalOpen: groupActions.isGroupEditModalOpen,
        selectedSectionForEdit: groupActions.selectedSectionForEdit,
        isDeleteGroupModalOpen: groupActions.isDeleteGroupModalOpen,
        groupPendingDelete: groupActions.groupPendingDelete,

        // Task Actions & State
        createTaskHere: taskActions.createTaskHere,
        handleQuickTaskCreate: taskActions.handleQuickTaskCreate,
        closeQuickTaskCreate: taskActions.closeQuickTaskCreate,
        moveSelectedTasksToInbox: taskActions.moveSelectedTasksToInbox,
        deleteSelectedTasks: taskActions.deleteSelectedTasks,
        confirmBulkDelete: taskActions.confirmBulkDelete,
        cancelBulkDelete: taskActions.cancelBulkDelete,

        isQuickTaskCreateOpen: taskActions.isQuickTaskCreateOpen,
        quickTaskPosition: taskActions.quickTaskPosition,
        isBulkDeleteModalOpen: taskActions.isBulkDeleteModalOpen,
        bulkDeleteItems: taskActions.bulkDeleteItems,
        bulkDeleteIsPermanent: taskActions.bulkDeleteIsPermanent,

        // Orchestrator State & Actions
        handleNodeContextMenu,
        closeNodeContextMenu,
        deleteNode,

        selectedNode,
        showNodeContextMenu,
        nodeContextMenuX,
        nodeContextMenuY,
        showCanvasContextMenu,
        canvasContextMenuX,
        canvasContextMenuY,
        canvasContextSection
    }
}
