import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { retainVisibleSelection } from '@/utils/selectionVisibility'

export function useAppShortcuts() {
    const router = useRouter()
    const taskStore = useTaskStore()


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

    const visibleSelectedTaskIds = () => {
        const renderedIds = Array.from(
            document.querySelectorAll<HTMLElement>('[data-task-id]')
        ).flatMap(element => element.dataset.taskId ? [element.dataset.taskId] : [])
        return retainVisibleSelection(taskStore.selectedTaskIds, renderedIds)
    }

    const reconcileSelectionToRenderedTasks = () => {
        const visibleIds = visibleSelectedTaskIds()
        if (visibleIds.length !== taskStore.selectedTaskIds.length) {
            taskStore.clearSelection()
            visibleIds.forEach(taskId => taskStore.selectTask(taskId))
        }
        return visibleIds
    }

    const handleDeleteSelectedTasks = async () => {
        const selectedTaskIds = reconcileSelectionToRenderedTasks()
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

        // Ctrl+Shift+F opens search. Require Ctrl/Cmd to avoid accidental typing.
        const isSearchKey = event.key === 'F' || event.code === 'KeyF'
        const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && isSearchKey
        if (isSearchShortcut) {
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
            const selectedTaskIds = reconcileSelectionToRenderedTasks()
            if (selectedTaskIds.length === 1) {
                window.dispatchEvent(new CustomEvent('open-task-edit', {
                    detail: { taskId: selectedTaskIds[0] }
                }))
            }
        }

        // Alt+N to open Quick Task Create modal
        if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'n') {
            event.preventDefault()
            window.dispatchEvent(new CustomEvent('open-quick-task-create'))
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

        // ? to toggle keyboard shortcuts panel (TASK-1319)
        // Use event.code for layout-independent detection (Hebrew layout Shift+/ doesn't produce '?')
        if ((event.key === '?' || (event.shiftKey && event.code === 'Slash')) && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault()
            window.dispatchEvent(new CustomEvent('open-shortcuts-panel'))
        }

        // Ctrl+. (or Cmd+.) to open AI Assist for the selected task (TASK-1470)
        // Follows VS Code convention for quick actions/suggestions. Ctrl+/ is taken by AI Chat toggle.
        if ((event.ctrlKey || event.metaKey) && event.key === '.') {
            event.preventDefault()
            const selectedTaskIds = reconcileSelectionToRenderedTasks()
            if (selectedTaskIds.length === 1) {
                window.dispatchEvent(new CustomEvent('open-ai-assist', {
                    detail: { taskId: selectedTaskIds[0] }
                }))
            } else if (selectedTaskIds.length === 0) {
                // No selection — open with no specific task (will show command palette hint instead)
                window.dispatchEvent(new CustomEvent('open-ai-assist', { detail: { taskId: null } }))
            }
        }
    }

    return {
        handleKeydown,
        handleDeleteSelectedTasks
    }
}
