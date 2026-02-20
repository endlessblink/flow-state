import { ref, computed, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'

import type { CalendarEvent } from '@/types/tasks'

/**
 * Calendar interaction handlers composable
 * Manages context menus, clicks, double clicks, hover, and selection logic
 *
 * TASK-1362: Selection is fully reactive — selectedEventIds computed set drives
 * :class bindings in Day/Week/Month views. No DOM classList manipulation.
 */
export function useCalendarInteractionHandlers(
    isDragging: Ref<boolean>,
    viewMode: Ref<'day' | 'week' | 'month'>,
    handleEditTask: (taskId: string) => void,
    handleConfirmDelete: (taskId: string) => void,
    monthDayClickHandler: (dateString: string, viewMode: Ref<'day' | 'week' | 'month'>) => void
) {
    const taskStore = useTaskStore()

    // State
    const selectedCalendarEvents = ref<CalendarEvent[]>([])
    const hoveredEventId = ref<string | null>(null)

    // TASK-1362: Reactive set of selected event IDs for :class bindings
    const selectedEventIds = computed(() =>
        new Set(selectedCalendarEvents.value.map(e => e.id))
    )

    /**
     * Tracker for hover events on slot tasks
     */
    const handleSlotTaskMouseEnter = (eventId: string) => {
        hoveredEventId.value = eventId
    }

    const handleSlotTaskMouseLeave = () => {
        hoveredEventId.value = null
    }

    /**
     * Handle double click on calendar event (Edit)
     */
    const handleEventDblClick = (calendarEvent: CalendarEvent) => {
        handleEditTask(calendarEvent.taskId)
    }

    /**
     * Handle context menu trigger on calendar event
     */
    const handleEventContextMenu = (mouseEvent: MouseEvent, calendarEvent: CalendarEvent) => {
        mouseEvent.preventDefault()
        mouseEvent.stopPropagation()

        console.log('📋 [CALENDAR-CTX] handleEventContextMenu called:', {
            taskId: calendarEvent.taskId,
            instanceId: calendarEvent.instanceId,
            mouseX: mouseEvent.clientX,
            mouseY: mouseEvent.clientY
        })

        // BUG-1291: Use getTask() (searches _rawTasks) instead of tasks.find()
        // taskStore.tasks is filtered by smart views/projects — calendar tasks may not be in it
        const task = taskStore.getTask(calendarEvent.taskId)
        if (!task) {
            console.error('📋 [CALENDAR-CTX] Task NOT FOUND in store for calendarEvent:', {
                taskId: calendarEvent.taskId,
                totalTasks: taskStore.tasks.length,
                taskIds: taskStore.tasks.slice(0, 5).map(t => t.id)
            })
            return
        }

        console.log('📋 [CALENDAR-CTX] Dispatching task-context-menu event for task:', task.title)

        // Dispatch global event for ModalManager to handle
        window.dispatchEvent(new CustomEvent('task-context-menu', {
            detail: {
                event: mouseEvent,
                task,
                instanceId: calendarEvent.instanceId,
                isCalendarEvent: true
            }
        }))
    }

    /**
     * Unschedule a task (remove from calendar)
     */
    const handleRemoveFromCalendar = (calendarEvent: CalendarEvent) => {
        taskStore.unscheduleTask(calendarEvent.taskId)
    }

    /**
     * TASK-1362: Clear all selected calendar events
     */
    const clearSelection = () => {
        selectedCalendarEvents.value = []
    }

    /**
     * Handle single click on calendar event (Selection)
     * TASK-1362: Fully reactive — no DOM classList manipulation
     */
    const handleEventClick = (mouseEvent: MouseEvent, calendarEvent: CalendarEvent) => {
        const isCtrlOrCmd = mouseEvent.ctrlKey || mouseEvent.metaKey

        // Don't handle clicks if dragging
        if (isDragging.value) return

        if (isCtrlOrCmd) {
            // Toggle selection (multi-select)
            const index = selectedCalendarEvents.value.findIndex(e => e.id === calendarEvent.id)
            if (index > -1) {
                selectedCalendarEvents.value.splice(index, 1)
            } else {
                selectedCalendarEvents.value.push(calendarEvent)
            }
        } else {
            // Single-click: toggle single selection or replace
            if (selectedCalendarEvents.value.length === 1 && selectedCalendarEvents.value[0].id === calendarEvent.id) {
                selectedCalendarEvents.value = []
            } else {
                selectedCalendarEvents.value = [calendarEvent]
            }
        }
    }

    /**
     * Handle keyboard shortcuts for selected events
     * TASK-1362:
     * - Delete/Backspace → unschedule (return to calendar inbox)
     * - Shift+Delete → permanently delete tasks
     */
    const handleKeyDown = (event: KeyboardEvent) => {
        const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'
        if (!isDeleteKey) return
        if (selectedCalendarEvents.value.length === 0) return

        // Don't capture if user is typing in an input/textarea
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

        event.preventDefault()
        event.stopPropagation()

        if (event.shiftKey) {
            // Shift+Delete: permanently delete tasks
            selectedCalendarEvents.value.forEach(calendarEvent => {
                handleConfirmDelete(calendarEvent.taskId)
            })
        } else {
            // Delete: remove calendar instance(s), return task to inbox
            selectedCalendarEvents.value.forEach(calendarEvent => {
                if (calendarEvent.instanceId) {
                    // Remove specific calendar instance — task keeps its dueDate
                    taskStore.deleteTaskInstanceWithUndo(calendarEvent.taskId, calendarEvent.instanceId)
                } else {
                    // Fallback: fully unschedule if no specific instance
                    taskStore.unscheduleTaskWithUndo(calendarEvent.taskId)
                }
            })
        }

        // Clear selection
        selectedCalendarEvents.value = []
    }

    /**
     * Handle Escape key to clear selection
     */
    const handleEscapeKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && selectedCalendarEvents.value.length > 0) {
            event.preventDefault()
            selectedCalendarEvents.value = []
        }
    }

    /**
     * Switch to day view when clicking a day in month view
     */
    const handleMonthDayClick = (dateString: string) => {
        monthDayClickHandler(dateString, viewMode)
    }

    return {
        selectedCalendarEvents,
        selectedEventIds,
        hoveredEventId,
        handleSlotTaskMouseEnter,
        handleSlotTaskMouseLeave,
        handleEventDblClick,
        handleEventContextMenu,
        handleRemoveFromCalendar,
        handleEventClick,
        handleKeyDown,
        handleEscapeKey,
        handleMonthDayClick,
        clearSelection
    }
}
