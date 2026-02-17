import { type Ref, nextTick } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasModalsStore } from '@/stores/canvas/modals'
import { markGroupDeleted, confirmGroupDeleted } from '@/utils/deletedGroupsTracker'
import { storeToRefs } from 'pinia'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { CANVAS } from '@/constants/canvas'
import { useToast } from '@/composables/useToast'
import { positionManager } from '@/services/canvas/PositionManager'



export interface TaskActionsDeps {
    syncNodes: (tasks?: Task[]) => void
    batchSyncNodes?: (priority?: 'high' | 'normal' | 'low') => void
    closeCanvasContextMenu: () => void
    screenToFlowCoordinate: (position: { x: number; y: number }) => { x: number; y: number }
    recentlyDeletedGroups?: Ref<Set<string>>
    undoHistory: any
    fitView?: (options?: { padding?: number; duration?: number; nodes?: string[] }) => void
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

        if (!group) return

        // Group's canvas position (for clamping only)
        const groupX = group.position?.x || 0
        const groupY = group.position?.y || 0
        const groupWidth = group.position?.width || CANVAS.DEFAULT_GROUP_WIDTH
        const groupHeight = group.position?.height || CANVAS.DEFAULT_GROUP_HEIGHT

        let absolutePos: { x: number; y: number }

        if (screenPos) {
            // Convert screen position to flow coordinates
            // CRITICAL: canvasPosition stores ABSOLUTE coordinates, not relative!
            // The node builder handles conversion to relative for Vue Flow
            const flowCoords = deps.screenToFlowCoordinate(screenPos)

            // Store ABSOLUTE position (centered on click point)
            // Node builder will convert to relative when building Vue Flow nodes
            absolutePos = {
                x: flowCoords.x - (CANVAS.DEFAULT_TASK_WIDTH / 2),
                y: flowCoords.y - (CANVAS.DEFAULT_TASK_HEIGHT / 2)
            }

            // Clamp to group bounds (absolute coordinates)
            const padding = 10
            const minX = groupX + padding
            const maxX = groupX + groupWidth - CANVAS.DEFAULT_TASK_WIDTH - padding
            const minY = groupY + padding + 40 // +40 for header
            const maxY = groupY + groupHeight - CANVAS.DEFAULT_TASK_HEIGHT - padding

            absolutePos.x = Math.max(minX, Math.min(absolutePos.x, maxX))
            absolutePos.y = Math.max(minY, Math.min(absolutePos.y, maxY))
        } else {
            // Fallback: center of group (absolute coordinates)
            absolutePos = {
                x: groupX + (groupWidth / 2) - (CANVAS.DEFAULT_TASK_WIDTH / 2),
                y: groupY + (groupHeight / 2) - (CANVAS.DEFAULT_TASK_HEIGHT / 2)
            }
        }

        const finalPosition = {
            ...absolutePos,
            parentId: group.id
        }

        quickTaskPosition.value = finalPosition
        deps.closeCanvasContextMenu()
        isQuickTaskCreateOpen.value = true
    }

    /**
     * GEOMETRY WRITER: Creates task with initial canvas position (TASK-255)
     * This is an ALLOWED geometry write as it's an explicit user action (creating a task).
     */
    interface QuickTaskData {
        title: string
        description: string
        status?: string
        priority?: 'low' | 'medium' | 'high'
        dueDate?: string
        projectId?: string
    }

    const handleQuickTaskCreate = async (data: QuickTaskData) => {
        try {
            if (!data.title?.trim()) return

            const isDefaultPosition = quickTaskPosition.value.x === 0 && quickTaskPosition.value.y === 0
            const shouldCreateInInbox = isDefaultPosition

            const { x, y, parentId, parentTaskId } = quickTaskPosition.value

            await taskStore.createTaskWithUndo({
                title: data.title,
                description: data.description,
                canvasPosition: shouldCreateInInbox ? undefined : { x, y },
                parentId: shouldCreateInInbox ? undefined : parentId,
                parentTaskId: shouldCreateInInbox ? undefined : parentTaskId,
                status: (data.status as 'planned' | 'in_progress' | 'done') || 'planned',
                priority: data.priority || 'medium',
                dueDate: data.dueDate,
                projectId: data.projectId,
                isInInbox: shouldCreateInInbox
            })

            if (deps.batchSyncNodes) {
                deps.batchSyncNodes('high')
            } else {
                deps.syncNodes()
            }

        } catch (error) {
            console.error('Failed to create task', error)
        } finally {
            // Always close modal, even on error
            isQuickTaskCreateOpen.value = false
            quickTaskPosition.value = { x: 0, y: 0 }
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

    /**
     * "Done for now" - Moves selected tasks' due date to tomorrow with tracking badge.
     * User can work incrementally and automatically reschedule unfinished tasks.
     * Badge shows until user changes the due date to something else.
     */
    const doneForNowSelectedTasks = async () => {
        const { showToast } = useToast()
        const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !CanvasIds.isGroupNode(id))
        if (selectedNodeIds.length === 0) return

        // Calculate tomorrow's date in YYYY-MM-DD format
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        try {
            for (const nodeId of selectedNodeIds) {
                // Set both dueDate and doneForNowUntil to track the badge
                await undoHistory.updateTaskWithUndo(nodeId, {
                    dueDate: tomorrowStr,
                    doneForNowUntil: tomorrowStr
                })
            }

            // Show toast notification
            const msg = selectedNodeIds.length === 1
                ? 'Moved to tomorrow'
                : `${selectedNodeIds.length} tasks moved to tomorrow`
            showToast(msg, 'success', { duration: 2000 })

            deps.closeCanvasContextMenu()
        } catch (error) {
            console.error('[ASYNC-ERROR] doneForNowSelectedTasks failed', error)
            showToast('Failed to reschedule tasks', 'error')
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
     * GEOMETRY WRITER: Arranges all done tasks in a grid LEFT of all existing content (TASK-255)
     * This is an ALLOWED geometry write as it's an explicit user action.
     *
     * Dynamically calculates position based on existing content to avoid overlap.
     * Creates a "Done Tasks" group around the arranged tasks for easy navigation.
     */
    const arrangeDoneTasksInGrid = async () => {
        console.log('[ARRANGE-DONE] Starting arrangement...')

        // Step 0: Ensure done tasks are visible FIRST (before filtering)
        // This must happen before we collect doneTasks, otherwise they might be filtered out
        if (taskStore.hideCanvasDoneTasks) {
            taskStore.toggleCanvasDoneTasks()
            console.log(`[ARRANGE-DONE] Enabled showing done tasks on canvas`)
            // Wait for reactivity to propagate
            await new Promise(resolve => setTimeout(resolve, 50))
        }

        // Find all done tasks that have a canvas position
        const doneTasks = taskStore.tasks.filter(
            (t) => t.status === 'done' && t.canvasPosition
        )

        console.log(`[ARRANGE-DONE] Found ${doneTasks.length} done tasks with canvas positions`)

        if (doneTasks.length === 0) {
            console.log('[ARRANGE-DONE] No done tasks with canvas positions to arrange')
            return
        }

        console.log(`[ARRANGE-DONE] Arranging ${doneTasks.length} done tasks in grid`)

        // Grid configuration - BUG-1020: Fixed card dimensions to match actual TaskNode.vue
        // TaskNode.vue: width=280px (min 200, max 320), min-height=80px but content makes it ~140-160px
        const cardWidth = 300  // TaskNode is 280px wide, add buffer
        const cardHeight = 180 // TaskNode with content (title, date, badges) is ~140-160px, add buffer
        const gapX = 80        // Horizontal gap between columns
        const gapY = 50        // Vertical gap between rows
        const columns = 4      // Reduced columns since cards are wider
        const _gridWidth = columns * (cardWidth + gapX)
        const groupPadding = 40 // Padding inside the group
        const groupHeaderHeight = 70 // Space for the group header

        // Find the leftmost X position of all NON-DONE tasks and groups (excluding Done Tasks group)
        const nonDoneTasks = taskStore.tasks.filter(
            (t) => t.status !== 'done' && t.canvasPosition
        )
        const groups = canvasStore._rawGroups || []

        let minX = 0 // Default if no content exists

        // Check non-done tasks
        for (const task of nonDoneTasks) {
            if (task.canvasPosition && task.canvasPosition.x < minX) {
                minX = task.canvasPosition.x
            }
        }

        // Check groups (excluding existing Done Tasks group)
        for (const group of groups) {
            if (group.name !== '✅ Done Tasks' && group.position && group.position.x < minX) {
                minX = group.position.x
            }
        }

        // Calculate grid dimensions
        const rows = Math.ceil(doneTasks.length / columns)
        const actualColumns = Math.min(doneTasks.length, columns)
        const gridActualWidth = actualColumns * (cardWidth + gapX) - gapX
        const gridActualHeight = rows * (cardHeight + gapY) - gapY

        // Group dimensions (with padding)
        const groupWidth = gridActualWidth + (groupPadding * 2)
        const groupHeight = gridActualHeight + groupHeaderHeight + (groupPadding * 2)

        // Place grid FAR LEFT - minimum of calculated position or -5000
        const calculatedX = minX - groupWidth - 500
        const groupX = Math.min(calculatedX, -5000) // Ensure at least -5000
        const groupY = 100 // Near top

        // Task grid starts inside the group with padding and header offset
        const startX = groupX + groupPadding
        const startY = groupY + groupHeaderHeight + groupPadding

        console.log(`[ARRANGE-DONE] Placing group at x=${groupX}, tasks start at x=${startX}`)

        try {
            // Step 1: Delete existing "Done Tasks" group if it exists (search by name pattern)
            const existingDoneGroup = groups.find(g =>
                g.name === '✅ Done Tasks' ||
                g.name.toLowerCase().includes('done tasks') ||
                g.name === 'Done'  // May be truncated in display
            )
            if (existingDoneGroup) {
                console.log(`[ARRANGE-DONE] Removing existing Done Tasks group: ${existingDoneGroup.id}`)
                try {
                    await canvasStore.deleteSection(existingDoneGroup.id)
                    // Wait for deletion to propagate
                    await new Promise(resolve => setTimeout(resolve, 100))
                } catch (deleteError) {
                    console.warn(`[ARRANGE-DONE] Failed to delete existing group, continuing:`, deleteError)
                }
            }

            // Step 2: Create the "Done Tasks" group
            const newGroup = await canvasStore.createSection({
                name: '✅ Done Tasks',
                type: 'custom',
                color: '#10b981', // Green
                position: {
                    x: groupX,
                    y: groupY,
                    width: groupWidth,
                    height: groupHeight
                },
                layout: 'freeform',
                isVisible: true,
                isCollapsed: false
            })

            if (!newGroup || !newGroup.id) {
                console.error('[ARRANGE-DONE] Failed to create Done Tasks group')
                return
            }

            console.log(`[ARRANGE-DONE] Created Done Tasks group: ${newGroup.id}`)

            // Step 2.5: Sync to ensure group node exists in Vue Flow before assigning tasks
            deps.syncNodes()
            await new Promise(resolve => setTimeout(resolve, 150))

            // Step 3: Arrange tasks in grid and assign to group
            console.log(`[ARRANGE-DONE] Updating ${doneTasks.length} tasks with parentId: ${newGroup.id}`)
            let updatedCount = 0

            for (let i = 0; i < doneTasks.length; i++) {
                const task = doneTasks[i]
                const col = i % columns
                const row = Math.floor(i / columns)

                const newX = startX + col * (cardWidth + gapX)
                const newY = startY + row * (cardHeight + gapY)

                try {
                    await undoHistory.updateTaskWithUndo(task.id, {
                        parentId: newGroup.id,
                        canvasPosition: { x: newX, y: newY }
                    })
                    updatedCount++
                } catch (taskError) {
                    console.error(`[ARRANGE-DONE] Failed to update task ${task.id}:`, taskError)
                }
            }

            console.log(`[ARRANGE-DONE] Updated ${updatedCount}/${doneTasks.length} tasks`)

            // Step 4: Final sync to establish parent-child relationship in Vue Flow
            deps.syncNodes()
            await new Promise(resolve => setTimeout(resolve, 150))

            // Step 5: Force a second sync for Vue Flow parent-child hierarchy
            deps.syncNodes()

            console.log(`[ARRANGE-DONE] Successfully arranged ${updatedCount} tasks in Done Tasks group`)
        } catch (error) {
            console.error('[ASYNC-ERROR] arrangeDoneTasksInGrid failed', error)
        }
    }

    /**
     * GEOMETRY WRITER: Collects overdue tasks and arranges them in a grid to the LEFT of a target group (TASK-1222)
     * This is an ALLOWED geometry write as it's an explicit user action (context menu click or AI command).
     *
     * - Finds all overdue tasks NOT inside the target group
     * - Places them in a neat grid to the left of the group
     * - Detects existing content in the target area to avoid overlaps
     * - Clears parentId so tasks become free-floating on canvas
     */
    const collectOverdueTasksNearGroup = async (targetGroupId: string) => {
        const toast = useToast()
        console.log(`[COLLECT-OVERDUE] Starting collection for group: ${targetGroupId}`)

        // Step 1: Find the target group
        const groups = canvasStore._rawGroups || []
        console.log(`[COLLECT-OVERDUE] Available groups: ${groups.length}`, groups.map(g => ({ id: g.id, name: g.name, hasPosition: !!g.position })))
        const targetGroup = groups.find(g => g.id === targetGroupId)

        if (!targetGroup) {
            console.error('[COLLECT-OVERDUE] Target group not found')
            toast.showToast('Target group not found', 'error')
            return { success: false, count: 0 }
        }

        if (!targetGroup.position) {
            console.error('[COLLECT-OVERDUE] Target group has no position:', targetGroup)
            toast.showToast('Target group has no position data', 'error')
            return { success: false, count: 0 }
        }

        // Step 2: Find overdue tasks not in this group
        // Normalize dates: extract YYYY-MM-DD from "2026-02-07" or "2026-02-07T22:00:00+00:00"
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const normDate = (d: string) => d.includes('T') ? d.split('T')[0] : d

        // Use _rawTasks (unfiltered) — taskStore.tasks applies smart view/status filters
        const allTasks = taskStore._rawTasks

        // Collect ALL overdue tasks regardless of which group they're in.
        // Tasks already inside the target group will be pulled OUT and arranged in the grid.
        const overdueTasks = allTasks.filter(t => {
            if (!t.dueDate || t.status === 'done') return false
            const dueDateKey = normDate(t.dueDate)
            if (dueDateKey >= today) return false
            return true
        })

        // Include inbox tasks too — they'll get canvas positions assigned
        const tasksToCollect = overdueTasks

        console.log(`[COLLECT-OVERDUE] Found ${tasksToCollect.length} overdue tasks to arrange near group "${targetGroup.name}"`, { today, totalRaw: allTasks.length })

        if (tasksToCollect.length === 0) {
            toast.showToast('No overdue tasks found', 'info')
            return { success: true, count: 0 }
        }

        // Step 3: Grid configuration (matches arrangeDoneTasksInGrid proven values)
        const cardWidth = 300
        const cardHeight = 180
        const gapX = 80
        const gapY = 50
        const columns = Math.min(4, tasksToCollect.length)
        const gap = 200 // Gap between target group and the grid

        // Step 4: Calculate grid dimensions
        const rows = Math.ceil(tasksToCollect.length / columns)
        const gridActualWidth = columns * (cardWidth + gapX) - gapX
        const gridActualHeight = rows * (cardHeight + gapY) - gapY

        // Step 5: Calculate initial placement to the LEFT of the target group
        const groupLeftEdge = targetGroup.position.x
        const groupTopEdge = targetGroup.position.y
        let startX = groupLeftEdge - gap - gridActualWidth
        const startY = groupTopEdge // Align top with target group

        // Step 6: Detect overlaps with existing content in the target area
        const scanBuffer = 50
        const scanLeft = startX - scanBuffer
        const scanRight = startX + gridActualWidth + scanBuffer
        const scanTop = startY - scanBuffer
        const scanBottom = startY + gridActualHeight + scanBuffer

        // Check all canvas tasks for overlaps (use raw to include filtered-out tasks)
        const conflictingTasks = allTasks.filter(t => {
            if (!t.canvasPosition) return false
            if (tasksToCollect.some(ot => ot.id === t.id)) return false // Skip tasks we're moving
            return t.canvasPosition.x >= scanLeft && t.canvasPosition.x <= scanRight &&
                   t.canvasPosition.y >= scanTop && t.canvasPosition.y <= scanBottom
        })

        // Check all groups for overlaps (except target group)
        const conflictingGroups = groups.filter(g => {
            if (g.id === targetGroupId || !g.position) return false
            return (g.position.x + (g.position.width || 300)) >= scanLeft &&
                   g.position.x <= scanRight &&
                   (g.position.y + (g.position.height || 200)) >= scanTop &&
                   g.position.y <= scanBottom
        })

        // If conflicts, shift further left
        if (conflictingTasks.length > 0 || conflictingGroups.length > 0) {
            const allConflictXs = [
                ...conflictingTasks.map(t => t.canvasPosition!.x),
                ...conflictingGroups.map(g => g.position.x)
            ]
            const minConflictX = Math.min(...allConflictXs)
            startX = minConflictX - gridActualWidth - gap
            console.log(`[COLLECT-OVERDUE] Shifted left to avoid ${conflictingTasks.length + conflictingGroups.length} overlapping items, new startX: ${startX}`)
        }

        console.log(`[COLLECT-OVERDUE] Placing ${tasksToCollect.length} tasks in grid at x=${startX}, y=${startY}`)

        try {
            // Step 7: Position each task in the grid
            let updatedCount = 0
            const pmUpdates: Array<{ id: string; x: number; y: number; parentId: string | null }> = []

            for (let i = 0; i < tasksToCollect.length; i++) {
                const task = tasksToCollect[i]
                const col = i % columns
                const row = Math.floor(i / columns)

                const newX = startX + col * (cardWidth + gapX)
                const newY = startY + row * (cardHeight + gapY)

                try {
                    await undoHistory.updateTaskWithUndo(task.id, {
                        parentId: null, // Explicitly clear parent — undefined skips DB update, null clears it
                        canvasPosition: { x: newX, y: newY }
                    })
                    // Track for PositionManager force-update
                    pmUpdates.push({ id: task.id, x: newX, y: newY, parentId: null })
                    updatedCount++
                } catch (taskError) {
                    console.error(`[COLLECT-OVERDUE] Failed to update task ${task.id}:`, taskError)
                }
            }

            console.log(`[COLLECT-OVERDUE] Updated ${updatedCount}/${tasksToCollect.length} tasks`)

            // Step 8: Wait for watcher-triggered syncs from the sequential loop to settle.
            // Each updateTaskWithUndo yields the event loop ~4 times, triggering canvas watchers
            // that fire intermediate syncs with partially-updated data. Let them drain first.
            await new Promise(resolve => setTimeout(resolve, 300))

            // Step 9: Force-update PositionManager with the DEFINITIVE positions.
            // This overwrites any stale PM entries left by intermediate watcher syncs.
            const pmResult = positionManager.batchUpdate(pmUpdates, 'remote-sync')
            console.log(`[COLLECT-OVERDUE] PositionManager updated: ${pmResult.successCount} succeeded, ${pmResult.rejectedIds.length} rejected`)

            // Step 10: Final authoritative sync — this reads our fresh PM values
            deps.syncNodes()
            await new Promise(resolve => setTimeout(resolve, 200))
            // Second sync for parent-child hierarchy changes (parentId: null detach)
            deps.syncNodes()

            // Step 11: Pan viewport to show the placed tasks + target group
            await nextTick()
            await new Promise(resolve => setTimeout(resolve, 100))
            const placedNodeIds = tasksToCollect.map(t => t.id)
            placedNodeIds.push(CanvasIds.groupNodeId(targetGroupId))
            deps.fitView?.({ nodes: placedNodeIds, padding: 0.3, duration: 500 })

            toast.showToast(`Collected ${updatedCount} overdue task${updatedCount === 1 ? '' : 's'}`, 'success')
            console.log(`[COLLECT-OVERDUE] Successfully arranged ${updatedCount} overdue tasks near group "${targetGroup.name}"`)

            return { success: true, count: updatedCount }
        } catch (error) {
            console.error('[ASYNC-ERROR] collectOverdueTasksNearGroup failed', error)
            toast.showToast('Failed to collect overdue tasks', 'error')
            return { success: false, count: 0 }
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
        doneForNowSelectedTasks,
        deleteSelectedTasks,
        confirmBulkDelete,
        cancelBulkDelete,
        arrangeDoneTasksInGrid,
        collectOverdueTasksNearGroup
    }
}
