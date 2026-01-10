import { type Ref } from 'vue'
import { type Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'

export function useTaskCardActions(
    props: { task: Task; disabled?: boolean },
    emit: (event: string, ...args: any[]) => void,
    state: {
        isExpanded: Ref<boolean>
        isFocused: Ref<boolean>
        isPressed: Ref<boolean>
        isSelected: Ref<boolean>
        cardRef: Ref<HTMLElement | null>
        progressiveDisclosureEnabled: Ref<boolean>
    }
) {
    const taskStore = useTaskStore()

    // --- Handlers ---

    const handleCardClick = (event: MouseEvent) => {
        if (props.disabled) return
        event.preventDefault()

        if (state.progressiveDisclosureEnabled.value) {
            state.isExpanded.value = !state.isExpanded.value
        } else {
            handleSelectionClick(event)
        }
    }

    const handleSelectionClick = (event: MouseEvent) => {
        if (event.ctrlKey || event.metaKey) {
            // Multi-select toggle
            if (state.isSelected.value) {
                taskStore.deselectTask(props.task.id)
            } else {
                taskStore.selectTask(props.task.id)
            }
        } else {
            // Single select
            taskStore.clearSelection()
            emit('select', props.task.id)
        }
    }

    const handleKeydown = (event: KeyboardEvent) => {
        if (props.disabled) return

        switch (event.key) {
            case 'Enter':
            case ' ': {
                event.preventDefault()
                state.isPressed.value = true

                // Synthetic click for consistent behavior
                const syntheticEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                })
                handleCardClick(syntheticEvent)

                setTimeout(() => {
                    state.isPressed.value = false
                }, 150)
                break
            }

            case 'ArrowRight':
            case 'ArrowDown': {
                event.preventDefault()
                // Try to focus the status button
                const statusButton = state.cardRef.value?.querySelector('.status-icon-button') as HTMLElement
                statusButton?.focus()
                break
            }

            case 'e':
            case 'E':
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault()
                    emit('edit', props.task.id)
                }
                break

            case 't':
            case 'T':
                if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault()
                    emit('startTimer', props.task.id)
                }
                break

            case 'Delete':
            case 'Backspace':
                event.preventDefault()
                emit('delete', props.task.id)
                break
        }
    }

    const handleFocus = (event: FocusEvent) => {
        state.isFocused.value = true
        emit('focus', event)
    }

    const handleBlur = (event: FocusEvent) => {
        state.isFocused.value = false
        emit('blur', event)
    }

    const handleRightClick = (event: MouseEvent) => {
        emit('contextMenu', event, props.task)
    }

    // --- Status Logic ---

    const cycleStatus = () => {
        const statusCycle: Task['status'][] = ['planned', 'in_progress', 'done', 'backlog', 'on_hold']
        const currentStatus = props.task.status || 'backlog'
        const currentIndex = statusCycle.indexOf(currentStatus)
        const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length]

        emit('select', props.task.id)
        taskStore.updateTask(props.task.id, { status: nextStatus })
    }

    return {
        handleCardClick,
        handleKeydown,
        handleFocus,
        handleBlur,
        handleRightClick,
        cycleStatus
    }
}
