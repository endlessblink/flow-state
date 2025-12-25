import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem } from '@/composables/undoSingleton'

export function useAppShortcuts() {
    const router = useRouter()
    const taskStore = useTaskStore()
    const undoHistory = getUndoSystem()

    // Route mapping for keyboard shortcuts
    const viewRouteMap = {
        '1': '/',
        '2': '/calendar',
        '3': '/canvas',
        '4': '/catalog',
        '5': '/quick-sort'
    }

    const shouldIgnoreElement = (target: HTMLElement | null): boolean => {
        if (!target) return false
        // Guard against non-Element targets (like document)
        if (!target.classList) return false
        if (target.classList.contains('quick-task-input') ||
            target.closest('.quick-task-section')) {
            return false
        }
        if (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable) {
            return true
        }
        const closestModal = target.closest('[role="dialog"], .modal, .n-modal')
        if (closestModal) return true
        return false
    }

    const handleDeleteSelectedTasks = async () => {
        const selectedTaskIds = [...taskStore.selectedTaskIds]
        if (selectedTaskIds.length === 0) return

        // Instead of showing confirmation here, we could emit an event
        // or just call a taskStore method that triggers the confirmation
        // For now, let's emit a global event that ModalManager can catch
        window.dispatchEvent(new CustomEvent('confirm-delete-selected'))
    }

    const handleKeydown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement
        if (shouldIgnoreElement(target)) return

        // Cmd/Ctrl+K to open Command Palette
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault()
            window.dispatchEvent(new CustomEvent('open-command-palette'))
        }

        // Cmd/Ctrl+P to open search
        if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
            event.preventDefault()
            window.dispatchEvent(new CustomEvent('open-search'))
        }

        // Shift+Delete to delete selected tasks
        if (event.shiftKey && event.key === 'Delete') {
            event.preventDefault()
            handleDeleteSelectedTasks()
        }

        // Ctrl+E (or Cmd+E) to edit selected task
        if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
            event.preventDefault()
            if (taskStore.selectedTaskIds.length === 1) {
                window.dispatchEvent(new CustomEvent('open-task-edit', {
                    detail: { taskId: taskStore.selectedTaskIds[0] }
                }))
            }
        }

        // Shift+1-5 for view switching
        if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const key = event.key
            if (key >= '1' && key <= '5') {
                const route = viewRouteMap[key as keyof typeof viewRouteMap]
                if (route) {
                    event.preventDefault()
                    router.push(route)
                }
            }
        }
    }

    return {
        handleKeydown,
        handleDeleteSelectedTasks
    }
}
