import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCalendarInteractionHandlers } from '@/composables/calendar/useCalendarInteractionHandlers'

const mockGetTask = vi.fn()

vi.mock('@/stores/tasks', () => ({
    useTaskStore: () => ({
        getTask: mockGetTask,
        unscheduleTask: vi.fn(),
        tasks: [],
    }),
}))

describe('useCalendarInteractionHandlers context menu dispatch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('dispatches task-context-menu with canonical task data from getTask', () => {
        const isDragging = ref(false)
        const viewMode = ref<'day' | 'week' | 'month'>('day')
        let received: CustomEvent<{ task: Record<string, unknown> }> | undefined

        window.addEventListener('task-context-menu', event => {
            received = event as CustomEvent<{ task: Record<string, unknown> }>
        }, { once: true })

        mockGetTask.mockReturnValue({
            id: 'task-1',
            title: 'Canonical Title',
            status: 'todo',
            recurrenceRule: { pattern: 'weekly', interval: 1 }
        })

        const handlers = useCalendarInteractionHandlers(
            isDragging,
            viewMode,
            vi.fn(),
            vi.fn(),
            vi.fn(),
            vi.fn()
        )

        const event = new MouseEvent('contextmenu', { bubbles: true, clientX: 15, clientY: 22 })
        const preventDefault = vi.spyOn(event, 'preventDefault')
        const stopPropagation = vi.spyOn(event, 'stopPropagation')

        handlers.handleEventContextMenu(event, {
            id: 'instance-1',
            taskId: 'task-1',
            instanceId: 'instance-1',
            title: 'Calendar Row',
            startTime: new Date(),
            endTime: new Date(),
            duration: 30,
            startSlot: 0,
            slotSpan: 1,
            color: 'blue',
            column: 0,
            totalColumns: 1,
            isDueDate: false,
        })

        expect(mockGetTask).toHaveBeenCalledWith('task-1')
        expect(preventDefault).toHaveBeenCalledOnce()
        expect(stopPropagation).toHaveBeenCalledOnce()
        expect(received?.detail.task).toMatchObject({
            id: 'task-1',
            title: 'Canonical Title',
            recurrenceRule: { pattern: 'weekly', interval: 1 }
        })
        expect(received?.detail.instanceId).toBe('instance-1')
        expect(received?.detail.isCalendarEvent).toBe(true)
        expect(received?.detail.calendarDuration).toBe(30)
    })

    it('does not dispatch when the canonical task lookup fails', () => {
        const isDragging = ref(false)
        const viewMode = ref<'day' | 'week' | 'month'>('week')
        const handleEditTask = vi.fn()
        let dispatchCount = 0

        window.addEventListener('task-context-menu', () => {
            dispatchCount += 1
        }, { once: true })

        mockGetTask.mockReturnValue(undefined)

        const handlers = useCalendarInteractionHandlers(
            isDragging,
            viewMode,
            handleEditTask,
            vi.fn(),
            vi.fn(),
            vi.fn()
        )

        const event = new MouseEvent('contextmenu', { bubbles: true })
        handlers.handleEventContextMenu(event, {
            id: 'instance-2',
            taskId: 'missing-task',
            instanceId: 'instance-2',
            title: 'Missing',
            startTime: new Date(),
            endTime: new Date(),
            duration: 30,
            startSlot: 0,
            slotSpan: 1,
            color: 'red',
            column: 0,
            totalColumns: 1,
            isDueDate: false,
        })

        expect(dispatchCount).toBe(0)
        expect(handleEditTask).not.toHaveBeenCalled()
    })
})
