import { type Ref } from 'vue'
import type { Task } from '@/stores/tasks'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'

export function useTaskRowActions(
    props: { task: Task; indentLevel: number; hasSubtasks: boolean; isExpanded: boolean },
    emit: (event: string, ...args: any[]) => void,
    state: {
        isDragging: Ref<boolean>
        isDropTarget: Ref<boolean>
        isFocused: Ref<boolean>
        isHovered: Ref<boolean>
        showTouchFeedback?: Ref<boolean>
        touchFeedbackStyle?: Ref<unknown>
    }
) {
    const { startDrag, endDrag, dragData: activeDragData } = useDragAndDrop()

    const isEditableKeyboardTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false
        const tagName = target.tagName
        return tagName === 'INPUT' ||
            tagName === 'TEXTAREA' ||
            tagName === 'SELECT' ||
            target.isContentEditable
    }

    // --- Drag and Drop ---

    const handleDragStart = (event: DragEvent) => {
        if (!event.dataTransfer) return

        state.isDragging.value = true

        const dragData: DragData = {
            type: 'task',
            taskId: props.task.id,
            title: props.task.title,
            source: 'kanban', // Using kanban/list as generic source
            ghostMode: 'always'
        }

        console.log('[DND-GROUP] dragStart', { taskId: props.task.id, title: props.task.title })

        event.dataTransfer.setData('application/json', JSON.stringify(dragData))
        event.dataTransfer.effectAllowed = 'move'

        // Unified ghost pill — startDrag creates it and calls setDragImage
        startDrag(dragData, event)
    }

    const handleDragEnd = () => {
        state.isDragging.value = false
        state.isDropTarget.value = false
        endDrag()
    }

    const handleDragOver = (event: DragEvent) => {
        event.preventDefault()
        state.isDropTarget.value = true
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move'
        }
    }

    const handleDragLeave = () => {
        state.isDropTarget.value = false
    }

    const handleDrop = (event: DragEvent) => {
        event.preventDefault()
        state.isDropTarget.value = false

        // Use dragData singleton first (WebKitGTK/Tauri returns empty from dataTransfer.getData)
        let dragData: DragData | null = activeDragData.value
        if (!dragData) {
            const dataString = event.dataTransfer?.getData('application/json')
            if (dataString) {
                try { dragData = JSON.parse(dataString) as DragData } catch { /* ignore */ }
            }
        }

        console.log('[DND-GROUP] handleDrop on row', { targetTaskId: props.task.id, targetTitle: props.task.title, hasData: !!dragData })
        if (!dragData) return

        if (dragData.type === 'task' && dragData.taskId && dragData.taskId !== props.task.id) {
            console.log('[DND-GROUP] emitting moveTask', { draggedId: dragData.taskId, targetParentId: props.task.id })
            emit('moveTask', dragData.taskId, props.task.projectId || null, props.task.id)
        }
    }

    // --- User Interactions ---

    const handleRowClick = (event?: MouseEvent) => {
        if (event && (event.ctrlKey || event.metaKey)) {
            emit('check', props.task.id)
            return
        }
        emit('select', props.task.id)
    }

    const handleToggleComplete = () => {
        emit('toggleComplete', props.task.id)
    }

    const toggleExpanded = () => {
        if (props.hasSubtasks) {
            emit('toggleExpand', props.task.id)
        }
    }

    // --- Keyboard & Focus ---

    const handleFocusIn = () => {
        state.isFocused.value = true
    }

    const handleFocusOut = () => {
        state.isFocused.value = false
    }

    const handleMouseEnter = () => {
        state.isHovered.value = true
    }

    const handleMouseLeave = () => {
        state.isHovered.value = false
    }

    const handleKeyDown = (event: KeyboardEvent) => {
        if (isEditableKeyboardTarget(event.target)) return

        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault()
                handleRowClick()
                break
            case 'ArrowRight':
                if (props.hasSubtasks && !props.isExpanded) {
                    event.preventDefault()
                    toggleExpanded()
                }
                break
            case 'ArrowLeft':
                if (props.hasSubtasks && props.isExpanded) {
                    event.preventDefault()
                    toggleExpanded()
                }
                break
            case 'd':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault()
                    emit('toggleComplete', props.task.id)
                }
                break
            case 'e':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault()
                    emit('edit', props.task.id)
                }
                break
        }
    }

    // --- Touch Support ---

    const handleTouchStart = (event: TouchEvent) => {
        // Only applied if checkMobile was true in state (logic handled there or by consumer)
        // We'll leave the conditional check to the template or strict mobile mode
        // but here we just provide the handler logic

        // Simple feedback logic reuse if provided
        if (state.showTouchFeedback && state.touchFeedbackStyle) {
            const touch = event.touches[0]
            const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect()
            if (rect) {
                state.touchFeedbackStyle.value = {
                    left: `${touch.clientX - rect.left}px`,
                    top: `${touch.clientY - rect.top}px`
                }
                state.showTouchFeedback.value = true
            }
        }
    }

    const handleTouchEnd = () => {
        if (state.showTouchFeedback) {
            setTimeout(() => {
                state.showTouchFeedback!.value = false
            }, 200)
        }
    }

    // --- Action Wrapper Helpers ---

    const updateTaskStatus = (taskId: string, status: string) => {
        emit('updateTask', taskId, { status })
    }

    const cyclePriority = (taskId: string, currentPriority?: string | null) => {
        const priorities = ['low', 'medium', 'high'] as const
        const currentIndex = priorities.indexOf((currentPriority || 'medium') as typeof priorities[number])
        const nextIndex = (currentIndex + 1) % priorities.length
        emit('updateTask', taskId, { priority: priorities[nextIndex] })
    }

    return {
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleRowClick,
        handleToggleComplete,
        toggleExpanded,
        handleFocusIn,
        handleFocusOut,
        handleMouseEnter,
        handleMouseLeave,
        handleKeyDown,
        handleTouchStart,
        handleTouchEnd,
        updateTaskStatus,
        cyclePriority
    }
}
