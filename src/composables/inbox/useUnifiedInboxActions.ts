import { ref, computed } from 'vue'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { useToast } from '@/composables/useToast'
import {
    findMatchingGroupForDueDate,
    calculatePositionInGroup,
    getPlacementLabel
} from '@/composables/canvas/useSmartGroupMatcher'

export function useUnifiedInboxActions(
    inboxTasks: { value: Task[] },
    context: string
) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const { createTaskWithUndo, updateTaskWithUndo } = useUnifiedUndoRedo()
    const { showToast } = useToast()

    // Multi-select state (Actions)
    const selectedTaskIds = ref<Set<string>>(new Set())
    const lastSelectedTaskId = ref<string | null>(null)
    // BUG-1192: Only show selection bar when user explicitly multi-selects (Ctrl/Shift+Click)
    // Single click highlights a task but does NOT show the selection bar
    const multiSelectActive = ref(false)
    const multiSelectMode = computed(() => multiSelectActive.value && selectedTaskIds.value.size > 0)
    const draggingTaskId = ref<string | null>(null)

    // --- Task Operations ---

    const addTask = (title: string, options?: { priority?: string; dueDate?: Date; description?: string }) => {
        if (!title.trim()) return

        createTaskWithUndo({
            title: title.trim(),
            status: 'planned',
            isInInbox: true,
            ...(options?.priority && { priority: options.priority as 'low' | 'medium' | 'high' }),
            ...(options?.dueDate && { dueDate: options.dueDate.toISOString() }),
            ...(options?.description && { description: options.description })
        })
    }

    const deleteSelectedTasks = () => {
        if (selectedTaskIds.value.size === 0) return

        const idsToDelete = Array.from(selectedTaskIds.value)
        idsToDelete.forEach(id => {
            taskStore.deleteTaskWithUndo(id)
        })
        clearSelection()
    }

    const handleTaskKeydown = (event: KeyboardEvent, task: Task) => {
        // Handle Delete/Backspace key
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault()
            event.stopPropagation()

            if (selectedTaskIds.value.has(task.id) && selectedTaskIds.value.size > 1) {
                deleteSelectedTasks()
            } else {
                taskStore.deleteTaskWithUndo(task.id)
                selectedTaskIds.value.delete(task.id)
            }
        }
    }

    // --- Selection Logic ---

    const clearSelection = () => {
        selectedTaskIds.value.clear()
        selectedTaskIds.value = new Set()
        lastSelectedTaskId.value = null
        multiSelectActive.value = false
    }

    const handleTaskClick = (event: MouseEvent, task: Task) => {
        // BUG-1199: Right-click fires @click before @contextmenu — ignore non-left-clicks
        if (event.button !== 0) return
        if (draggingTaskId.value) return

        // BUG-1192: Shift+Click (Range Selection) — activates multi-select bar
        if (event.shiftKey) {
            multiSelectActive.value = true
            if (!lastSelectedTaskId.value) {
                selectedTaskIds.value = new Set([task.id])
                lastSelectedTaskId.value = task.id
                return
            }

            const tasks = inboxTasks.value
            const lastIndex = tasks.findIndex(t => t.id === lastSelectedTaskId.value)
            const currentIndex = tasks.findIndex(t => t.id === task.id)

            if (lastIndex === -1) {
                selectedTaskIds.value = new Set([task.id])
                lastSelectedTaskId.value = task.id
                return
            }

            if (currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex)
                const end = Math.max(lastIndex, currentIndex)
                const rangeTasks = tasks.slice(start, end + 1)

                const newSet = new Set(selectedTaskIds.value)
                rangeTasks.forEach(t => newSet.add(t.id))
                selectedTaskIds.value = newSet
            }
            return
        }

        // BUG-1192: Ctrl/Cmd+Click (Toggle) — activates multi-select bar
        if (event.ctrlKey || event.metaKey) {
            multiSelectActive.value = true
            const newSet = new Set(selectedTaskIds.value)
            if (newSet.has(task.id)) {
                newSet.delete(task.id)
                if (task.id === lastSelectedTaskId.value) {
                    lastSelectedTaskId.value = null
                }
                // If all deselected, deactivate bar
                if (newSet.size === 0) {
                    multiSelectActive.value = false
                }
            } else {
                newSet.add(task.id)
                lastSelectedTaskId.value = task.id
            }
            selectedTaskIds.value = newSet
            return
        }

        // BUG-1192: Single Click — highlight task only, NO selection bar
        multiSelectActive.value = false
        selectedTaskIds.value = new Set([task.id])
        lastSelectedTaskId.value = task.id
    }

    const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
        event.preventDefault()
        event.stopPropagation()

        // Add unselected task to existing selection on right click
        if (selectedTaskIds.value.size > 0 && !selectedTaskIds.value.has(task.id)) {
            selectedTaskIds.value.add(task.id)
            selectedTaskIds.value = new Set(selectedTaskIds.value)
        }

        const selectedIds = selectedTaskIds.value.size > 0
            ? Array.from(selectedTaskIds.value)
            : [task.id]

        window.dispatchEvent(new CustomEvent('task-context-menu', {
            detail: {
                event,
                task,
                selectedIds,
                selectedCount: selectedIds.length,
                instanceId: undefined,
                isCalendarEvent: false
            }
        }))
    }

    // --- Drag and Drop Logic ---

    interface WindowWithDrag extends Window {
        __draggingTaskId?: string
    }

    const onDragStart = (e: DragEvent, task: Task) => {
        if (!e.dataTransfer) return

        draggingTaskId.value = task.id
        e.dataTransfer.effectAllowed = 'move'

        const taskIds = selectedTaskIds.value.has(task.id) && selectedTaskIds.value.size > 1
            ? Array.from(selectedTaskIds.value)
            : [task.id]

        const dragData = {
            ...task,
            taskId: task.id,
            taskIds: taskIds,
            selectedCount: taskIds.length,
            fromInbox: true,
            source: `unified-inbox-${context}`
        }
        e.dataTransfer.setData('application/json', JSON.stringify(dragData))

            // Set global drag state
            ; (window as WindowWithDrag).__draggingTaskId = task.id
        document.documentElement.setAttribute('data-dragging-task-id', task.id)
    }

    const onDragEnd = () => {
        draggingTaskId.value = null
        delete (window as WindowWithDrag).__draggingTaskId
        document.documentElement.removeAttribute('data-dragging-task-id')
    }

    // --- Send to Canvas ---

    /**
     * GEOMETRY WRITER: Sends a task from inbox to canvas (TASK-255 compliant)
     *
     * This is an ALLOWED geometry write because:
     * 1. Explicit user action (button click)
     * 2. One-time placement at send time (not reactive)
     * 3. Single atomic write (parentId + canvasPosition together)
     *
     * If task has a dueDate, matches it to a Smart Group (Today, Tomorrow, etc.)
     * Otherwise places at canvas root.
     */
    const sendToCanvas = async (taskId: string) => {
        const task = taskStore.getTask(taskId)
        if (!task) {
            console.warn('[sendToCanvas] Task not found:', taskId)
            return
        }

        // Find matching group based on task's dueDate
        const allGroups = canvasStore._rawGroups || []
        const targetGroup = findMatchingGroupForDueDate(task.dueDate, allGroups)

        let canvasPosition: { x: number; y: number }
        let parentId: string | undefined

        if (targetGroup) {
            parentId = targetGroup.id
            canvasPosition = calculatePositionInGroup(targetGroup, taskStore.tasks)
            console.log(`[sendToCanvas] Task "${task.title}" matched to group "${targetGroup.name}"`, {
                taskId,
                dueDate: task.dueDate,
                groupId: parentId,
                position: canvasPosition
            })
        } else {
            // Fallback: place at root with default position
            // Position will be spread based on existing root-level tasks
            const rootTasks = taskStore.tasks.filter(t =>
                !t.parentId && t.canvasPosition && !t.isInInbox
            )
            const offsetY = rootTasks.length * 100
            canvasPosition = { x: 200, y: 200 + offsetY }
            console.log(`[sendToCanvas] Task "${task.title}" placed at root (no matching group)`, {
                taskId,
                dueDate: task.dueDate,
                position: canvasPosition
            })
        }

        try {
            // Single atomic update - GEOMETRY WRITER
            await updateTaskWithUndo(taskId, {
                canvasPosition,
                parentId,
                isInInbox: false
            })

            return { success: true, groupName: targetGroup?.name || 'Canvas' }
        } catch (error) {
            console.error('[sendToCanvas] Failed to send task to canvas:', error)
            showToast('Failed to send task to canvas', 'error')
            return { success: false }
        }
    }

    /**
     * Send a single task to canvas with toast notification
     */
    const sendTaskToCanvas = async (task: Task) => {
        const allGroups = canvasStore._rawGroups || []
        const placementLabel = getPlacementLabel(task.dueDate, allGroups)

        const result = await sendToCanvas(task.id)

        if (result?.success) {
            showToast(`Sent to ${placementLabel}`, 'success', { duration: 2000 })
        }
    }

    /**
     * Send all selected tasks to canvas
     * Each task is matched individually to its appropriate group
     */
    const sendSelectedToCanvas = async () => {
        if (selectedTaskIds.value.size === 0) return

        const taskIds = Array.from(selectedTaskIds.value)
        let successCount = 0
        const groupCounts = new Map<string, number>()

        for (const taskId of taskIds) {
            const task = taskStore.getTask(taskId)
            if (!task) continue

            const result = await sendToCanvas(taskId)
            if (result?.success) {
                successCount++
                const groupName = result.groupName || 'Canvas'
                groupCounts.set(groupName, (groupCounts.get(groupName) || 0) + 1)
            }
        }

        clearSelection()

        // Show summary toast
        if (successCount > 0) {
            if (groupCounts.size === 1) {
                const [groupName, count] = [...groupCounts.entries()][0]
                showToast(
                    `Sent ${count} task${count > 1 ? 's' : ''} to ${groupName}`,
                    'success',
                    { duration: 2500 }
                )
            } else {
                showToast(
                    `Sent ${successCount} tasks to canvas`,
                    'success',
                    { duration: 2500 }
                )
            }
        }
    }

    return {
        // State
        selectedTaskIds,
        multiSelectMode,
        draggingTaskId,

        // Actions
        addTask,
        deleteSelectedTasks,
        clearSelection,
        handleTaskClick,
        handleTaskKeydown,
        handleTaskContextMenu,
        onDragStart,
        onDragEnd,

        // Send to Canvas
        sendTaskToCanvas,
        sendSelectedToCanvas
    }
}
