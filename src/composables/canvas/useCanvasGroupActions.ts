import { ref, type Ref, nextTick } from 'vue'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
// TASK-158: Persistent deleted groups tracking
import { markGroupDeleted, confirmGroupDeleted } from '@/utils/deletedGroupsTracker'
import { CanvasIds } from '@/utils/canvas/canvasIds'

export interface GroupActionsDeps {
    viewport?: Ref<{ x: number; y: number; zoom: number }>
    syncNodes: () => void
    batchSyncNodes?: (priority?: 'high' | 'normal' | 'low') => void // Optional for now
    closeCanvasContextMenu: () => void
    screenToFlowCoordinate: (position: { x: number; y: number }) => { x: number; y: number }
    recentlyDeletedGroups?: Ref<Set<string>>
    state?: {
        isGroupModalOpen: Ref<boolean>
        selectedGroup: Ref<CanvasSection | null>
        groupModalPosition: Ref<{ x: number; y: number }>
        isGroupEditModalOpen: Ref<boolean>
        selectedSectionForEdit: Ref<CanvasSection | null>
        isDeleteGroupModalOpen: Ref<boolean>
        groupPendingDelete: Ref<CanvasSection | null>
    }
}

export function useCanvasGroupActions(deps: GroupActionsDeps) {
    const canvasStore = useCanvasStore()

    // --- State (Use injected state or fallback to local) ---
    const isGroupModalOpen = deps.state?.isGroupModalOpen ?? ref(false)
    const selectedGroup = deps.state?.selectedGroup ?? ref<CanvasSection | null>(null)
    const groupModalPosition = deps.state?.groupModalPosition ?? ref({ x: 100, y: 100 })

    const isGroupEditModalOpen = deps.state?.isGroupEditModalOpen ?? ref(false)
    const selectedSectionForEdit = deps.state?.selectedSectionForEdit ?? ref<CanvasSection | null>(null)

    const isDeleteGroupModalOpen = deps.state?.isDeleteGroupModalOpen ?? ref(false)
    const groupPendingDelete = deps.state?.groupPendingDelete ?? ref<CanvasSection | null>(null)

    // --- Helper for Ghost Removal ---
    // Note: duplicated small helper to avoid complex sharing, or could be passed in.
    // Given its simplicity, I'll keep it here, but ideally it should be a shared util.
    // For this refactor, I'll access the store directly to avoid circular dependency with orchestrator.
    const removeGhostNodeRef = (id: string) => {
        // We can't easily access VueFlow's removeNodes here without passing it in.
        // But the main orchestrator handles the view dependencies.
        // For pure data operations, we can modify the store.
        if (canvasStore.nodes) {
            const nodeId = CanvasIds.groupNodeId(id)
            canvasStore.nodes = canvasStore.nodes.filter(n => n.id !== nodeId)
        }
    }

    // --- Actions ---

    const createGroup = async (screenPos?: { x: number; y: number }) => {
        if (import.meta.env.DEV) {
            console.log('[BUG-1126] useCanvasGroupActions.createGroup called', {
                screenPos,
                hasState: !!deps.state,
                hasGroupModalPosition: !!deps.state?.groupModalPosition
            })
        }

        const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
        const viewport = deps.viewport?.value || { x: 0, y: 0, zoom: 1 }

        // If no position provided, use viewport center
        let flowCoords: { x: number; y: number }
        if (!screenPos) {
            // Note: Simplistic viewport center calculation if screenPos is missing
            flowCoords = {
                x: -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom,
                y: -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom
            }
            if (import.meta.env.DEV) {
                console.log('[BUG-1126] No screenPos provided, using viewport center:', flowCoords)
            }
        } else {
            // BUG-1126 FIX: Manual coordinate conversion to ensure accuracy
            // screenToFlowCoordinate may have issues with container offset detection
            if (vueFlowElement) {
                const containerRect = vueFlowElement.getBoundingClientRect()
                // Convert screen coords to container-relative, then to flow coords
                const containerX = screenPos.x - containerRect.left
                const containerY = screenPos.y - containerRect.top
                flowCoords = {
                    x: (containerX - viewport.x) / viewport.zoom,
                    y: (containerY - viewport.y) / viewport.zoom
                }
                if (import.meta.env.DEV) {
                    console.log('[BUG-1126] Manual conversion:', {
                        screenPos,
                        containerRect: { left: containerRect.left, top: containerRect.top },
                        containerRelative: { x: containerX, y: containerY },
                        viewport,
                        flowCoords
                    })
                }
            } else {
                // Fallback to Vue Flow's built-in conversion
                flowCoords = deps.screenToFlowCoordinate(screenPos)
                if (import.meta.env.DEV) {
                    console.log('[BUG-1126] Fallback to screenToFlowCoordinate:', { screenPos, flowCoords })
                }
            }
        }

        if (import.meta.env.DEV) {
            console.log('[BUG-1126] Setting groupModalPosition to:', flowCoords)
        }
        groupModalPosition.value = flowCoords
        selectedGroup.value = null // Ensure create mode

        deps.closeCanvasContextMenu()
        isGroupModalOpen.value = true

        return undefined // Matches Promise<string | undefined> expectation of hotkeys
    }

    const closeGroupModal = () => {
        isGroupModalOpen.value = false
        selectedGroup.value = null
        groupModalPosition.value = { x: 100, y: 100 }
    }

    const handleGroupCreated = (_group: CanvasSection) => {
        deps.syncNodes()
    }

    const handleGroupUpdated = (_group: CanvasSection) => {
        deps.syncNodes()
    }

    const editGroup = (section: CanvasSection) => {
        selectedSectionForEdit.value = section
        isGroupEditModalOpen.value = true
        deps.closeCanvasContextMenu()
    }

    const closeGroupEditModal = () => {
        isGroupEditModalOpen.value = false
        selectedSectionForEdit.value = null
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
        groupPendingDelete.value = section
        isDeleteGroupModalOpen.value = true
        deps.closeCanvasContextMenu()
    }

    const confirmDeleteGroup = async () => {
        const section = groupPendingDelete.value
        if (!section) return

        try {
            const sectionNodeId = CanvasIds.groupNodeId(section.id)

            // TASK-158 FIX: Use persistent deleted groups tracker
            markGroupDeleted(section.id)
            if (deps.recentlyDeletedGroups) {
                deps.recentlyDeletedGroups.value.add(section.id)
            }

            // BUG-091 FIX: Check if section exists in store (might be a ghost)
            const existsInStore = canvasStore.sections.some(s => s.id === section.id)

            if (!existsInStore) {
                removeGhostNodeRef(section.id)

                // Confirm deletion since there's nothing in Supabase to delete
                confirmGroupDeleted(section.id)
                if (deps.recentlyDeletedGroups) {
                    deps.recentlyDeletedGroups.value.delete(section.id)
                }
            } else {
                try {
                    await canvasStore.deleteSection(section.id)
                    confirmGroupDeleted(section.id)
                    if (deps.recentlyDeletedGroups) {
                        deps.recentlyDeletedGroups.value.delete(section.id)
                    }
                } catch (e) {
                    console.error('[ASYNC-ERROR] confirmDeleteGroup deleteSection failed', e)
                    // Don't clear from tracker on failure - let TTL handle cleanup
                }
            }

            // Force high priority sync which cleans up/re-verifies
            if (deps.batchSyncNodes) {
                nextTick(() => deps.batchSyncNodes!('high'))
            } else {
                nextTick(() => deps.syncNodes())
            }

            // Close the modal
            cancelDeleteGroup()
        } catch (error) {
            console.error('[ASYNC-ERROR] confirmDeleteGroup failed', error)
        }
    }

    const cancelDeleteGroup = () => {
        isDeleteGroupModalOpen.value = false
        groupPendingDelete.value = null
    }

    return {
        // State
        isGroupModalOpen,
        selectedGroup,
        groupModalPosition,
        isGroupEditModalOpen,
        selectedSectionForEdit,
        isDeleteGroupModalOpen,
        groupPendingDelete,

        // Actions
        createGroup,
        closeGroupModal,
        handleGroupCreated,
        handleGroupUpdated,
        editGroup,
        closeGroupEditModal,
        handleGroupEditSave,
        deleteGroup,
        confirmDeleteGroup,
        cancelDeleteGroup
    }
}
