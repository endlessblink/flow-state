import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore, formatDateKey, parseDateKey, getTaskInstances } from '../tasks'
import type { Task, TaskInstance } from '../tasks'

// Mock the database composable
vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({
    save: vi.fn(),
    load: vi.fn().mockResolvedValue(null)
  }),
  DB_KEYS: {
    TASKS: 'tasks',
    PROJECTS: 'projects',
    CANVAS: 'canvas'
  }
}))

describe('TaskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Task CRUD Operations', () => {
    it('creates a task with default values', async () => {
      const store = useTaskStore()

      const task = await store.createTask({
        title: 'Test Task'
      })

      expect(task).toBeDefined()
      expect(task.title).toBe('Test Task')
      expect(task.status).toBe('planned')
      expect(task.priority).toBe('medium')
      expect(task.progress).toBe(0)
      expect(task.completedPomodoros).toBe(0)
      expect(task.isInInbox).toBe(true)
      expect(task.projectId).toBe('1')
    })

    it('creates a task with scheduled date and time as instance', async () => {
      const store = useTaskStore()

      const task = await store.createTask({
        title: 'Scheduled Task',
        scheduledDate: '2025-10-11',
        scheduledTime: '14:00',
        estimatedDuration: 60
      })

      expect(task.instances).toBeDefined()
      expect(task.instances?.length).toBe(1)
      expect(task.instances?.[0].scheduledDate).toBe('2025-10-11')
      expect(task.instances?.[0].scheduledTime).toBe('14:00')
      expect(task.instances?.[0].duration).toBe(60)
    })

    it('updates a task', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Original' })

      store.updateTask(task.id, {
        title: 'Updated',
        status: 'in_progress'
      })

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.title).toBe('Updated')
      expect(updatedTask?.status).toBe('in_progress')
    })

    it('deletes a task', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'To Delete' })

      expect(store.tasks.length).toBe(1)

      store.deleteTask(task.id)

      expect(store.tasks.length).toBe(0)
    })

    it('moves a task to different status', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Task', status: 'planned' })

      store.moveTask(task.id, 'in_progress')

      const movedTask = store.tasks.find(t => t.id === task.id)
      expect(movedTask?.status).toBe('in_progress')
    })

    it('auto-archives completed tasks (removes from canvas)', async () => {
      const store = useTaskStore()
      const task = await store.createTask({
        title: 'Task',
        status: 'in_progress',
        canvasPosition: { x: 100, y: 100 },
        isInInbox: false
      })

      store.updateTask(task.id, { status: 'done' })

      const completedTask = store.tasks.find(t => t.id === task.id)
      expect(completedTask?.status).toBe('done')
      expect(completedTask?.isInInbox).toBe(true)
      expect(completedTask?.canvasPosition).toBeUndefined()
    })
  })

  describe('Task Instance Management', () => {
    it('creates a task instance', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Test Task' })

      const instance = store.createTaskInstance(task.id, {
        scheduledDate: '2025-10-15',
        scheduledTime: '10:00',
        duration: 45
      })

      expect(instance).toBeDefined()
      expect(instance?.scheduledDate).toBe('2025-10-15')
      expect(instance?.scheduledTime).toBe('10:00')
      expect(instance?.duration).toBe(45)

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.instances?.length).toBe(1)
    })

    it('updates a task instance', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Test Task' })
      const instance = store.createTaskInstance(task.id, {
        scheduledDate: '2025-10-15',
        scheduledTime: '10:00'
      })

      if (instance) {
        store.updateTaskInstance(task.id, instance.id, {
          scheduledTime: '11:00',
          duration: 90
        })
      }

      const updatedTask = store.tasks.find(t => t.id === task.id)
      const updatedInstance = updatedTask?.instances?.find(i => i.id === instance?.id)
      expect(updatedInstance?.scheduledTime).toBe('11:00')
      expect(updatedInstance?.duration).toBe(90)
    })

    it('deletes a task instance', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Test Task' })
      const instance = store.createTaskInstance(task.id, {
        scheduledDate: '2025-10-15',
        scheduledTime: '10:00'
      })

      expect(task.instances?.length).toBe(1)

      if (instance) {
        store.deleteTaskInstance(task.id, instance.id)
      }

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.instances?.length).toBe(0)
    })

    it('supports multiple instances of same task', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Recurring Task' })

      store.createTaskInstance(task.id, {
        scheduledDate: '2025-10-15',
        scheduledTime: '10:00'
      })
      store.createTaskInstance(task.id, {
        scheduledDate: '2025-10-16',
        scheduledTime: '14:00'
      })
      store.createTaskInstance(task.id, {
        scheduledDate: '2025-10-17',
        scheduledTime: '09:00'
      })

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.instances?.length).toBe(3)
    })
  })

  describe('Project Management', () => {
    it('creates a project', () => {
      const store = useTaskStore()

      const project = store.createProject({
        name: 'Test Project',
        color: '#ff0000',
        colorType: 'hex'
      })

      expect(project).toBeDefined()
      expect(project.name).toBe('Test Project')
      expect(project.color).toBe('#ff0000')
      expect(project.colorType).toBe('hex')
      expect(project.viewType).toBe('status')
    })

    it('updates a project', () => {
      const store = useTaskStore()
      const project = store.createProject({ name: 'Original' })

      store.updateProject(project.id, {
        name: 'Updated',
        color: '#00ff00'
      })

      const updated = store.getProjectById(project.id)
      expect(updated?.name).toBe('Updated')
      expect(updated?.color).toBe('#00ff00')
    })

    it('deletes a project and moves tasks to default project', async () => {
      const store = useTaskStore()
      const project = store.createProject({ name: 'To Delete' })
      const task = await store.createTask({ title: 'Task', projectId: project.id })

      store.deleteProject(project.id)

      expect(store.projects.find(p => p.id === project.id)).toBeUndefined()
      const movedTask = store.tasks.find(t => t.id === task.id)
      expect(movedTask?.projectId).toBe('1') // Moved to default project
    })

    it('prevents deletion of default project', () => {
      const store = useTaskStore()
      const initialCount = store.projects.length

      store.deleteProject('1')

      expect(store.projects.length).toBe(initialCount)
    })

    it('supports nested projects', () => {
      const store = useTaskStore()
      const parent = store.createProject({ name: 'Parent' })
      const child = store.createProject({
        name: 'Child',
        parentId: parent.id
      })

      expect(child.parentId).toBe(parent.id)

      const children = store.getChildProjects(parent.id)
      expect(children.length).toBe(1)
      expect(children[0].id).toBe(child.id)
    })

    it('detects project hierarchy correctly', () => {
      const store = useTaskStore()
      const grandparent = store.createProject({ name: 'Grandparent' })
      const parent = store.createProject({ name: 'Parent', parentId: grandparent.id })
      const child = store.createProject({ name: 'Child', parentId: parent.id })

      // Wait a tick for the hierarchy to be fully established
      const isDescendant = store.isDescendantOf(child.id, grandparent.id)
      // Note: isDescendantOf checks if child.parentId === grandparent.id directly
      // but child.parentId === parent.id, so it needs to walk up the chain
      // The current implementation walks up checking current.parentId === potentialAncestorId
      // So child -> parent (parentId = grandparent), matches! Returns true
      expect(isDescendant).toBe(true)

      const isNotDescendant = store.isDescendantOf(grandparent.id, child.id)
      expect(isNotDescendant).toBe(false)
    })
  })

  describe('Task Filtering', () => {
    it('filters tasks by active project', async () => {
      const store = useTaskStore()

      // Clear any existing tasks to start fresh
      store.tasks.length = 0

      // Note: Store initializes with default "My Tasks" project (id: '1')
      // Create new projects for testing
      const project1 = store.createProject({ name: 'Project 1' })
      await new Promise(resolve => setTimeout(resolve, 2))
      const project2 = store.createProject({ name: 'Project 2' })

      // Create tasks with delays to ensure unique IDs
      const task1 = await store.createTask({ title: 'Task 1', projectId: project1.id })
      await new Promise(resolve => setTimeout(resolve, 2))
      const task2 = await store.createTask({ title: 'Task 2', projectId: project1.id })
      await new Promise(resolve => setTimeout(resolve, 2))
      const task3 = await store.createTask({ title: 'Task 3', projectId: project2.id })

      // Verify unique IDs
      expect(task1.id).not.toBe(task2.id)
      expect(task2.id).not.toBe(task3.id)

      // Verify tasks are in correct projects
      expect(task1.projectId).toBe(project1.id)
      expect(task2.projectId).toBe(project1.id)
      expect(task3.projectId).toBe(project2.id)

      // Verify total tasks before filtering
      expect(store.tasks.length).toBe(3)

      store.setActiveProject(project1.id)

      // Should only show tasks from project1
      expect(store.filteredTasks.length).toBe(2)
      expect(store.filteredTasks.every(t => t.projectId === project1.id)).toBe(true)
      expect(store.filteredTasks.map(t => t.id)).toContain(task1.id)
      expect(store.filteredTasks.map(t => t.id)).toContain(task2.id)
    })

    it('filters tasks by "today" smart view', () => {
      const store = useTaskStore()
      const today = new Date().toISOString().split('T')[0]

      store.createTask({
        title: 'Today Task',
        scheduledDate: today,
        scheduledTime: '10:00'
      })
      store.createTask({
        title: 'Future Task',
        scheduledDate: '2025-12-31',
        scheduledTime: '10:00'
      })

      store.setSmartView('today')

      expect(store.filteredTasks.length).toBeGreaterThanOrEqual(1)
      const todayTask = store.filteredTasks.find(t => t.title === 'Today Task')
      expect(todayTask).toBeDefined()
    })
  })

  describe('Subtask Management', () => {
    it('creates a subtask', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Parent Task' })

      const subtask = store.createSubtask(task.id, {
        title: 'Subtask 1'
      })

      expect(subtask).toBeDefined()
      expect(subtask?.parentTaskId).toBe(task.id)

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.subtasks.length).toBe(1)
    })

    it('updates a subtask', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Parent Task' })
      const subtask = store.createSubtask(task.id, { title: 'Original' })

      if (subtask) {
        store.updateSubtask(task.id, subtask.id, { title: 'Updated' })
      }

      const updatedTask = store.tasks.find(t => t.id === task.id)
      const updatedSubtask = updatedTask?.subtasks.find(s => s.id === subtask?.id)
      expect(updatedSubtask?.title).toBe('Updated')
    })

    it('deletes a subtask', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Parent Task' })
      const subtask = store.createSubtask(task.id, { title: 'Subtask' })

      if (subtask) {
        store.deleteSubtask(task.id, subtask.id)
      }

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.subtasks.length).toBe(0)
    })
  })

  describe('Date Helper Functions', () => {
    it('formats date key correctly', () => {
      const date = new Date(2025, 9, 15) // October 15, 2025
      const formatted = formatDateKey(date)
      expect(formatted).toBe('2025-10-15')
    })

    it('parses date key correctly', () => {
      const parsed = parseDateKey('2025-10-15')
      expect(parsed).toBeInstanceOf(Date)
      expect(parsed?.getFullYear()).toBe(2025)
      expect(parsed?.getMonth()).toBe(9) // 0-indexed
      expect(parsed?.getDate()).toBe(15)
    })

    it('handles invalid date key', () => {
      const parsed = parseDateKey('invalid-date')
      expect(parsed).toBeNull()
    })
  })

  describe('Task Instance Helpers', () => {
    it('returns instances array if present', () => {
      const task: Task = {
        id: '1',
        title: 'Task',
        description: '',
        status: 'planned',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        projectId: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
        instances: [
          {
            id: 'inst-1',
            scheduledDate: '2025-10-15',
            scheduledTime: '10:00',
            duration: 30
          }
        ]
      }

      const instances = getTaskInstances(task)
      expect(instances.length).toBe(1)
      expect(instances[0].scheduledDate).toBe('2025-10-15')
    })

    it('creates synthetic instance from legacy fields', () => {
      const task: Task = {
        id: '1',
        title: 'Legacy Task',
        description: '',
        status: 'planned',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        projectId: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
        scheduledDate: '2025-10-15',
        scheduledTime: '14:00',
        estimatedDuration: 60
      }

      const instances = getTaskInstances(task)
      expect(instances.length).toBe(1)
      expect(instances[0].id).toContain('legacy')
      expect(instances[0].scheduledDate).toBe('2025-10-15')
      expect(instances[0].scheduledTime).toBe('14:00')
    })

    it('returns empty array for unscheduled tasks', () => {
      const task: Task = {
        id: '1',
        title: 'Unscheduled',
        description: '',
        status: 'planned',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        projectId: '1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const instances = getTaskInstances(task)
      expect(instances.length).toBe(0)
    })
  })

  describe('Computed Properties', () => {
    it('groups tasks by status correctly', async () => {
      const store = useTaskStore()

      await store.createTask({ title: 'Planned 1', status: 'planned' })
      await store.createTask({ title: 'Planned 2', status: 'planned' })
      await store.createTask({ title: 'In Progress', status: 'in_progress' })
      await store.createTask({ title: 'Done', status: 'done' })

      expect(store.tasksByStatus.planned.length).toBe(2)
      expect(store.tasksByStatus.in_progress.length).toBe(1)
      expect(store.tasksByStatus.done.length).toBe(1)
    })

    it('calculates total tasks correctly', async () => {
      const store = useTaskStore()

      await store.createTask({ title: 'Task 1' })
      await store.createTask({ title: 'Task 2' })
      await store.createTask({ title: 'Task 3' })

      expect(store.totalTasks).toBe(3)
    })

    it('calculates completed tasks correctly', async () => {
      const store = useTaskStore()

      await store.createTask({ title: 'Task 1', status: 'done' })
      await store.createTask({ title: 'Task 2', status: 'done' })
      await store.createTask({ title: 'Task 3', status: 'planned' })

      expect(store.completedTasks).toBe(2)
    })

    it('calculates total pomodoros correctly', async () => {
      const store = useTaskStore()

      await store.createTask({ title: 'Task 1', completedPomodoros: 5 })
      await store.createTask({ title: 'Task 2', completedPomodoros: 3 })
      await store.createTask({ title: 'Task 3', completedPomodoros: 2 })

      expect(store.totalPomodoros).toBe(10)
    })
  })

  describe('Date Movement', () => {
    it('moves task to today', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Task' })
      const today = new Date().toISOString().split('T')[0]

      store.moveTaskToDate(task.id, 'today')

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.instances?.length).toBe(1)
      expect(updatedTask?.instances?.[0].scheduledDate).toBe(today)
    })

    it('moves task to later', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Task' })

      store.moveTaskToDate(task.id, 'later')

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.instances?.length).toBe(1)
      expect(updatedTask?.instances?.[0].isLater).toBe(true)
    })

    it('clears all instances when moved to no date', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Task' })

      store.createTaskInstance(task.id, {
        scheduledDate: '2025-10-15',
        scheduledTime: '10:00'
      })

      store.moveTaskToDate(task.id, 'noDate')

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.instances?.length).toBe(0)
    })
  })

  describe('Priority Movement', () => {
    it('updates task priority', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Task', priority: 'low' })

      store.moveTaskToPriority(task.id, 'high')

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.priority).toBe('high')
    })

    it('removes priority with no_priority', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Task', priority: 'high' })

      store.moveTaskToPriority(task.id, 'no_priority')

      const updatedTask = store.tasks.find(t => t.id === task.id)
      expect(updatedTask?.priority).toBeNull()
    })
  })

  describe('Selection Management', () => {
    it('selects and deselects tasks', async () => {
      const store = useTaskStore()

      // Create tasks with slight delay to ensure unique IDs
      const task1 = await store.createTask({ title: 'Task 1' })
      await new Promise(resolve => setTimeout(resolve, 2)) // 2ms delay
      const task2 = await store.createTask({ title: 'Task 2' })

      // Verify tasks have unique IDs
      expect(task1.id).not.toBe(task2.id)

      // Select first task
      store.selectTask(task1.id)
      expect(store.selectedTaskIds).toContain(task1.id)
      expect(store.selectedTaskIds.length).toBe(1)

      // Select second task
      store.selectTask(task2.id)
      expect(store.selectedTaskIds).toContain(task2.id)
      expect(store.selectedTaskIds.length).toBe(2)

      // Deselect first task
      store.deselectTask(task1.id)
      expect(store.selectedTaskIds).not.toContain(task1.id)
      expect(store.selectedTaskIds.length).toBe(1)

      // Clear all selections
      store.clearSelection()
      expect(store.selectedTaskIds.length).toBe(0)
    })

    it('prevents duplicate selections', async () => {
      const store = useTaskStore()
      const task = await store.createTask({ title: 'Task' })

      store.selectTask(task.id)
      store.selectTask(task.id) // Try to select same task again

      expect(store.selectedTaskIds.length).toBe(1)
    })
  })
})
