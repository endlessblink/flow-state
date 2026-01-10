import { ref } from 'vue'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'

export function useTaskNodeActions(
    props: {
        task: Task;
        isSelected?: boolean;
        isConnecting?: boolean;
        isDragging?: boolean;
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

    // Interaction Handlers
    const handleClick = (event: MouseEvent) => {
        if (!props.task) return

        // BUG-007: Only Ctrl/Cmd triggers multi-select toggle
        const isMultiSelectClick = event.ctrlKey || event.metaKey

        // Prevent edit modal when connecting to avoid conflicts
        if (props.isConnecting) {
            // Don't emit edit event when connecting, just handle selection
            emit('select', props.task, isMultiSelectClick)
            return
        }

        // Ctrl/Cmd+click toggles selection (for multi-select)
        // CRITICAL: stopPropagation prevents Vue Flow from processing this click
        // and overriding our custom multi-select behavior
        if (isMultiSelectClick) {
            event.stopPropagation()
            emit('select', props.task, true)
            return
        }

        // If task is already selected and clicking again (without modifiers), open edit modal
        if (props.isSelected) {
            emit('edit', props.task)
        } else {
            // Single click on unselected task - select it (replacing other selections)
            emit('select', props.task, false)
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
