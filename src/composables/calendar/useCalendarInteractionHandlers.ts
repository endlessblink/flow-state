import { ref, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import type { CalendarEvent } from '@/types/tasks'

/**
 * Calendar interaction handlers composable
 * Manages context menus, clicks, double clicks, hover, and selection logic
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
    const showContextMenu = ref(false)
    const contextMenuX = ref(0)
    const contextMenuY = ref(0)
    const contextMenuTask = ref<Task | null>(null)
    const selectedCalendarEvents = ref<CalendarEvent[]>([])
    const hoveredEventId = ref<string | null>(null)

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
     * Close the task context menu
     */
    const closeContextMenu = () => {
        showContextMenu.value = false
        contextMenuTask.value = null
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

        const task = taskStore.tasks.find(t => t.id === calendarEvent.taskId)
        if (!task) return

        contextMenuX.value = mouseEvent.clientX
        contextMenuY.value = mouseEvent.clientY
        contextMenuTask.value = task
        showContextMenu.value = true
    }

    /**
     * Handle context menu trigger from inbox/sidebar
     */
    const handleInboxContextMenu = (customEvent: CustomEvent<{ event: MouseEvent; task: Task; isCalendarEvent: boolean }>) => {
        const { event: mouseEvent, task } = customEvent.detail

        contextMenuX.value = mouseEvent.clientX
        contextMenuY.value = mouseEvent.clientY
        contextMenuTask.value = task
        showContextMenu.value = true
    }

    /**
     * Unschedule a task (remove from calendar)
     */
    const handleRemoveFromCalendar = (calendarEvent: CalendarEvent) => {
        taskStore.unscheduleTask(calendarEvent.taskId)
    }

    /**
     * Handle single click on calendar event (Selection)
     */
    const handleEventClick = (mouseEvent: MouseEvent, calendarEvent: CalendarEvent) => {
        const eventElement = mouseEvent.currentTarget as HTMLElement
        const isCtrlOrCmd = mouseEvent.ctrlKey || mouseEvent.metaKey

        // Don't handle clicks if dragging
        if (isDragging.value) return

        if (isCtrlOrCmd) {
            // Toggle selection
            const index = selectedCalendarEvents.value.findIndex(e => e.id === calendarEvent.id)
            if (index > -1) {
                selectedCalendarEvents.value.splice(index, 1)
                eventElement.classList.remove('selected')
            } else {
                selectedCalendarEvents.value.push(calendarEvent)
                eventElement.classList.add('selected')
            }
        } else {
            // Reset or toggle single selection
            if (selectedCalendarEvents.value.length === 1 && selectedCalendarEvents.value[0].id === calendarEvent.id) {
                selectedCalendarEvents.value = []
                eventElement.classList.remove('selected')
            } else {
                // Clear all previous selections
                document.querySelectorAll('.calendar-event.selected, .week-event.selected').forEach(el => {
                    el.classList.remove('selected')
                })
                selectedCalendarEvents.value = [calendarEvent]
                eventElement.classList.add('selected')
            }
        }
    }

    /**
     * Handle keyboard delete for selected events
     */
    const handleKeyDown = (event: KeyboardEvent) => {
        const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'
        if (!isDeleteKey) return
        if (selectedCalendarEvents.value.length === 0) return

        event.preventDefault()
        event.stopPropagation()

        selectedCalendarEvents.value.forEach(calendarEvent => {
            taskStore.unscheduleTaskWithUndo(calendarEvent.taskId)
        })

        // Clear selection state and DOM classes
        selectedCalendarEvents.value = []
        document.querySelectorAll('.calendar-event.selected, .week-event.selected').forEach(el => {
            el.classList.remove('selected')
        })
    }

    /**
     * Switch to day view when clicking a day in month view
     */
    const handleMonthDayClick = (dateString: string) => {
        monthDayClickHandler(dateString, viewMode)
    }

    return {
        showContextMenu,
        contextMenuX,
        contextMenuY,
        contextMenuTask,
        selectedCalendarEvents,
        hoveredEventId,
        handleSlotTaskMouseEnter,
        handleSlotTaskMouseLeave,
        closeContextMenu,
        handleEventDblClick,
        handleEventContextMenu,
        handleInboxContextMenu,
        handleRemoveFromCalendar,
        handleEventClick,
        handleKeyDown,
        handleMonthDayClick
    }
}
