import { ref } from 'vue'
import type { Task } from '@/stores/tasks'

export function useBoardContextMenu() {
    const showContextMenu = ref(false)
    const contextMenuX = ref(0)
    const contextMenuY = ref(0)
    const contextMenuTask = ref<Task | null>(null)

    const openContextMenu = (event: MouseEvent, task: Task) => {
        contextMenuX.value = event.clientX
        contextMenuY.value = event.clientY
        contextMenuTask.value = task
        showContextMenu.value = true
    }

    const closeContextMenu = () => {
        showContextMenu.value = false
        contextMenuTask.value = null
    }

    return {
        showContextMenu,
        contextMenuX,
        contextMenuY,
        contextMenuTask,
        openContextMenu,
        closeContextMenu
    }
}
