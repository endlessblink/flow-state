import { ref, computed } from 'vue'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'

export function useUnifiedInboxActions(
    inboxTasks: { value: Task[] },
    context: string
) {
    const taskStore = useTaskStore()
    const { createTaskWithUndo } = useUnifiedUndoRedo()

    // Multi-select state (Actions)
    const selectedTaskIds = ref<Set<string>>(new Set())
    const lastSelectedTaskId = ref<string | null>(null)
    const multiSelectMode = computed(() => selectedTaskIds.value.size > 0)
    const draggingTaskId = ref<string | null>(null)

    // --- Task Operations ---

    const addTask = (title: string, options?: { priority?: string; dueDate?: Date }) => {
        if (!title.trim()) return

        createTaskWithUndo({
            title: title.trim(),
            status: 'planned',
            isInInbox: true,
            ...(options?.priority && { priority: options.priority as 'low' | 'medium' | 'high' }),
            ...(options?.dueDate && { dueDate: options.dueDate.toISOString() })
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
    }

    const handleTaskClick = (event: MouseEvent, task: Task) => {
        if (draggingTaskId.value) return

        // Shift+Click (Range Selection)
        if (event.shiftKey) {
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

        // Ctrl/Cmd+Click (Toggle)
        if (event.ctrlKey || event.metaKey) {
            const newSet = new Set(selectedTaskIds.value)
            if (newSet.has(task.id)) {
                newSet.delete(task.id)
                if (task.id === lastSelectedTaskId.value) {
                    lastSelectedTaskId.value = null
                }
            } else {
                newSet.add(task.id)
                lastSelectedTaskId.value = task.id
            }
            selectedTaskIds.value = newSet
            return
        }

        // Single Click
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
        onDragEnd
    }
}
