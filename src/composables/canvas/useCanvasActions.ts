import { type Ref, ref } from 'vue'
import { useVueFlow, type Node } from '@vue-flow/core'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useCanvasContextMenuStore } from '@/stores/canvas/contextMenus'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { CANVAS } from '@/constants/canvas'
import { useTaskStore } from '@/stores/tasks'
import type { CanvasGroup } from '@/types/canvas'

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
    const contextMenuStore = useCanvasContextMenuStore()
    const taskStore = useTaskStore()
    const { getSelectedNodes, screenToFlowCoordinate, removeNodes, fitView } = useVueFlow()

    // --- Instantiate Sub-Composables ---

    // Groups
    const groupActions = useCanvasGroupActions({
        viewport: deps.viewport,
        syncNodes: deps.syncNodes,
        batchSyncNodes: deps.batchedSyncNodes,
        closeCanvasContextMenu: deps.closeCanvasContextMenu,
        screenToFlowCoordinate: (pos) => screenToFlowCoordinate(pos),
        recentlyDeletedGroups: deps.recentlyDeletedGroups,
        state: ignoredState // Pass the potentially injected state (modals)
    })

    // Tasks
    const taskActions = useCanvasTaskActions({
        syncNodes: deps.syncNodes,
        batchSyncNodes: deps.batchedSyncNodes,
        closeCanvasContextMenu: deps.closeCanvasContextMenu,
        screenToFlowCoordinate: (pos) => screenToFlowCoordinate(pos),
        recentlyDeletedGroups: deps.recentlyDeletedGroups,
        undoHistory,
        fitView: (options) => fitView(options)
    })

    // --- Orchestrator Logic (things that don't fit cleanly or bridge both) ---

    // Node Context Menu (Orchestrates between Groups and Tasks)
    const selectedNode = ref<Node | null>(null)
    const showNodeContextMenu = ref(false)
    const nodeContextMenuX = ref(0)
    const nodeContextMenuY = ref(0)

    // BUG-208 FIX: Use Pinia store for context menu state
    // Previously local refs were used but CanvasContextMenus.vue reads from the store
    const handleNodeContextMenu = (event: { node: Node; event: MouseEvent | TouchEvent }) => {
        if (import.meta.env.DEV) {
            console.debug('[CANVAS:ACTIONS] handleNodeContextMenu called', {
                nodeId: event.node.id,
                eventType: event.event.type,
                isGroupNode: CanvasIds.isGroupNode(event.node.id)
            })
        }
        event.event.preventDefault()
        event.event.stopPropagation()

        if (!CanvasIds.isGroupNode(event.node.id)) return

        const mouseEvent = event.event as MouseEvent
        const { id: sectionId } = CanvasIds.parseNodeId(event.node.id)
        const section = canvasStore.sections.find(s => s.id === sectionId)

        if (section) {
            // Show the canvas context menu with group actions (TASK-070)
            contextMenuStore.openCanvasContextMenu(mouseEvent.clientX || 0, mouseEvent.clientY || 0, section)
        } else {
            // Ghost handling
            const ghostSection: CanvasSection = {
                id: sectionId,
                name: (event.node.data?.name as string) || 'Unknown Group (Ghost)',
                color: (event.node.data?.color as string) || '#6366f1',
                position: { x: 0, y: 0, width: CANVAS.DEFAULT_GROUP_WIDTH, height: CANVAS.DEFAULT_GROUP_HEIGHT },
                isCollapsed: false,
                type: 'custom',
                layout: 'freeform',
                isVisible: true
            }
            contextMenuStore.openCanvasContextMenu(mouseEvent.clientX || 0, mouseEvent.clientY || 0, ghostSection)
        }

        deps.closeEdgeContextMenu()
    }

    const closeNodeContextMenu = () => {
        showNodeContextMenu.value = false
        selectedNode.value = null
    }

    const deleteNode = async () => {
        if (!selectedNode.value) return

        if (CanvasIds.isGroupNode(selectedNode.value.id)) {
            const { id: sectionId } = CanvasIds.parseNodeId(selectedNode.value.id)
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

    /**
     * TASK-1128: Create a new group from currently selected nodes
     *
     * 1. Gets all selected task nodes (ignores group nodes)
     * 2. Calculates bounding box of selected nodes
     * 3. Creates a new group that contains all selected tasks
     * 4. Updates task parentIds to the new group
     */
    const createGroupFromSelection = async () => {
        const selectedNodes = getSelectedNodes.value
        if (import.meta.env.DEV) {
            console.log('📦 [TASK-1128] createGroupFromSelection called', { selectedCount: selectedNodes.length })
        }

        // Filter to only task nodes (exclude group nodes)
        const taskNodes = selectedNodes.filter(node => CanvasIds.isTaskNode(node.id))

        if (taskNodes.length < 2) {
            if (import.meta.env.DEV) {
                console.warn('📦 [TASK-1128] Need at least 2 tasks selected to create a group')
            }
            return
        }

        // Calculate bounding box of selected task nodes using ABSOLUTE positions
        // BUG-1203 FIX: node.position is relative when task has a parent group.
        // Using computedPosition (absolute) prevents wrong bounding box calculation.
        const PADDING = 40 // Padding around the group
        const NODE_WIDTH = 280 // Approximate task card width
        const NODE_HEIGHT = 80 // Approximate task card height

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

        for (const node of taskNodes) {
            // BUG-1203: Use computedPosition (absolute) instead of position (may be relative)
            const vfNode = node as any
            const x = (vfNode.computedPosition?.x != null && isFinite(vfNode.computedPosition.x))
                ? vfNode.computedPosition.x
                : node.position.x
            const y = (vfNode.computedPosition?.y != null && isFinite(vfNode.computedPosition.y))
                ? vfNode.computedPosition.y
                : node.position.y
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x + NODE_WIDTH)
            maxY = Math.max(maxY, y + NODE_HEIGHT)
        }

        // Add padding to the bounding box
        const groupPosition = {
            x: minX - PADDING,
            y: minY - PADDING,
            width: (maxX - minX) + (PADDING * 2),
            height: (maxY - minY) + (PADDING * 2)
        }

        if (import.meta.env.DEV) {
            console.log('📦 [TASK-1128] Creating group at:', groupPosition, 'for', taskNodes.length, 'tasks')
        }

        // Create the group data
        const groupData: Omit<CanvasGroup, 'id'> = {
            name: 'New Group',
            type: 'custom',
            position: groupPosition,
            color: '#6366f1', // Default indigo color
            layout: 'freeform',
            isVisible: true,
            isCollapsed: false
        }

        try {
            // Create the group via canvas store
            const newGroup = await canvasStore.createGroup(groupData)

            if (newGroup) {
                if (import.meta.env.DEV) {
                    console.log('📦 [TASK-1128] Group created:', newGroup.id, '- updating task parentIds')
                }

                // Update all selected tasks to have this group as their parent
                for (const node of taskNodes) {
                    const taskId = node.id
                    const task = taskStore.tasks.find(t => t.id === taskId)

                    if (task) {
                        // Update task with new parentId
                        await taskStore.updateTask(taskId, {
                            parentId: newGroup.id
                        }, 'USER')
                    }
                }

                // Sync the canvas
                deps.batchedSyncNodes('high')

                if (import.meta.env.DEV) {
                    console.log('📦 [TASK-1128] Successfully created group with', taskNodes.length, 'tasks')
                }
            }
        } catch (error) {
            console.error('📦 [TASK-1128] Failed to create group from selection:', error)
        }

        // Close context menu
        deps.closeCanvasContextMenu()
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
        createTaskInGroup: taskActions.createTaskInGroup,
        createConnectedTask: taskActions.createConnectedTask,
        handleQuickTaskCreate: taskActions.handleQuickTaskCreate,
        closeQuickTaskCreate: taskActions.closeQuickTaskCreate,
        moveSelectedTasksToInbox: taskActions.moveSelectedTasksToInbox,
        doneForNowSelectedTasks: taskActions.doneForNowSelectedTasks,
        deleteSelectedTasks: taskActions.deleteSelectedTasks,
        confirmBulkDelete: taskActions.confirmBulkDelete,
        cancelBulkDelete: taskActions.cancelBulkDelete,
        arrangeDoneTasksInGrid: taskActions.arrangeDoneTasksInGrid,
        collectOverdueTasksNearGroup: taskActions.collectOverdueTasksNearGroup,

        isQuickTaskCreateOpen: taskActions.isQuickTaskCreateOpen,
        quickTaskPosition: taskActions.quickTaskPosition,
        isBulkDeleteModalOpen: taskActions.isBulkDeleteModalOpen,
        bulkDeleteItems: taskActions.bulkDeleteItems,
        bulkDeleteIsPermanent: taskActions.bulkDeleteIsPermanent,

        // Orchestrator State & Actions
        handleNodeContextMenu,
        closeNodeContextMenu,
        deleteNode,
        // TASK-1128: Create group from selected tasks
        createGroupFromSelection,

        selectedNode,
        showNodeContextMenu,
        nodeContextMenuX,
        nodeContextMenuY
        // BUG-208: Canvas context menu state removed - now managed by useCanvasContextMenuStore
    }
}
