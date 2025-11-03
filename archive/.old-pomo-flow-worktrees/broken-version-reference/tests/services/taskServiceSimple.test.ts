/**
 * Unit Tests for Simple Task Service
 * Tests direct store access pattern and business logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskServiceSimple } from '@/services/taskServiceSimple'
import { useTaskStore } from '@/stores/tasks'

// Mock the stores for isolated testing
vi.mock('@/stores/tasks', () => ({
  useTaskStore: vi.fn(),
  getTaskInstances: vi.fn()
}))

describe('useTaskServiceSimple', () => {
  let mockTaskStore: any
  let taskService: ReturnType<typeof useTaskServiceSimple>

  beforeEach(() => {
    setActivePinia(createPinia())

    // Create mock task store
    mockTaskStore = {
      createTaskWithUndo: vi.fn(),
      updateTaskWithUndo: vi.fn(),
      deleteTaskWithUndo: vi.fn(),
      createTaskInstanceWithUndo: vi.fn(),
      updateTaskInstanceWithUndo: vi.fn(),
      deleteTaskInstanceWithUndo: vi.fn(),
      createSubtaskWithUndo: vi.fn(),
      updateSubtaskWithUndo: vi.fn(),
      deleteSubtaskWithUndo: vi.fn(),
      moveTaskToProjectWithUndo: vi.fn(),
      getTaskById: vi.fn(),
      getDefaultProjectId: vi.fn().mockReturnValue('1')
    }

    // Mock useTaskStore to return our mock
    const { useTaskStore } = require('@/stores/tasks')
    useTaskStore.mockReturnValue(mockTaskStore)

    taskService = useTaskServiceSimple()
  })

  describe('createTask', () => {
    it('should create a task with valid data', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        status: 'planned' as const,
        priority: 'high' as const,
        projectId: 'project-1'
      }

      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test Description',
        status: 'planned',
        priority: 'high',
        projectId: 'project-1',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        estimatedDuration: undefined,
        parentTaskId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isInInbox: true,
        dependsOn: [],
        connectionTypes: {}
      }

      mockTaskStore.createTaskWithUndo.mockResolvedValue(mockTask)

      const result = await taskService.createTask(taskData)

      expect(mockTaskStore.createTaskWithUndo).toHaveBeenCalledWith({
        title: 'Test Task',
        description: 'Test Description',
        status: 'planned',
        priority: 'high',
        progress: 0,
        estimatedDuration: undefined,
        projectId: 'project-1',
        parentTaskId: null,
        dueDate: '',
        canvasPosition: undefined
      })

      expect(result).toEqual(mockTask)
    })

    it('should throw error for empty title', async () => {
      const taskData = {
        title: '',
        description: 'Test Description'
      }

      await expect(taskService.createTask(taskData)).rejects.toThrow('Task title is required')
      expect(mockTaskStore.createTaskWithUndo).not.toHaveBeenCalled()
    })

    it('should use default project when not provided', async () => {
      const taskData = {
        title: 'Test Task'
      }

      const mockTask = {
        id: 'task-1',
        title: 'Test Task',
        projectId: '1'
      }

      mockTaskStore.createTaskWithUndo.mockResolvedValue(mockTask)

      await taskService.createTask(taskData)

      expect(mockTaskStore.createTaskWithUndo).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: '1'
        })
      )
    })

    it('should handle store errors gracefully', async () => {
      const taskData = {
        title: 'Test Task'
      }

      const error = new Error('Store error')
      mockTaskStore.createTaskWithUndo.mockRejectedValue(error)

      await expect(taskService.createTask(taskData)).rejects.toThrow('Store error')
    })
  })

  describe('updateTask', () => {
    it('should update a task with valid data', async () => {
      const updateData = {
        id: 'task-1',
        title: 'Updated Task',
        status: 'in_progress' as const,
        progress: 50
      }

      const mockTask = {
        id: 'task-1',
        title: 'Updated Task',
        status: 'in_progress',
        progress: 50
      }

      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      const result = await taskService.updateTask(updateData)

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-1', {
        title: 'Updated Task',
        status: 'in_progress',
        progress: 50
      })

      expect(result).toEqual(mockTask)
    })

    it('should throw error for missing task ID', async () => {
      const updateData = {
        title: 'Updated Task'
      }

      await expect(taskService.updateTask(updateData as any)).rejects.toThrow('Task ID is required for updates')
      expect(mockTaskStore.updateTaskWithUndo).not.toHaveBeenCalled()
    })

    it('should clamp progress between 0 and 100', async () => {
      const updateData = {
        id: 'task-1',
        progress: 150
      }

      const mockTask = { id: 'task-1', progress: 100 }
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      await taskService.updateTask(updateData)

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-1', {
        progress: 100
      })
    })

    it('should trim whitespace from title and description', async () => {
      const updateData = {
        id: 'task-1',
        title: '  Updated Task  ',
        description: '  Updated Description  '
      }

      const mockTask = { id: 'task-1' }
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      await taskService.updateTask(updateData)

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith('task-1', {
        title: 'Updated Task',
        description: 'Updated Description'
      })
    })
  })

  describe('deleteTask', () => {
    it('should delete a task with valid ID', async () => {
      const taskId = 'task-1'
      const mockTask = { id: taskId, title: 'Test Task' }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.deleteTaskWithUndo.mockResolvedValue()

      await taskService.deleteTask(taskId)

      expect(mockTaskStore.getTaskById).toHaveBeenCalledWith('task-1')
      expect(mockTaskStore.deleteTaskWithUndo).toHaveBeenCalledWith('task-1')
    })

    it('should throw error for non-existent task', async () => {
      const taskId = 'non-existent'

      mockTaskStore.getTaskById.mockReturnValue(undefined)

      await expect(taskService.deleteTask(taskId)).rejects.toThrow('Task with ID non-existent not found')
      expect(mockTaskStore.deleteTaskWithUndo).not.toHaveBeenCalled()
    })

    it('should throw error for missing task ID', async () => {
      await expect(taskService.deleteTask('')).rejects.toThrow('Task ID is required for deletion')
      expect(mockTaskStore.deleteTaskWithUndo).not.toHaveBeenCalled()
    })
  })

  describe('toggleTaskStatus', () => {
    it('should toggle from planned to in_progress', async () => {
      const taskId = 'task-1'
      const mockTask = { id: taskId, title: 'Test Task', status: 'planned' as const }
      const updatedTask = { id: taskId, title: 'Test Task', status: 'in_progress' as const }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(updatedTask)

      const result = await taskService.toggleTaskStatus(taskId)

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith(taskId, {
        status: 'in_progress'
      })
      expect(result).toEqual(updatedTask)
    })

    it('should toggle from in_progress to done', async () => {
      const taskId = 'task-1'
      const mockTask = { id: taskId, title: 'Test Task', status: 'in_progress' as const }
      const updatedTask = { id: taskId, title: 'Test Task', status: 'done' as const }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(updatedTask)

      const result = await taskService.toggleTaskStatus(taskId)

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith(taskId, {
        status: 'done'
      })
      expect(result).toEqual(updatedTask)
    })

    it('should toggle from done to planned', async () => {
      const taskId = 'task-1'
      const mockTask = { id: taskId, title: 'Test Task', status: 'done' as const }
      const updatedTask = { id: taskId, title: 'Test Task', status: 'planned' as const }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(updatedTask)

      const result = await taskService.toggleTaskStatus(taskId)

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith(taskId, {
        status: 'planned'
      })
      expect(result).toEqual(updatedTask)
    })

    it('should default to planned for unknown status', async () => {
      const taskId = 'task-1'
      const mockTask = { id: taskId, title: 'Test Task', status: 'unknown' as any }
      const updatedTask = { id: taskId, title: 'Test Task', status: 'planned' as const }

      mockTaskStore.getTaskById.mockReturnValue(mockTask)
      mockTaskStore.updateTaskWithUndo.mockResolvedValue(updatedTask)

      const result = await taskService.toggleTaskStatus(taskId)

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith(taskId, {
        status: 'planned'
      })
      expect(result).toEqual(updatedTask)
    })
  })

  describe('convenience methods', () => {
    it('should complete a task', async () => {
      const taskId = 'task-1'
      const mockTask = { id: taskId, status: 'done' as const }

      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      const result = await taskService.completeTask(taskId)

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith(taskId, {
        status: 'done'
      })
      expect(result).toEqual(mockTask)
    })

    it('should start a task', async () => {
      const taskId = 'task-1'
      const mockTask = { id: taskId, status: 'in_progress' as const }

      mockTaskStore.updateTaskWithUndo.mockResolvedValue(mockTask)

      const result = await taskService.startTask(taskId)

      expect(mockTaskStore.updateTaskWithUndo).toHaveBeenCalledWith(taskId, {
        status: 'in_progress'
      })
      expect(result).toEqual(mockTask)
    })
  })

  describe('task instances', () => {
    it('should create a task instance', async () => {
      const instanceData = {
        taskId: 'task-1',
        scheduledDate: '2024-01-01',
        scheduledTime: '10:00',
        duration: 60
      }

      const mockInstance = {
        id: 'instance-1',
        taskId: 'task-1',
        scheduledDate: '2024-01-01',
        scheduledTime: '10:00',
        duration: 60
      }

      mockTaskStore.createTaskInstanceWithUndo.mockResolvedValue(mockInstance)

      const result = await taskService.createTaskInstance(instanceData)

      expect(mockTaskStore.createTaskInstanceWithUndo).toHaveBeenCalledWith(instanceData)
      expect(result).toEqual(mockInstance)
    })

    it('should update a task instance', async () => {
      const taskId = 'task-1'
      const instanceId = 'instance-1'
      const updates = { duration: 90 }

      const mockInstance = {
        id: instanceId,
        taskId: taskId,
        duration: 90
      }

      mockTaskStore.updateTaskInstanceWithUndo.mockResolvedValue(mockInstance)

      const result = await taskService.updateTaskInstance(taskId, instanceId, updates)

      expect(mockTaskStore.updateTaskInstanceWithUndo).toHaveBeenCalledWith(taskId, instanceId, updates)
      expect(result).toEqual(mockInstance)
    })

    it('should delete a task instance', async () => {
      const taskId = 'task-1'
      const instanceId = 'instance-1'

      mockTaskStore.deleteTaskInstanceWithUndo.mockResolvedValue()

      await taskService.deleteTaskInstance(taskId, instanceId)

      expect(mockTaskStore.deleteTaskInstanceWithUndo).toHaveBeenCalledWith(taskId, instanceId)
    })
  })

  describe('subtasks', () => {
    it('should create a subtask', async () => {
      const subtaskData = {
        parentTaskId: 'task-1',
        title: 'Subtask 1',
        description: 'Subtask description'
      }

      const mockSubtask = {
        id: 'subtask-1',
        parentTaskId: 'task-1',
        title: 'Subtask 1',
        description: 'Subtask description',
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockTaskStore.createSubtaskWithUndo.mockResolvedValue(mockSubtask)

      const result = await taskService.createSubtask(subtaskData)

      expect(mockTaskStore.createSubtaskWithUndo).toHaveBeenCalledWith(subtaskData)
      expect(result).toEqual(mockSubtask)
    })

    it('should update a subtask', async () => {
      const parentTaskId = 'task-1'
      const subtaskId = 'subtask-1'
      const updates = { isCompleted: true }

      const mockSubtask = {
        id: subtaskId,
        parentTaskId: parentTaskId,
        isCompleted: true
      }

      mockTaskStore.updateSubtaskWithUndo.mockResolvedValue(mockSubtask)

      const result = await taskService.updateSubtask(parentTaskId, subtaskId, updates)

      expect(mockTaskStore.updateSubtaskWithUndo).toHaveBeenCalledWith(parentTaskId, subtaskId, updates)
      expect(result).toEqual(mockSubtask)
    })

    it('should delete a subtask', async () => {
      const parentTaskId = 'task-1'
      const subtaskId = 'subtask-1'

      mockTaskStore.deleteSubtaskWithUndo.mockResolvedValue()

      await taskService.deleteSubtask(parentTaskId, subtaskId)

      expect(mockTaskStore.deleteSubtaskWithUndo).toHaveBeenCalledWith(parentTaskId, subtaskId)
    })
  })

  describe('moveTaskToProject', () => {
    it('should move task to different project', async () => {
      const taskId = 'task-1'
      const projectId = 'project-2'

      mockTaskStore.moveTaskToProjectWithUndo.mockResolvedValue()

      await taskService.moveTaskToProject(taskId, projectId)

      expect(mockTaskStore.moveTaskToProjectWithUndo).toHaveBeenCalledWith(taskId, projectId)
    })
  })

  describe('store access', () => {
    it('should provide direct access to the task store', () => {
      expect(taskService.store).toBe(mockTaskStore)
    })
  })
})

describe('Type guards', () => {
  describe('isValidTaskData', () => {
    it('should return true for valid task data', () => {
      const validData = {
        title: 'Test Task',
        description: 'Test Description'
      }

      const { isValidTaskData } = require('@/services/taskServiceSimple')
      expect(isValidTaskData(validData)).toBe(true)
    })

    it('should return false for invalid task data', () => {
      const invalidData = {
        title: '',
        description: 'Test Description'
      }

      const { isValidTaskData } = require('@/services/taskServiceSimple')
      expect(isValidTaskData(invalidData)).toBe(false)
    })

    it('should return false for non-object', () => {
      const { isValidTaskData } = require('@/services/taskServiceSimple')
      expect(isValidTaskData(null)).toBe(false)
      expect(isValidTaskData(undefined)).toBe(false)
      expect(isValidTaskData('string')).toBe(false)
    })
  })

  describe('isValidUpdateTaskData', () => {
    it('should return true for valid update data', () => {
      const validData = {
        id: 'task-1',
        title: 'Updated Task'
      }

      const { isValidUpdateTaskData } = require('@/services/taskServiceSimple')
      expect(isValidUpdateTaskData(validData)).toBe(true)
    })

    it('should return false for invalid update data', () => {
      const invalidData = {
        title: 'Updated Task'
      }

      const { isValidUpdateTaskData } = require('@/services/taskServiceSimple')
      expect(isValidUpdateTaskData(invalidData)).toBe(false)
    })

    it('should return false for empty ID', () => {
      const invalidData = {
        id: '',
        title: 'Updated Task'
      }

      const { isValidUpdateTaskData } = require('@/services/taskServiceSimple')
      expect(isValidUpdateTaskData(invalidData)).toBe(false)
    })
  })
})