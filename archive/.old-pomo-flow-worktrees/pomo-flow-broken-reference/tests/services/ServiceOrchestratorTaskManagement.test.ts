/**
 * SERVICE-ORCHESTRATOR TASK MANAGEMENT TESTS
 *
 * Tests for ServiceOrchestrator-based task management functionality.
 * Validates migration from direct store access to service layer.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useServiceOrchestrator } from '@/services/ServiceOrchestrator'
import { useTaskServiceEnhanced } from '@/services/TaskServiceEnhanced'
import { useTaskManagerService } from '@/composables/useTaskManagerService'
import { useQuickSortService } from '@/composables/useQuickSortService'
import { useUndoRedoService } from '@/composables/useUndoRedoService'
import { loadTestEnvironment, cleanupTestData, validateTestData } from '@/utils/testDataGeneratorService'
import type { Task } from '@/types/task'

describe('ServiceOrchestrator Task Management', () => {
  let serviceOrchestrator: any
  let taskManagerService: any
  let quickSortService: any
  let undoRedoService: any
  let enhancedTaskService: any

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)

    // Get ServiceOrchestrator instance
    serviceOrchestrator = useServiceOrchestrator()

    // Initialize services
    taskManagerService = useTaskManagerService()
    quickSortService = useQuickSortService()
    undoRedoService = useUndoRedoService()
    enhancedTaskService = useTaskServiceEnhanced(serviceOrchestrator)
  })

  afterEach(async () => {
    // Clean up test data
    await cleanupTestData(serviceOrchestrator)
  })

  describe('Task Creation', () => {
    it('should create a task through ServiceOrchestrator', async () => {
      const taskData = {
        title: 'Test Task Service Creation',
        description: 'Testing task creation through ServiceOrchestrator',
        priority: 'high' as const,
        projectId: 'test-project'
      }

      const result = await serviceOrchestrator.createTask(taskData)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.title).toBe(taskData.title)
      expect(result.data.priority).toBe(taskData.priority)
      expect(result.data.projectId).toBe(taskData.projectId)
    })

    it('should create a task through TaskManagerService', async () => {
      const taskData = {
        title: 'Test TaskManagerService Creation',
        description: 'Testing task creation through TaskManagerService',
        priority: 'medium' as const
      }

      const task = await taskManagerService.createTask(taskData)

      expect(task).toBeDefined()
      expect(task.title).toBe(taskData.title)
      expect(task.priority).toBe(taskData.priority)
    })

    it('should create a task through enhanced TaskService', async () => {
      const taskData = {
        title: 'Test Enhanced TaskService Creation',
        description: 'Testing task creation through enhanced TaskService',
        priority: 'low' as const
      }

      const result = await enhancedTaskService.createTask(taskData)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.title).toBe(taskData.title)
    })

    it('should validate task data before creation', async () => {
      const invalidTaskData = {
        title: '', // Empty title should fail validation
        description: 'This task has no title'
      }

      const result = await enhancedTaskService.createTask(invalidTaskData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('validation failed')
      expect(result.details?.errors).toContain('Task title is required')
    })
  })

  describe('Task Updates', () => {
    let testTask: Task

    beforeEach(async () => {
      // Create a test task for update operations
      const createResult = await serviceOrchestrator.createTask({
        title: 'Test Task for Updates',
        status: 'planned' as const
      })
      testTask = createResult.data!
    })

    it('should update a task through ServiceOrchestrator', async () => {
      const updates = {
        title: 'Updated Task Title',
        status: 'in_progress' as const,
        progress: 50
      }

      const result = await serviceOrchestrator.updateTask(testTask.id, updates)

      expect(result.success).toBe(true)
      expect(result.data.title).toBe(updates.title)
      expect(result.data.status).toBe(updates.status)
      expect(result.data.progress).toBe(updates.progress)
    })

    it('should update a task through TaskManagerService', async () => {
      const updates = {
        description: 'Updated description',
        priority: 'high' as const
      }

      const updatedTask = await taskManagerService.updateTask(testTask.id, updates)

      expect(updatedTask).toBeDefined()
      expect(updatedTask.description).toBe(updates.description)
      expect(updatedTask.priority).toBe(updates.priority)
    })

    it('should validate update data before updating', async () => {
      const invalidUpdates = {
        progress: 150, // Invalid progress value
        title: '' // Empty title
      }

      const result = await enhancedTaskService.updateTask(testTask.id, invalidUpdates)

      expect(result.success).toBe(false)
      expect(result.details?.errors).toContain('Progress must be between 0 and 100')
      expect(result.details?.errors).toContain('Task title cannot be empty')
    })
  })

  describe('Task Deletion', () => {
    let testTask: Task

    beforeEach(async () => {
      const createResult = await serviceOrchestrator.createTask({
        title: 'Test Task for Deletion'
      })
      testTask = createResult.data!
    })

    it('should delete a task through ServiceOrchestrator', async () => {
      const result = await serviceOrchestrator.deleteTask(testTask.id)

      expect(result.success).toBe(true)

      // Verify task is deleted
      const deletedTask = serviceOrchestrator.getTaskById(testTask.id)
      expect(deletedTask).toBeNull()
    })

    it('should delete a task through TaskManagerService', async () => {
      const success = await taskManagerService.deleteTask(testTask.id)

      expect(success).toBe(true)

      // Verify task is deleted
      const deletedTask = taskManagerService.getTaskById(testTask.id)
      expect(deletedTask).toBeNull()
    })
  })

  describe('Bulk Operations', () => {
    it('should create multiple tasks efficiently', async () => {
      const tasksData = [
        { title: 'Bulk Task 1', priority: 'high' as const },
        { title: 'Bulk Task 2', priority: 'medium' as const },
        { title: 'Bulk Task 3', priority: 'low' as const }
      ]

      const result = await serviceOrchestrator.createMultipleTasks(tasksData)

      expect(result.success).toBe(true)
      expect(result.summary.successful).toBe(3)
      expect(result.summary.failed).toBe(0)
      expect(result.results).toHaveLength(3)
    })

    it('should delete multiple tasks efficiently', async () => {
      // First create some tasks
      const createResult = await serviceOrchestrator.createMultipleTasks([
        { title: 'Delete Task 1' },
        { title: 'Delete Task 2' },
        { title: 'Delete Task 3' }
      ])

      const taskIds = createResult.results.map((task: Task) => task.id)

      // Then delete them
      const deleteResult = await serviceOrchestrator.deleteMultipleTasks(taskIds)

      expect(deleteResult.success).toBe(true)
      expect(deleteResult.summary.successful).toBe(3)
      expect(deleteResult.summary.failed).toBe(0)

      // Verify all tasks are deleted
      const remainingTasks = taskIds.map(id => serviceOrchestrator.getTaskById(id))
      expect(remainingTasks.every(task => task === null)).toBe(true)
    })
  })

  describe('QuickSort Integration', () => {
    beforeEach(async () => {
      // Load test environment with uncategorized tasks
      await loadTestEnvironment(serviceOrchestrator, {
        projectCount: 2,
        taskCount: 10,
        includeProjects: true,
        includeTasks: true
      })
    })

    it('should get uncategorized tasks through QuickSortService', () => {
      const uncategorizedTasks = quickSortService.uncategorizedTasks

      expect(uncategorizedTasks).toBeDefined()
      expect(Array.isArray(uncategorizedTasks.value)).toBe(true)
    })

    it('should categorize tasks through QuickSortService', async () => {
      const uncategorizedTasks = quickSortService.uncategorizedTasks.value

      if (uncategorizedTasks.length > 0) {
        const firstTask = uncategorizedTasks[0]
        const newProjectId = 'test-categorization-project'

        await quickSortService.categorizeTask(firstTask.id, newProjectId)

        // Verify the task was categorized
        const updatedTask = serviceOrchestrator.getTaskById(firstTask.id)
        expect(updatedTask?.projectId).toBe(newProjectId)
      }
    })

    it('should mark tasks as done through QuickSortService', async () => {
      const uncategorizedTasks = quickSortService.uncategorizedTasks.value

      if (uncategorizedTasks.length > 0) {
        const firstTask = uncategorizedTasks[0]

        await quickSortService.markTaskDone(firstTask.id)

        // Verify the task was marked as done
        const updatedTask = serviceOrchestrator.getTaskById(firstTask.id)
        expect(updatedTask?.status).toBe('done')
      }
    })
  })

  describe('Undo/Redo Integration', () => {
    it('should support undo operations', async () => {
      // Create a task
      const createResult = await serviceOrchestrator.createTask({
        title: 'Undo Test Task'
      })

      expect(createResult.success).toBe(true)

      // Update the task
      const updateResult = await serviceOrchestrator.updateTask(createResult.data!.id, {
        title: 'Updated Undo Test Task'
      })

      expect(updateResult.success).toBe(true)

      // Undo the update
      const undoSuccess = await undoRedoService.undo()
      expect(undoSuccess).toBe(true)

      // Verify the task title was reverted
      const revertedTask = serviceOrchestrator.getTaskById(createResult.data!.id)
      expect(revertedTask?.title).toBe('Undo Test Task')
    })

    it('should support redo operations', async () => {
      // Create and update a task
      const createResult = await serviceOrchestrator.createTask({
        title: 'Redo Test Task'
      })

      const originalTitle = 'Redo Test Task'
      const updatedTitle = 'Updated Redo Test Task'

      await serviceOrchestrator.updateTask(createResult.data!.id, {
        title: updatedTitle
      })

      // Undo the update
      await undoRedoService.undo()

      // Redo the update
      const redoSuccess = await undoRedoService.redo()
      expect(redoSuccess).toBe(true)

      // Verify the task title was restored
      const restoredTask = serviceOrchestrator.getTaskById(createResult.data!.id)
      expect(restoredTask?.title).toBe(updatedTitle)
    })

    it('should track undo/redo state correctly', () => {
      const stats = undoRedoService.getUndoRedoStatistics()

      expect(stats).toHaveProperty('canUndo')
      expect(stats).toHaveProperty('canRedo')
      expect(stats).toHaveProperty('undoCount')
      expect(stats).toHaveProperty('redoCount')
      expect(stats).toHaveProperty('historyLength')
    })
  })

  describe('Filtering Operations', () => {
    beforeEach(async () => {
      // Load test data for filtering tests
      await loadTestEnvironment(serviceOrchestrator, {
        taskCount: 20,
        includeTasks: true,
        includeProjects: false
      })
    })

    it('should get filtered tasks through ServiceOrchestrator', () => {
      const todayTasks = serviceOrchestrator.getTodayTasks()
      const todayCount = serviceOrchestrator.getTodayTaskCount()

      expect(Array.isArray(todayTasks)).toBe(true)
      expect(typeof todayCount).toBe('number')
      expect(todayCount).toBe(todayTasks.length)
    })

    it('should filter tasks by project', () => {
      const allTasks = serviceOrchestrator.getAllTasks()

      if (allTasks.length > 0) {
        const firstProjectId = allTasks[0].projectId
        const projectTasks = serviceOrchestrator.getTasksForProject(firstProjectId)

        expect(Array.isArray(projectTasks)).toBe(true)
        expect(projectTasks.every(task => task.projectId === firstProjectId)).toBe(true)
      }
    })

    it('should validate filtering consistency', () => {
      const validation = serviceOrchestrator.validateFilteringConsistency()

      expect(validation).toHaveProperty('isConsistent')
      expect(validation).toHaveProperty('details')
      expect(typeof validation.isConsistent).toBe('boolean')
    })
  })

  describe('Task Search', () => {
    beforeEach(async () => {
      await loadTestEnvironment(serviceOrchestrator, {
        taskCount: 15,
        includeTasks: true,
        includeProjects: false
      })
    })

    it('should search tasks by title', async () => {
      const searchTerm = 'Test'
      const result = await enhancedTaskService.searchTasks(searchTerm, {
        searchIn: ['title']
      })

      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)

      // All returned tasks should contain the search term in their title
      result.data.forEach(task => {
        expect(task.title.toLowerCase()).toContain(searchTerm.toLowerCase())
      })
    })

    it('should search tasks with filters', async () => {
      const searchTerm = 'Performance'
      const result = await enhancedTaskService.searchTasks(searchTerm, {
        searchIn: ['title', 'description'],
        status: ['planned'],
        priority: ['high']
      })

      expect(result.success).toBe(true)

      // All returned tasks should match all criteria
      result.data.forEach(task => {
        const taskText = `${task.title} ${task.description}`.toLowerCase()
        expect(taskText).toContain(searchTerm.toLowerCase())
        expect(['planned']).toContain(task.status)
        expect(['high']).toContain(task.priority)
      })
    })
  })

  describe('Task Statistics', () => {
    beforeEach(async () => {
      await loadTestEnvironment(serviceOrchestrator, {
        taskCount: 30,
        includeTasks: true,
        includeProjects: false
      })
    })

    it('should calculate task statistics correctly', async () => {
      const stats = await enhancedTaskService.getTaskStatistics()

      expect(stats).toHaveProperty('totalTasks')
      expect(stats).toHaveProperty('completedTasks')
      expect(stats).toHaveProperty('inProgressTasks')
      expect(stats).toHaveProperty('plannedTasks')
      expect(stats).toHaveProperty('backlogTasks')
      expect(stats).toHaveProperty('onHoldTasks')
      expect(stats).toHaveProperty('totalEstimatedMinutes')
      expect(stats).toHaveProperty('totalCompletedPomodoros')

      expect(typeof stats.totalTasks).toBe('number')
      expect(typeof stats.completedTasks).toBe('number')
      expect(typeof stats.inProgressTasks).toBe('number')
    })

    it('should validate test data integrity', () => {
      const validation = validateTestData(serviceOrchestrator)

      expect(validation).toHaveProperty('totalTasks')
      expect(validation).toHaveProperty('testTasks')
      expect(validation).toHaveProperty('hasValidProjects')
      expect(validation).toHaveProperty('hasValidStatuses')
      expect(validation).toHaveProperty('hasValidPriorities')
      expect(validation).toHaveProperty('issues')

      expect(Array.isArray(validation.issues)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle task creation errors gracefully', async () => {
      const invalidTaskData = {
        title: 'x'.repeat(300), // Too long title
        description: 'x'.repeat(3000), // Too long description
        estimatedDuration: -10 // Invalid duration
      }

      const result = await enhancedTaskService.createTask(invalidTaskData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.details?.errors.length).toBeGreaterThan(0)
    })

    it('should handle update errors for non-existent tasks', async () => {
      const nonExistentId = 'non-existent-task-id'
      const updates = { title: 'Updated Title' }

      const result = await serviceOrchestrator.updateTask(nonExistentId, updates)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle deletion errors for non-existent tasks', async () => {
      const nonExistentId = 'non-existent-task-id'

      const result = await serviceOrchestrator.deleteTask(nonExistentId)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})