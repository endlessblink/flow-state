
import { type Ref, nextTick } from 'vue'
import { useVueFlow, type Node } from '@vue-flow/core'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'

interface ActionsDeps {
    viewport: Ref<{ x: number; y: number; zoom: number }>
    batchedSyncNodes: (priority?: 'high' | 'normal' | 'low') => void
    syncNodes: () => void
    closeCanvasContextMenu: () => void
    closeEdgeContextMenu: () => void
    closeNodeContextMenu: () => void
}

interface ActionsState {
    // Quick Task
    isQuickTaskCreateOpen: Ref<boolean>
    quickTaskPosition: Ref<{ x: number; y: number }>

    // Context Menu
    showCanvasContextMenu: Ref<boolean>
    canvasContextMenuX: Ref<number>
    canvasContextMenuY: Ref<number>
    canvasContextSection: Ref<CanvasSection | null>

    // Group Modals
    isGroupModalOpen: Ref<boolean>
    selectedGroup: Ref<CanvasSection | null>
    groupModalPosition: Ref<{ x: number; y: number }>
    isGroupEditModalOpen: Ref<boolean>
    selectedSectionForEdit: Ref<CanvasSection | null>

    // Group Delete Confirmation
    isDeleteGroupModalOpen: Ref<boolean>
    groupPendingDelete: Ref<CanvasSection | null>

    // Bulk Delete Confirmation (for Shift+Delete on multiple items)
    isBulkDeleteModalOpen: Ref<boolean>
    bulkDeleteItems: Ref<{ id: string; name: string; type: 'task' | 'section' }[]>
    bulkDeleteIsPermanent: Ref<boolean>

    // Node Context Menu
    selectedNode: Ref<Node | null>
    showNodeContextMenu: Ref<boolean>
    nodeContextMenuX: Ref<number>
    nodeContextMenuY: Ref<number>

    // Data for validations
    filteredTasks: Ref<Task[]>
}

export function useCanvasActions(
    deps: ActionsDeps,
    state: ActionsState,
    undoHistory: any
) {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    // BUG-044 FIX: Get viewport directly from Vue Flow (not stale store value)
    const { getSelectedNodes, screenToFlowCoordinate, viewport: vfViewport, removeNodes } = useVueFlow()

    // --- Helper for Ghost Removal ---
    const forceRemoveGhostNode = (id: string) => {
        const nodeId = id.startsWith('section-') ? id : `section-${id}`
        console.warn('👻 [CanvasActions] Force removing ghost node:', nodeId)

        // 1. Remove from Vue Flow (triggers internal cleanup)
        removeNodes([nodeId])

        // 2. Remove from Store Nodes Ref (ensures reactivity even if v-model lags)
        if (canvasStore.nodes) {
            canvasStore.nodes = canvasStore.nodes.filter(n => n.id !== nodeId)
        }
    }

    // --- Task Creation ---

    const createTaskHere = () => {
        const functionName = 'createTaskHere'
        console.log(`🔧 ${functionName} called at screen coords: x=${state.canvasContextMenuX.value}, y=${state.canvasContextMenuY.value}`)

        try {
            // ✅ VALIDATION 3: Check DOM element exists
            // (Still good to verify flow exists, even if we delegate calc)
            const vueFlowElement = document.querySelector('.vue-flow')
            if (!vueFlowElement) {
                throw new Error('Vue Flow DOM element (.vue-flow) not found')
            }

            // ✅ DRIFT FIX: Use Vue Flow native projection
            // screenToFlowCoordinate handles getBoundingClientRect AND viewport transform automatically
            const flowCoords = screenToFlowCoordinate({
                x: state.canvasContextMenuX.value,
                y: state.canvasContextMenuY.value
            })

            console.log(`📐 ${functionName}: Projected position:`, flowCoords)

            if (!Number.isFinite(flowCoords.x) || !Number.isFinite(flowCoords.y)) {
                throw new Error(`Invalid calculated coordinates: x=${flowCoords.x}, y=${flowCoords.y}`)
            }

            // ✅ STORE POSITION
            state.quickTaskPosition.value = flowCoords

            // ✅ CLOSE MENU & OPEN MODAL
            deps.closeCanvasContextMenu()
            state.isQuickTaskCreateOpen.value = true

        } catch (error) {
            console.error(`❌ ${functionName}: FAILED`, error)
            state.showCanvasContextMenu.value = false
            throw error
        }
    }

    const handleQuickTaskCreate = async (title: string, description: string) => {
        const functionName = 'handleQuickTaskCreate'
        console.log(`📍 ${functionName}: Creating task "${title}" at`, state.quickTaskPosition.value)

        try {
            if (!title?.trim()) throw new Error('Task title is required')

            // BUG FIX: When position is at default (0,0), create task in inbox instead
            // This happens when task is created from empty state "Add Task" button
            // Real positions from createTaskHere() are calculated from screen coords and never exactly (0,0)
            const isDefaultPosition = state.quickTaskPosition.value.x === 0 && state.quickTaskPosition.value.y === 0
            const shouldCreateInInbox = isDefaultPosition

            const newTask = await taskStore.createTaskWithUndo({
                title,
                description,
                canvasPosition: shouldCreateInInbox ? undefined : { ...state.quickTaskPosition.value },
                status: 'planned',
                isInInbox: shouldCreateInInbox
            })

            deps.batchedSyncNodes('high')
            state.isQuickTaskCreateOpen.value = false
            state.quickTaskPosition.value = { x: 0, y: 0 }

            // Show temporary notification if available
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
        state.isQuickTaskCreateOpen.value = false
        state.quickTaskPosition.value = { x: 0, y: 0 }
    }

    // --- Group Management ---

    const createGroup = () => {
        console.log('🔧 CanvasView: createGroup function called!')

        const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
        if (!vueFlowElement) return

        // ✅ DRIFT FIX: Use Vue Flow native projection
        const flowCoords = screenToFlowCoordinate({
            x: state.canvasContextMenuX.value,
            y: state.canvasContextMenuY.value
        })

        state.groupModalPosition.value = flowCoords
        state.selectedGroup.value = null // Ensure create mode

        deps.closeCanvasContextMenu()
        state.isGroupModalOpen.value = true
    }

    const closeGroupModal = () => {
        state.isGroupModalOpen.value = false
        state.selectedGroup.value = null
        state.groupModalPosition.value = { x: 100, y: 100 }
    }

    const handleGroupCreated = (group: CanvasSection) => {
        console.log('Group created:', group)
        deps.syncNodes()
    }

    const handleGroupUpdated = (group: CanvasSection) => {
        console.log('Group updated:', group)
        deps.syncNodes()
    }

    const editGroup = (section: CanvasSection) => {
        state.selectedSectionForEdit.value = section
        state.isGroupEditModalOpen.value = true
        deps.closeCanvasContextMenu()
    }

    const closeGroupEditModal = () => {
        state.isGroupEditModalOpen.value = false
        state.selectedSectionForEdit.value = null
    }

    const handleGroupEditSave = (updatedSection: Partial<CanvasSection> & { id: string }) => {
        if (!updatedSection) return
        canvasStore.updateSectionWithUndo(updatedSection.id, updatedSection)
        deps.syncNodes()
        closeGroupEditModal()
    }

    const deleteGroup = (section: CanvasSection) => {
        if (!section) return

        // Show designed confirmation modal instead of native confirm()
        state.groupPendingDelete.value = section
        state.isDeleteGroupModalOpen.value = true
        deps.closeCanvasContextMenu()
    }

    const confirmDeleteGroup = () => {
        const section = state.groupPendingDelete.value
        if (!section) return

        const sectionNodeId = `section-${section.id}`
        console.log(`🗑️ [CanvasActions] Confirming delete for group: ${section.name} (${section.id})`)

        // BUG-091 FIX: Check if section exists in store (might be a ghost)
        const existsInStore = canvasStore.sections.some(s => s.id === section.id)

        if (!existsInStore) {
            console.warn('👻 [CanvasActions] Ghost section detected, forcing direct removal:', sectionNodeId)
            forceRemoveGhostNode(section.id)
        } else {
            // Perform the deletion (safe to call even if not in store)
            canvasStore.deleteSection(section.id)
        }

        // Force high priority sync which cleans up/re-verifies
        nextTick(() => deps.batchedSyncNodes('high'))

        // Close the modal
        cancelDeleteGroup()
    }

    const cancelDeleteGroup = () => {
        state.isDeleteGroupModalOpen.value = false
        state.groupPendingDelete.value = null
    }

    // --- Bulk Actions ---

    const moveSelectedTasksToInbox = async () => {
        const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !id.startsWith('section-'))
        if (selectedNodeIds.length === 0) return

        for (const nodeId of selectedNodeIds) {
            try {
                await undoHistory.updateTaskWithUndo(nodeId, {
                    isInInbox: true,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    canvasPosition: null as any
                })
            } catch (e) {
                console.error(`Failed to move task ${nodeId}:`, e)
            }
        }
        canvasStore.setSelectedNodes([])
        deps.batchedSyncNodes('high')
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
        deps.batchedSyncNodes('high')
        deps.closeCanvasContextMenu()
    }

    // --- Node Context Menu (Sections) ---
    // TASK-070: Show canvas context menu with group actions instead of minimal "Delete Section" menu

    const handleNodeContextMenu = (event: { node: Node; event: MouseEvent | TouchEvent }) => {
        event.event.preventDefault()
        event.event.stopPropagation()

        if (!event.node.id.startsWith('section-')) return

        const mouseEvent = event.event as MouseEvent
        const sectionId = event.node.id.replace('section-', '')
        const section = canvasStore.sections.find(s => s.id === sectionId)

        if (section) {
            // Show the canvas context menu with group actions (TASK-070)
            state.canvasContextMenuX.value = mouseEvent.clientX || 0
            state.canvasContextMenuY.value = mouseEvent.clientY || 0
            state.canvasContextSection.value = section
            state.showCanvasContextMenu.value = true
        } else {
            // Fix: Also show for ghost nodes (similar to handleSectionContextMenu)
            // But here we clicked a NODE, so we have the node object.
            // We can construct a ghost section from the node data or just ID.
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
            state.canvasContextMenuX.value = mouseEvent.clientX || 0
            state.canvasContextMenuY.value = mouseEvent.clientY || 0
            state.canvasContextSection.value = ghostSection
            state.showCanvasContextMenu.value = true
        }

        deps.closeEdgeContextMenu()
    }

    const closeNodeContextMenu = () => {
        state.showNodeContextMenu.value = false
        state.selectedNode.value = null
    }

    const deleteNode = () => {
        if (!state.selectedNode.value) return

        if (state.selectedNode.value.id.startsWith('section-')) {
            const sectionId = state.selectedNode.value.id.replace('section-', '')
            // Check existence
            const existsInStore = canvasStore.sections.some(s => s.id === sectionId)

            if (!existsInStore) {
                if (confirm('Delete this ghost group?')) {
                    forceRemoveGhostNode(sectionId)
                }
            } else {
                const section = canvasStore.sections.find(s => s.id === sectionId)
                if (section) {
                    const taskCount = canvasStore.getTaskCountInGroupRecursive(section.id, state.filteredTasks.value)
                    const msg = taskCount > 0
                        ? `Delete "${section.name}" section? It contains ${taskCount} task(s).`
                        : `Delete "${section.name}" section?`

                    if (confirm(msg)) {
                        canvasStore.deleteSection(sectionId)
                        deps.syncNodes()
                    }
                }
            }
        }
        closeNodeContextMenu()
    }

    // --- Keyboard Handlers ---

    const handleKeyDown = async (event: KeyboardEvent) => {
        const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'

        if (event.key === 'f' || event.key === 'F') {
            // Handled by Zoom composable usually, but we might intercept here if needed.
        }

        if (!isDeleteKey) return

        const selectedNodes = getSelectedNodes.value
        if (!selectedNodes || selectedNodes.length === 0) return

        // Input protection
        const target = event.target as HTMLElement | null
        if (target) {
            const tagName = target.tagName
            const isEditable = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable
            if (isEditable && !event.shiftKey) return
        }

        event.preventDefault()
        const permanentDelete = event.shiftKey

        // Collect all items to delete - show ONE confirmation for all
        const itemsToDelete: { id: string; name: string; type: 'task' | 'section' }[] = []

        for (const node of selectedNodes) {
            if (node.id.startsWith('section-')) {
                const sectionId = node.id.replace('section-', '')
                const section = canvasStore.sections.find(s => s.id === sectionId)
                const exists = !!section
                itemsToDelete.push({
                    id: sectionId,
                    name: section?.name || 'Unknown Section',
                    type: 'section'
                })
            } else {
                const task = taskStore.getTask(node.id)
                itemsToDelete.push({
                    id: node.id,
                    name: task?.title || 'Unknown Task',
                    type: 'task'
                })
            }
        }

        if (itemsToDelete.length === 0) return

        // Show bulk delete confirmation modal
        state.bulkDeleteItems.value = itemsToDelete
        state.bulkDeleteIsPermanent.value = permanentDelete
        state.isBulkDeleteModalOpen.value = true
    }

    // Confirm bulk delete - called when user confirms the modal
    const confirmBulkDelete = async () => {
        const items = state.bulkDeleteItems.value
        const isPermanent = state.bulkDeleteIsPermanent.value

        for (const item of items) {
            if (item.type === 'section') {
                const exists = canvasStore.sections.some(s => s.id === item.id)
                if (!exists) {
                    forceRemoveGhostNode(item.id)
                } else {
                    await canvasStore.deleteSection(item.id)
                }
            } else if (isPermanent) {
                // [DEEP-DIVE FIX] Call explicit permanent delete
                await taskStore.permanentlyDeleteTask(item.id)
            } else {
                // Move to inbox (soft delete)
                await undoHistory.updateTaskWithUndo(item.id, {
                    // Force null to ensure DB update clears the fields
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    canvasPosition: null as any,
                    isInInbox: true,
                    instances: [],
                    scheduledDate: undefined,
                    scheduledTime: undefined
                })
            }
        }

        // Clear selection and state
        canvasStore.setSelectedNodes([])
        state.bulkDeleteItems.value = []
        state.isBulkDeleteModalOpen.value = false
        await nextTick()
        deps.syncNodes()
    }

    // Cancel bulk delete
    const cancelBulkDelete = () => {
        state.bulkDeleteItems.value = []
        state.isBulkDeleteModalOpen.value = false
    }

    return {
        createTaskHere,
        handleQuickTaskCreate,
        closeQuickTaskCreate,
        createGroup,
        closeGroupModal,
        handleGroupCreated,
        handleGroupUpdated,
        editGroup,
        closeGroupEditModal,
        handleGroupEditSave,
        deleteGroup,
        confirmDeleteGroup,
        cancelDeleteGroup,
        moveSelectedTasksToInbox,
        deleteSelectedTasks,
        handleNodeContextMenu,
        closeNodeContextMenu,
        deleteNode,
        handleKeyDown,
        // Bulk delete handlers
        confirmBulkDelete,
        cancelBulkDelete
    }
}
