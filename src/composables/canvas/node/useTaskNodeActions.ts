import { ref } from 'vue'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'
import { formatDateKey } from '@/utils/dateUtils'

export function useTaskNodeActions(
    props: {
        task: Task;
        isSelected?: boolean;
        isConnecting?: boolean;
        isDragging?: boolean;
        // TASK-262: Callback prop for selection - bypasses Vue's broken emit in Vue Flow
        selectCallback?: (task: Task, multiSelect: boolean) => void;
        // TASK-279: Callback prop for edit - bypasses Vue's broken emit in Vue Flow
        editCallback?: (task: Task) => void;
    },
    emit: {
        (e: 'edit', task: Task): void;
        (e: 'select', task: Task, multiSelect: boolean): void;
        (e: 'contextMenu', event: MouseEvent, task: Task): void;
    }
) {
    const taskStore = useTaskStore()

    // TASK-279: Manual double-click detection
    // Native dblclick doesn't work because DOM changes between clicks (selection indicator appears)
    const DOUBLE_CLICK_THRESHOLD = 350 // ms
    let lastClickTime = 0
    let lastClickTaskId: string | null = null

    // Description expansion state
    const isDescriptionExpanded = ref(false)
    const DESCRIPTION_MAX_LENGTH = 100

    // Check if description is long enough for truncation
    const isDescriptionLong = (description?: string) => {
        return description && description.length > DESCRIPTION_MAX_LENGTH
    }

    // Toggle description expansion
    const toggleDescriptionExpanded = () => {
        isDescriptionExpanded.value = !isDescriptionExpanded.value
    }

    // TASK-075: Checkbox interactivity logic
    const handleCheckboxClick = (clickedIndex: number) => {
        const description = props.task?.description || ''
        const checkboxPattern = /- \[([ x])\]/g
        const matches = [...description.matchAll(checkboxPattern)]

        if (clickedIndex >= 0 && clickedIndex < matches.length) {
            let currentIndex = 0
            const newDescription = description.replace(checkboxPattern, (match) => {
                if (currentIndex === clickedIndex) {
                    currentIndex++
                    return match === '- [ ]' ? '- [x]' : '- [ ]'
                }
                currentIndex++
                return match
            })
            taskStore.updateTask(props.task.id, { description: newDescription })
        }
    }

    // TASK-262: Helper to call selection - uses callback prop if available, falls back to emit
    const triggerSelect = (task: Task, multiSelect: boolean) => {
        if (props.selectCallback) {
            // Use callback prop (works in Vue Flow custom nodes)
            props.selectCallback(task, multiSelect)
        } else {
            // Fallback to emit (works outside Vue Flow)
            emit('select', task, multiSelect)
        }
    }

    // TASK-279: Helper to call edit - uses callback prop if available, falls back to emit
    const triggerEdit = (task: Task) => {
        if (props.editCallback) {
            // Use callback prop (works in Vue Flow custom nodes)
            props.editCallback(task)
        } else {
            // Fallback to emit (works outside Vue Flow)
            emit('edit', task)
        }
    }

    // Interaction Handlers
    const handleClick = (event: MouseEvent) => {
        if (!props.task) return

        const now = Date.now()
        const timeSinceLastClick = now - lastClickTime
        const isSameTask = lastClickTaskId === props.task.id

        // TASK-279: Manual double-click detection
        // Check if this is a double-click (same task, within threshold)
        const isDoubleClick = isSameTask && timeSinceLastClick < DOUBLE_CLICK_THRESHOLD

        // Debug logging removed - uncomment if needed for debugging
        // console.log('[DEBUG] TaskNode Click', { id: props.task.id, timeSinceLastClick, isDoubleClick })

        // Update last click tracking
        lastClickTime = now
        lastClickTaskId = props.task.id

        // TASK-279: Handle double-click - open edit modal
        if (isDoubleClick && !props.isConnecting) {
            event.stopPropagation()
            triggerEdit(props.task)
            // Reset tracking to prevent triple-click issues
            lastClickTime = 0
            lastClickTaskId = null
            return
        }

        // BUG-007 + BUG-FIX: Ctrl/Cmd OR Shift triggers multi-select toggle
        const isMultiSelectClick = event.ctrlKey || event.metaKey || event.shiftKey

        // Prevent edit modal when connecting to avoid conflicts
        if (props.isConnecting) {
            triggerSelect(props.task, isMultiSelectClick)
            return
        }

        // Ctrl/Cmd+click toggles selection (for multi-select)
        // CRITICAL: stopPropagation prevents Vue Flow from processing this click
        // and overriding our custom multi-select behavior
        if (isMultiSelectClick) {
            event.stopPropagation()
            triggerSelect(props.task, true)
            return
        }

        // Single click on unselected task - trigger selection
        triggerSelect(props.task, false)
    }

    const handleContextMenu = (event: MouseEvent) => {
        if (!props.task) return

        // Don't show context menu if we're currently dragging or connecting
        // Note: This relies on props.isDragging which comes from the parent
        if (props.isDragging) {
            event.preventDefault()
            event.stopPropagation()
            return
        }

        emit('contextMenu', event, props.task)
    }

    const handleMouseDown = (event: MouseEvent) => {
        // BUG-MIX: Stop propagation on Shift+Mousedown to prevent Vue Flow Box Selection
        if (event.shiftKey) {
            event.stopPropagation()
            // Toggle selection logic immediately
            triggerSelect(props.task, true) // Force multi-select toggle
        }
    }

    // TASK-282: Reschedule overdue task
    const handleReschedule = (dateType: string) => {
        if (!props.task) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let newDueDate: string | null = null

        switch (dateType) {
            case 'today':
                newDueDate = formatDateKey(today)
                break
            case 'tomorrow': {
                const tomorrow = new Date(today)
                tomorrow.setDate(today.getDate() + 1)
                newDueDate = formatDateKey(tomorrow)
                break
            }
            case 'this_weekend': {
                // Find next Saturday
                const saturday = new Date(today)
                const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
                saturday.setDate(today.getDate() + daysUntilSaturday)
                newDueDate = formatDateKey(saturday)
                break
            }
            case 'next_week': {
                // Find next Monday
                const monday = new Date(today)
                const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7
                monday.setDate(today.getDate() + daysUntilMonday)
                newDueDate = formatDateKey(monday)
                break
            }
            case 'pick_date':
                // For "pick a date", open the edit modal
                triggerEdit(props.task)
                return
        }

        if (newDueDate) {
            console.log(`📅 [TASK-282] Rescheduling task "${props.task.title}" to ${newDueDate}`)
            taskStore.updateTaskWithUndo(props.task.id, { dueDate: newDueDate })
        }
    }

    return {
        isDescriptionExpanded,
        isDescriptionLong,
        toggleDescriptionExpanded,
        handleCheckboxClick,
        handleClick,
        handleMouseDown,
        handleContextMenu,
        handleReschedule, // TASK-282
        triggerEdit
    }
}
