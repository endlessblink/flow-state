
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMidnightTaskMover } from '../useMidnightTaskMover'

describe('useMidnightTaskMover (TASK-082)', () => {
    let mockCanvasStore: any
    let mockTaskStore: any
    let mover: ReturnType<typeof useMidnightTaskMover>

    beforeEach(() => {
        // Mock Stores
        mockCanvasStore = {
            groups: []
        }

        mockTaskStore = {
            tasks: [],
            updateTask: vi.fn()
        }

        mover = useMidnightTaskMover(mockCanvasStore, mockTaskStore)
    })

    it('returns "no-today-group" if Today group is missing', async () => {
        mockCanvasStore.groups = [] // No groups

        const result = await mover.moveTodayTasksToOverdue()

        expect(result.reason).toBe('no-today-group')
        expect(mockTaskStore.updateTask).not.toHaveBeenCalled()
    })

    it('returns "no-overdue-group" if Overdue group is missing', async () => {
        mockCanvasStore.groups = [
            { id: '1', name: 'Today', type: 'sectionNode', position: { x: 0, y: 0, width: 100, height: 100 } }
        ]

        const result = await mover.moveTodayTasksToOverdue()

        expect(result.reason).toBe('no-overdue-group')
        expect(mockTaskStore.updateTask).not.toHaveBeenCalled()
    })

    it('returns "no-tasks" if no tasks are physically inside Today group', async () => {
        mockCanvasStore.groups = [
            { id: '1', name: 'Today', type: 'sectionNode', position: { x: 0, y: 0, width: 200, height: 200 } },
            { id: '2', name: 'Overdue', type: 'sectionNode', position: { x: 300, y: 0, width: 200, height: 200 } }
        ]

        // Task is way outside at 500, 500
        mockTaskStore.tasks = [
            { id: 't1', title: 'Task Outside', canvasPosition: { x: 500, y: 500 }, isInInbox: false }
        ]

        const result = await mover.moveTodayTasksToOverdue()

        expect(result.reason).toBe('no-tasks')
        expect(mockTaskStore.updateTask).not.toHaveBeenCalled()
    })

    it('successfully moves tasks inside Today group to Overdue group', async () => {
        // Setup Today at 0,0 (200x200) and Overdue at 500,0
        const todayPos = { x: 0, y: 0, width: 200, height: 200 }
        const overduePos = { x: 500, y: 0, width: 300, height: 400 }

        mockCanvasStore.groups = [
            { id: '1', name: 'Today', type: 'sectionNode', position: todayPos },
            { id: '2', name: 'Overdue', type: 'sectionNode', position: overduePos }
        ]

        // Task inside Today at 50, 50
        mockTaskStore.tasks = [
            { id: 't1', title: 'Task Inside', canvasPosition: { x: 50, y: 50 }, isInInbox: false },
            { id: 't2', title: 'Task Outside', canvasPosition: { x: 900, y: 900 }, isInInbox: false }
        ]

        const result = await mover.moveTodayTasksToOverdue()

        expect(result.reason).toBe('success')
        expect(result.movedCount).toBe(1)
        expect(mockTaskStore.updateTask).toHaveBeenCalledTimes(1)

        // Check formatting of update call
        // New X should be Overdue X (500) + Padding (20) + Col * Width ...
        // Since it's the first task, it should be at the start position
        const expectedX = 500 + 20
        const expectedY = 0 + 60 + 20 // y + headerHeight + padding

        expect(mockTaskStore.updateTask).toHaveBeenCalledWith('t1', {
            canvasPosition: { x: expectedX, y: expectedY }
        })
    })

    it('ignores tasks in inbox even if coordinates match', async () => {
        mockCanvasStore.groups = [
            { id: '1', name: 'Today', type: 'sectionNode', position: { x: 0, y: 0, width: 200, height: 200 } },
            { id: '2', name: 'Overdue', type: 'sectionNode', position: { x: 300, y: 0, width: 200, height: 200 } }
        ]

        // Task appears to be at 50,50 BUT isInInbox is true
        mockTaskStore.tasks = [
            { id: 't1', title: 'Inbox Task', canvasPosition: { x: 50, y: 50 }, isInInbox: true }
        ]

        const result = await mover.moveTodayTasksToOverdue()

        expect(result.reason).toBe('no-tasks')
        expect(mockTaskStore.updateTask).not.toHaveBeenCalled()
    })
})
