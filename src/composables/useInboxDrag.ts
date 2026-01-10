import { type Task } from '@/stores/tasks'

export function useInboxDrag() {
    const handleDragStart = (event: DragEvent, task: Task) => {
        // Fix for Shift+Click: Prevent drag if Shift is held so click event can fire
        if (event.shiftKey) {
            event.preventDefault()
            return
        }

        if (event.dataTransfer) {
            event.dataTransfer.setData('application/json', JSON.stringify({
                type: 'task',
                taskId: task.id,
                taskIds: [task.id], // For batch operation compatibility
                title: task.title,
                fromInbox: true,
                source: 'inbox'
            }))
            event.dataTransfer.effectAllowed = 'move'
        }
    }

    return {
        handleDragStart
    }
}
