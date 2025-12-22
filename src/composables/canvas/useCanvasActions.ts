
import { type Ref, nextTick } from 'vue' // Removed global import
import { useVueFlow, type Node } from '@vue-flow/core'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'

interface ActionsDeps {
    viewport: Ref<{ x: number; y: number; zoom: number }>
    batchedSyncNodes: (priority?: 'high' | 'normal' | 'low') => void
    syncNodes: () => void
    closeCanvasContextMenu: () => void
    closeEdgeContextMenu: () => void
}

interface ActionsState {
    // Quick Task
    isQuickTaskCreateOpen: Ref<boolean>
    quickTaskPosition: Ref<{ x: number; y: number }>

    // Context Menu
    showCanvasContextMenu: Ref<boolean>
    canvasContextMenuX: Ref<number>
    canvasContextMenuY: Ref<number>

    // Group Modals
    isGroupModalOpen: Ref<boolean>
    selectedGroup: Ref<CanvasSection | null>
    groupModalPosition: Ref<{ x: number; y: number }>
    isGroupEditModalOpen: Ref<boolean>
    selectedSectionForEdit: Ref<CanvasSection | null>

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
    const { getSelectedNodes } = useVueFlow()

    // --- Task Creation ---

    const createTaskHere = () => {
        const functionName = 'createTaskHere'
        console.log(`🔧 ${functionName} called at screen coords: x=${state.canvasContextMenuX.value}, y=${state.canvasContextMenuY.value}`)

        try {
            // ✅ VALIDATION 3: Check DOM element exists
            const vueFlowElement = document.querySelector('.vue-flow')
            if (!vueFlowElement) {
                throw new Error('Vue Flow DOM element (.vue-flow) not found')
            }

            // ✅ CALCULATE CANVAS COORDINATES
            const rect = vueFlowElement.getBoundingClientRect()
            const canvasX = (state.canvasContextMenuX.value - rect.left - deps.viewport.value.x) / deps.viewport.value.zoom
            const canvasY = (state.canvasContextMenuY.value - rect.top - deps.viewport.value.y) / deps.viewport.value.zoom

            console.log(`📐 ${functionName}: Calculated canvas position: x=${canvasX}, y=${canvasY}`)

            if (!Number.isFinite(canvasX) || !Number.isFinite(canvasY)) {
                throw new Error(`Invalid calculated coordinates: x=${canvasX}, y=${canvasY}`)
            }

            // ✅ STORE POSITION
            state.quickTaskPosition.value = { x: canvasX, y: canvasY }

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

            const newTask = await taskStore.createTaskWithUndo({
                title,
                description,
                canvasPosition: { ...state.quickTaskPosition.value },
                status: 'planned',
                isInInbox: false
            })

            deps.batchedSyncNodes('high')
            state.isQuickTaskCreateOpen.value = false
            state.quickTaskPosition.value = { x: 0, y: 0 }

            // Show temporary notification if available
            if (window.__notificationApi) {
                window.__notificationApi({
                    type: 'success',
                    title: 'Task Created',
                    content: `Task "${title}" created successfully`
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

        const rect = vueFlowElement.getBoundingClientRect()
        const canvasX = (state.canvasContextMenuX.value - rect.left - deps.viewport.value.x) / deps.viewport.value.zoom
        const canvasY = (state.canvasContextMenuY.value - rect.top - deps.viewport.value.y) / deps.viewport.value.zoom

        state.groupModalPosition.value = { x: canvasX, y: canvasY }
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

        // FIX: Using window.confirm for now to match original behavior
        if (confirm(`Delete "${section.name}" group? This will remove the group and all its settings.`)) {
            const sectionNodeId = `section-${section.id}`

            // Preservation Logic
            /* Note: The store logic handles removal, but we need to ensure tasks are visually orphaned first 
               if we want to keep them on canvas. The original code manually filtered nodes. */

            // Logic from original file to preserve tasks
            // ... (This logic relies on manipulating local nodes ref, but we should rely on store + sync)
            // Actually, standard CanvasStore.deleteSection doesn't delete tasks, it just removes the section.
            // Tasks lose their parentNode via sync or we must ensure they are updated.

            canvasStore.deleteSection(section.id)

            // Force high priority sync
            nextTick(() => deps.batchedSyncNodes('high'))
        }
        deps.closeCanvasContextMenu()
    }

    // --- Bulk Actions ---

    const moveSelectedTasksToInbox = async () => {
        const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !id.startsWith('section-'))
        if (selectedNodeIds.length === 0) return

        for (const nodeId of selectedNodeIds) {
            try {
                await undoHistory.updateTaskWithUndo(nodeId, {
                    isInInbox: true,
                    canvasPosition: undefined
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

    const handleNodeContextMenu = (event: { node: Node; event: MouseEvent | TouchEvent }) => {
        event.event.preventDefault()
        event.event.stopPropagation()

        if (!event.node.id.startsWith('section-')) return

        const mouseEvent = event.event as MouseEvent
        state.nodeContextMenuX.value = mouseEvent.clientX || 0
        state.nodeContextMenuY.value = mouseEvent.clientY || 0
        state.selectedNode.value = event.node
        state.showNodeContextMenu.value = true

        deps.closeCanvasContextMenu()
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
            const section = canvasStore.sections.find(s => s.id === sectionId)

            if (!section) {
                closeNodeContextMenu()
                return
            }

            const tasksInSection = canvasStore.getTasksInSection(section, state.filteredTasks.value)
            const msg = tasksInSection.length > 0
                ? `Delete "${section.name}" section? It contains ${tasksInSection.length} task(s).`
                : `Delete "${section.name}" section?`

            if (confirm(msg)) {
                canvasStore.deleteSectionWithUndo(sectionId)
                deps.syncNodes()
            }
        }
        closeNodeContextMenu()
    }

    // --- Keyboard Handlers ---

    const handleKeyDown = async (event: KeyboardEvent) => {
        const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'

        if (event.key === 'f' || event.key === 'F') {
            // Handled by Zoom composable usually, but we might intercept here if needed.
            // Assuming fitView is globally handled or passed if necessary, but typically 
            // the zoom composables sets up its own listener or component does.
            // The original code had it here.
            // We will leave fitView to the component or zoom composable.
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

        for (const node of selectedNodes) {
            if (node.id.startsWith('section-')) {
                const sectionId = node.id.replace('section-', '')
                const section = canvasStore.sections.find(s => s.id === sectionId)
                // Re-use logic for confirmation
                const tasksInSection = section ? canvasStore.getTasksInSection(section, state.filteredTasks.value) : []

                if (confirm(section && tasksInSection.length ? `Delete "${section.name}"?` : 'Delete section?')) {
                    await canvasStore.deleteSectionWithUndo(sectionId)
                }
            } else if (permanentDelete) {
                await undoHistory.deleteTaskWithUndo(node.id)
            } else {
                // Move to inbox
                await undoHistory.updateTaskWithUndo(node.id, {
                    canvasPosition: undefined,
                    isInInbox: true,
                    instances: [],
                    scheduledDate: undefined,
                    scheduledTime: undefined
                })
            }
        }

        canvasStore.setSelectedNodes([])
        await nextTick()
        deps.syncNodes()
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
        moveSelectedTasksToInbox,
        deleteSelectedTasks,
        handleNodeContextMenu,
        closeNodeContextMenu,
        deleteNode,
        handleKeyDown
    }
}
