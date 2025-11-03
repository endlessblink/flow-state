/**
 * Unit Tests for Simple Canvas Service
 * Tests direct store access pattern and business logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasServiceSimple } from '@/services/canvasServiceSimple'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

// Mock the stores for isolated testing
vi.mock('@/stores/tasks', () => ({
  useTaskStore: vi.fn()
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: vi.fn()
}))

describe('useCanvasServiceSimple', () => {
  let mockTaskStore: any
  let mockCanvasStore: any
  let canvasService: ReturnType<typeof useCanvasServiceSimple>

  beforeEach(() => {
    setActivePinia(createPinia())

    // Create mock task store
    mockTaskStore = {
      tasks: [
        {
          id: 'task-1',
          title: 'Inbox Task',
          isInInbox: true,
          canvasPosition: undefined
        },
        {
          id: 'task-2',
          title: 'Canvas Task',
          isInInbox: false,
          canvasPosition: { x: 100, y: 100 }
        },
        {
          id: 'task-3',
          title: 'Positioned Task',
          isInInbox: false,
          canvasPosition: { x: 200, y: 150 }
        }
      ],
      updateTaskWithUndo: vi.fn(),
      getTaskById: vi.fn(),
      getProjectById: vi.fn()
    }

    // Create mock canvas store
    mockCanvasStore = {
      sections: [
        {
          id: 'section-1',
          type: 'priority',
          value: 'high',
          position: { x: 50, y: 50 },
          isVisible: true,
          isCollapsed: false
        },
        {
          id: 'section-2',
          type: 'status',
          value: 'done',
          position: { x: 300, y: 50 },
          isVisible: true,
          isCollapsed: false
        }
      ],
      createSectionWithUndo: vi.fn(),
      updateSectionWithUndo: vi.fn(),
      deleteSectionWithUndo: vi.fn(),
      toggleSectionVisibilityWithUndo: vi.fn(),
      toggleSectionCollapseWithUndo: vi.fn(),
      setActiveSection: vi.fn(),
      getTasksInSection: vi.fn(),
      isTaskInSection: vi.fn(),
      findNearestSection: vi.fn(),
      getMagneticSnapPosition: vi.fn(),
      calculateContentBounds: vi.fn(),
      calculateDynamicMinZoom: vi.fn()
    }

    // Mock stores
    const { useTaskStore } = require('@/stores/tasks')
    const { useCanvasStore } = require('@/stores/canvas')
    useTaskStore.mockReturnValue(mockTaskStore)
    useCanvasStore.mockReturnValue(mockCanvasStore)

    canvasService = useCanvasServiceSimple()
  })

  describe('positionTaskOnCanvas', () => {
    it('should position task on canvas and remove from inbox', async () => {
      const taskId = 'task-1'
      const position = { x: 150, y: 200 }
      const mockTask = { id: taskId, title: 'Test Task', isInInbox: true }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      await canvasService.positionTaskOnCanvas(taskId, position)

      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-1')
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-1', {
        canvasPosition: position,
        isInInbox: false
      })
    })

    it('should throw error for non-existent task', async () => {
      const taskId = 'non-existent'
      const position = { x: 150, y: 200 }

      mockTaskStore.getTaskById.mockReturnValue(undefined)

      await expect(canvasService.positionTaskOnCanvas(taskId, position))
        .rejects.toThrow('Task with ID non-existent not found')
      expect(mockTaskStore.updateTaskWithUndo).not.toHaveBeenCalled()
    })
  })

  describe('moveTaskOnCanvas', () => {
    it('should move task to new position', async () => {
      const taskId = 'task-2'
      const newPosition = { x: 250, y: 300 }
      const mockTask = { id: taskId, title: 'Test Task' }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      await canvasService.moveTaskOnCanvas(taskId, newPosition)

      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-2')
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-2', {
        canvasPosition: newPosition
      })
    })

    it('should throw error for non-existent task', async () => {
      const taskId = 'non-existent'
      const newPosition = { x: 250, y: 300 }

      mockTaskStore.getTaskById.mockReturnValue(undefined)

      await expect(canvasService.moveTaskOnCanvas(taskId, newPosition))
        .rejects.toThrow('Task with ID non-existent not found')
      expect(mockTaskStore.updateTaskWithUndo).not.toHaveBeenCalled()
    })
  })

  describe('moveTaskToInbox', () => {
    it('should move task back to inbox', async () => {
      const taskId = 'task-2'
      const mockTask = { id: taskId, title: 'Test Task', canvasPosition: { x: 100, y: 100 } }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      await canvasService.moveTaskToInbox(taskId)

      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-2')
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-2', {
        canvasPosition: undefined,
        isInInbox: true
      })
    })
  })

  describe('positionMultipleTasks', () => {
    it('should position multiple tasks', async () => {
      const updates = [
        { taskId: 'task-1', position: { x: 100, y: 100 } },
        { taskId: 'task-2', position: { x: 200, y: 200 } }
      ]

      const mockTasks = [
        { id: 'task-1', title: 'Task 1', isInInbox: true },
        { id: 'task-2', title: 'Task 2', isInInbox: true }
      ]

      mockTaskStore.getTaskById
        .mockReturnValueOnce(mockTasks[0])
        .mockReturnValueOnce(mockTasks[1])
      mockTaskStore.updateTaskWithUndo.mockResolvedValue({})

      await canvasService.positionMultipleTasks(updates)

      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-1')
      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-2')
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledTimes(2)
    })
  })

  describe('createCanvasSection', () => {
    it('should create new canvas section', async () => {
      const sectionData = {
        type: 'priority' as const,
        value: 'high',
        position: { x: 50, y: 50 },
        title: 'High Priority'
      }

      mockCanvasStore.createSectionWithUndo.mockResolvedValue()

      await canvasService.createCanvasSection(sectionData)

      expect(mockCanvasStore.createSectionWithUndo).toHaveBeenCalledWith(sectionData)
    })
  })

  describe('updateCanvasSection', () => {
    it('should update existing canvas section', async () => {
      const updateData = {
        id: 'section-1',
        title: 'Updated Section'
      }

      mockCanvasStore.updateSectionWithUndo.mockResolvedValue()

      await canvasService.updateCanvasSection(updateData)

      expect(mockCanvasStore.updateSectionWithUndo).toHaveBeenCalledWith('section-1', {
        title: 'Updated Section'
      })
    })
  })

  describe('deleteCanvasSection', () => {
    it('should delete canvas section', async () => {
      const sectionId = 'section-1'

      mockCanvasStore.deleteSectionWithUndo.mockResolvedValue()

      await canvasService.deleteCanvasSection(sectionId)

      expect(mockCanvasStore.deleteSectionWithUndo).toHaveBeenCalledWith('section-1')
    })
  })

  describe('toggleSectionVisibility', () => {
    it('should toggle section visibility', async () => {
      const sectionId = 'section-1'

      mockCanvasStore.toggleSectionVisibilityWithUndo.mockResolvedValue()

      await canvasService.toggleSectionVisibility(sectionId)

      expect(mockCanvasStore.toggleSectionVisibilityWithUndo).toHaveBeenCalledWith('section-1')
    })
  })

  describe('toggleSectionCollapse', () => {
    it('should toggle section collapse state', async () => {
      const sectionId = 'section-1'

      mockCanvasStore.toggleSectionCollapseWithUndo.mockResolvedValue()

      await canvasService.toggleSectionCollapse(sectionId)

      expect(mockCanvasStore.toggleSectionCollapseWithUndo).toHaveBeenCalledWith('section-1')
    })
  })

  describe('setActiveSection', () => {
    it('should set active section', () => {
      const sectionId = 'section-1'

      canvasService.setActiveSection(sectionId)

      expect(mockCanvasStore.setActiveSection).toHaveBeenCalledWith('section-1')
    })

    it('should set active section to null', () => {
      canvasService.setActiveSection(null)

      expect(mockCanvasStore.setActiveSection).toHaveBeenCalledWith(null)
    })
  })

  describe('getTasksInSection', () => {
    it('should return tasks in section', () => {
      const sectionId = 'section-1'
      const mockTasks = ['task-1', 'task-2']

      mockCanvasStore.getTasksInSection.mockReturnValue(mockTasks)

      const result = canvasService.getTasksInSection(sectionId)

      expect(mockCanvasStore.getTasksInSection).toHaveBeenCalledWith('section-1')
      expect(result).toBe(mockTasks)
    })
  })

  describe('isTaskInSection', () => {
    it('should check if task belongs to section', () => {
      const task = { id: 'task-1', title: 'Test Task' }
      const sectionId = 'section-1'

      mockCanvasStore.isTaskInSection.mockReturnValue(true)

      const result = canvasService.isTaskInSection(task, sectionId)

      expect(mockCanvasStore.isTaskInSection).toHaveBeenCalledWith(task, 'section-1')
      expect(result).toBe(true)
    })
  })

  describe('findNearestSection', () => {
    it('should find nearest section to position', () => {
      const position = { x: 150, y: 150 }
      const nearestSectionId = 'section-1'

      mockCanvasStore.findNearestSection.mockReturnValue(nearestSectionId)

      const result = canvasService.findNearestSection(position)

      expect(mockCanvasStore.findNearestSection).toHaveBeenCalledWith(position)
      expect(result).toBe(nearestSectionId)
    })

    it('should return null if no section found', () => {
      const position = { x: 150, y: 150 }

      mockCanvasStore.findNearestSection.mockReturnValue(null)

      const result = canvasService.findNearestSection(position)

      expect(mockCanvasStore.findNearestSection).toHaveBeenCalledWith(position)
      expect(result).toBeNull()
    })
  })

  describe('getMagneticSnapPosition', () => {
    it('should get magnetic snap position', () => {
      const position = { x: 150, y: 150 }
      const taskId = 'task-1'
      const snapPosition = { x: 160, y: 160 }

      mockCanvasStore.getMagneticSnapPosition.mockReturnValue(snapPosition)

      const result = canvasService.getMagneticSnapPosition(position, taskId)

      expect(mockCanvasStore.getMagneticSnapPosition).toHaveBeenCalledWith(position, taskId)
      expect(result).toEqual(snapPosition)
    })
  })

  describe('getCanvasBounds', () => {
    it('should get canvas content bounds', () => {
      const bounds = { x: 0, y: 0, width: 800, height: 600 }

      mockCanvasStore.calculateContentBounds.mockReturnValue(bounds)

      const result = canvasService.getCanvasBounds()

      expect(mockCanvasStore.calculateContentBounds).toHaveBeenCalled()
      expect(result).toEqual(bounds)
    })
  })

  describe('getMinZoom', () => {
    it('should get minimum zoom level', () => {
      const minZoom = 0.5

      mockCanvasStore.calculateDynamicMinZoom.mockReturnValue(minZoom)

      const result = canvasService.getMinZoom()

      expect(mockCanvasStore.calculateDynamicMinZoom).toHaveBeenCalled()
      expect(result).toBe(minZoom)
    })
  })

  describe('clearCanvas', () => {
    it('should clear canvas by moving all positioned tasks to inbox', async () => {
      const mockTasks = [
        { id: 'task-2', title: 'Canvas Task', isInInbox: false, canvasPosition: { x: 100, y: 100 } },
        { id: 'task-3', title: 'Positioned Task', isInInbox: false, canvasPosition: { x: 200, y: 150 } }
      ]

      mockTaskStore.tasks = mockTasks
      mockTaskStore.getTaskById
        .mockReturnValueOnce(mockTasks[0])
        .mockReturnValueOnce(mockTasks[1])
      mockTaskStore.updateTaskWithUndo.mockResolvedValue({})

      await canvasService.clearCanvas()

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledTimes(2)
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-2', {
        canvasPosition: undefined,
        isInInbox: true
      })
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-3', {
        canvasPosition: undefined,
        isInInbox: true
      })
    })
  })

  describe('autoOrganizeCanvas', () => {
    it('should auto-organize inbox tasks on canvas', async () => {
      const mockInboxTasks = [
        { id: 'task-1', title: 'Inbox Task 1', isInInbox: true },
        { id: 'task-2', title: 'Inbox Task 2', isInInbox: true },
        { id: 'task-3', title: 'Inbox Task 3', isInInbox: true }
      ]

      mockTaskStore.tasks = mockInboxTasks
      mockTaskStore.getTaskById
        .mockReturnValueOnce(mockInboxTasks[0])
        .mockReturnValueOnce(mockInboxTasks[1])
        .mockReturnValueOnce(mockInboxTasks[2])
      mockTaskStore.updateTaskWithUndo.mockResolvedValue({})

      await canvasService.autoOrganizeCanvas()

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledTimes(3)

      // Check grid positioning (5 columns, starting at 100,100)
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenNthCalledWith(1, 'task-1', {
        canvasPosition: { x: 100, y: 100 },
        isInInbox: false
      })
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenNthCalledWith(2, 'task-2', {
        canvasPosition: { x: 300, y: 100 },
        isInInbox: false
      })
      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenNthCalledWith(3, 'task-3', {
        canvasPosition: { x: 500, y: 100 },
        isInInbox: false
      })
    })
  })

  describe('convenience section creators', () => {
    it('should create priority section', async () => {
      const priority = 'high'
      const position = { x: 50, y: 50 }

      mockCanvasStore.createSectionWithUndo.mockResolvedValue()

      await canvasService.createPrioritySection(priority, position)

      expect(mockCanvasStore.createSectionWithUndo).toHaveBeenCalledWith({
        type: 'priority',
        value: 'high',
        position: { x: 50, y: 50 },
        title: 'High Priority'
      })
    })

    it('should create status section', async () => {
      const status = 'in_progress'
      const position = { x: 50, y: 50 }

      mockCanvasStore.createSectionWithUndo.mockResolvedValue()

      await canvasService.createStatusSection(status, position)

      expect(mockCanvasStore.createSectionWithUndo).toHaveBeenCalledWith({
        type: 'status',
        value: 'in_progress',
        position: { x: 50, y: 50 },
        title: 'In Progress'
      })
    })

    it('should create project section', async () => {
      const projectId = 'project-1'
      const position = { x: 50, y: 50 }
      const mockProject = { id: projectId, name: 'Work Project' }

      mockTaskStore.getProjectById.mockReturnValue(mockProject)
      mockCanvasStore.createSectionWithUndo.mockResolvedValue()

      await canvasService.createProjectSection(projectId, position)

      expect(mockTaskStore.getProjectById).toHaveBeenCalledWith('project-1')
      expect(mockCanvasStore.createSectionWithUndo).toHaveBeenCalledWith({
        type: 'project',
        value: 'project-1',
        position: { x: 50, y: 50 },
        title: 'Work Project'
      })
    })
  })

  describe('getCanvasStatistics', () => {
    it('should return canvas statistics', () => {
      const result = canvasService.getCanvasStatistics()

      expect(result).toEqual({
        totalTasks: 3,
        positionedTasks: 2,
        inboxTasks: 1,
        totalSections: 2,
        visibleSections: 2,
        collapsedSections: 0
      })
    })

    it('should count collapsed sections correctly', () => {
      mockCanvasStore.sections = [
        { ...mockCanvasStore.sections[0], isCollapsed: true },
        { ...mockCanvasStore.sections[1], isCollapsed: false }
      ]

      const result = canvasService.getCanvasStatistics()

      expect(result.collapsedSections).toBe(1)
    })
  })

  describe('store access', () => {
    it('should provide direct access to task store', () => {
      expect(canvasService.taskStore).toBe(mockTaskStore)
    })

    it('should provide direct access to canvas store', () => {
      expect(canvasService.canvasStore).toBe(mockCanvasStore)
    })
  })
})