import { ref } from 'vue'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'

export function useTaskNodeActions(
    props: {
        task: Task;
        isSelected?: boolean;
        isConnecting?: boolean;
        isDragging?: boolean;
        // TASK-262: Callback prop for selection - bypasses Vue's broken emit in Vue Flow
        selectCallback?: (task: Task, multiSelect: boolean) => void;
    },
    emit: {
        (e: 'edit', task: Task): void;
        (e: 'select', task: Task, multiSelect: boolean): void;
        (e: 'contextMenu', event: MouseEvent, task: Task): void;
    }
) {
    const taskStore = useTaskStore()

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

    // Interaction Handlers
    const handleClick = (event: MouseEvent) => {
        if (!props.task) return

        // BUG-007 + BUG-FIX: Ctrl/Cmd OR Shift triggers multi-select toggle
        const isMultiSelectClick = event.ctrlKey || event.metaKey || event.shiftKey

        console.log('[DEBUG] TaskNode Click', {
            id: props.task.id,
            ctrl: event.ctrlKey,
            meta: event.metaKey,
            shift: event.shiftKey,
            isMultiSelect: isMultiSelectClick
        })

        // Prevent edit modal when connecting to avoid conflicts
        if (props.isConnecting) {
            triggerSelect(props.task, isMultiSelectClick)
            return
        }

        // Ctrl/Cmd+click toggles selection (for multi-select)
        // CRITICAL: stopPropagation prevents Vue Flow from processing this click
        // and overriding our custom multi-select behavior
        if (isMultiSelectClick) {
            console.log('[DEBUG] Stopping propagation for multi-select click')
            event.stopPropagation()
            triggerSelect(props.task, true)
            return
        }

        // If task is already selected and clicking again (without modifiers), open edit modal
        if (props.isSelected) {
            emit('edit', props.task)
        } else {
            // Single click on unselected task - trigger selection
            triggerSelect(props.task, false)
        }
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

    return {
        isDescriptionExpanded,
        isDescriptionLong,
        toggleDescriptionExpanded,
        handleCheckboxClick,
        handleClick,
        handleContextMenu
    }
}
