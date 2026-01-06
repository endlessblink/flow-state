import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCanvasStore } from '../canvas'
import type { Task } from '../tasks'

// Mock the database composable
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchGroups: vi.fn().mockResolvedValue([])
  })
}))

describe('CanvasStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Viewport Management', () => {
    it('sets viewport position and zoom', () => {
      const store = useCanvasStore()

      store.setViewport(100, 200, 1.5)

      expect(store.viewport.x).toBe(100)
      expect(store.viewport.y).toBe(200)
      expect(store.viewport.zoom).toBe(1.5)
    })
  })

  describe('Node Selection', () => {
    it('sets selected nodes', () => {
      const store = useCanvasStore()

      store.setSelectedNodes(['task-1', 'task-2', 'task-3'])

      expect(store.selectedNodeIds).toEqual(['task-1', 'task-2', 'task-3'])
    })

    it('toggles node selection', () => {
      const store = useCanvasStore()

      store.toggleNodeSelection('task-1')
      expect(store.selectedNodeIds).toContain('task-1')

      store.toggleNodeSelection('task-1')
      expect(store.selectedNodeIds).not.toContain('task-1')
    })

    it('clears all selections', () => {
      const store = useCanvasStore()
      store.setSelectedNodes(['task-1', 'task-2'])

      store.clearSelection()

      expect(store.selectedNodeIds).toEqual([])
      expect(store.selectionRect).toBeNull()
      expect(store.isSelecting).toBe(false)
    })
  })

  describe('Section Management', () => {
    it('creates a section', async () => {
      const store = useCanvasStore()

      const section = await store.createSection({
        name: 'High Priority',
        type: 'priority',
        propertyValue: 'high',
        position: { x: 100, y: 100, width: 300, height: 250 },
        color: '#ef4444',
        layout: 'grid',
        isVisible: true,
        isCollapsed: false
      })

      expect(section).toBeDefined()
      expect(section.name).toBe('High Priority')
      expect(section.type).toBe('priority')
      expect(section.propertyValue).toBe('high')
      expect(store.sections.length).toBe(1)
    })

    it('updates a section', async () => {
      const store = useCanvasStore()
      const section = await store.createSection({
        name: 'Original',
        type: 'custom',
        position: { x: 0, y: 0, width: 300, height: 250 },
        color: '#000000',
        layout: 'vertical',
        isVisible: true,
        isCollapsed: false
      })

      store.updateSection(section.id, {
        name: 'Updated',
        color: '#ffffff'
      })

      const updated = store.sections.find(s => s.id === section.id)
      expect(updated?.name).toBe('Updated')
      expect(updated?.color).toBe('#ffffff')
    })

    it('deletes a section', async () => {
      const store = useCanvasStore()
      const section = await store.createSection({
        name: 'To Delete',
        type: 'custom',
        position: { x: 0, y: 0, width: 300, height: 250 },
        color: '#000000',
        layout: 'vertical',
        isVisible: true,
        isCollapsed: false
      })

      expect(store.sections.length).toBe(1)

      store.deleteSection(section.id)

      expect(store.sections.length).toBe(0)
    })

    it('toggles section visibility', async () => {
      const store = useCanvasStore()
      const section = await store.createSection({
        name: 'Section',
        type: 'custom',
        position: { x: 0, y: 0, width: 300, height: 250 },
        color: '#000000',
        layout: 'vertical',
        isVisible: true,
        isCollapsed: false
      })

      store.toggleSectionVisibility(section.id)
      expect(store.sections[0].isVisible).toBe(false)

      store.toggleSectionVisibility(section.id)
      expect(store.sections[0].isVisible).toBe(true)
    })

    it('toggles section collapse', async () => {
      const store = useCanvasStore()
      const section = await store.createSection({
        name: 'Section',
        type: 'custom',
        position: { x: 0, y: 0, width: 300, height: 250 },
        color: '#000000',
        layout: 'vertical',
        isVisible: true,
        isCollapsed: false
      })

      store.toggleSectionCollapse(section.id)
      expect(store.sections[0].isCollapsed).toBe(true)

      store.toggleSectionCollapse(section.id)
      expect(store.sections[0].isCollapsed).toBe(false)
    })


  })

  describe('Smart Section Creators', () => {
    it('creates priority sections', async () => {
      const store = useCanvasStore()

      const high = await store.createSection({ name: 'High Priority', type: 'priority', propertyValue: 'high', color: '#ef4444', position: { x: 0, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })
      const medium = await store.createSection({ name: 'Medium Priority', type: 'priority', propertyValue: 'medium', color: '#f59e0b', position: { x: 350, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })
      const low = await store.createSection({ name: 'Low Priority', type: 'priority', propertyValue: 'low', color: '#3b82f6', position: { x: 700, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })

      expect(high.name).toBe('High Priority')
      expect(high.type).toBe('priority')
      expect(high.propertyValue).toBe('high')
      expect(high.color).toBe('#ef4444')

      expect(medium.name).toBe('Medium Priority')
      expect(medium.propertyValue).toBe('medium')

      expect(low.name).toBe('Low Priority')
      expect(low.propertyValue).toBe('low')

      expect(store.sections.length).toBe(3)
    })

    it('creates status sections', async () => {
      const store = useCanvasStore()

      const planned = await store.createSection({ name: 'Planned', type: 'status', propertyValue: 'planned', color: '#6366f1', position: { x: 0, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })
      const inProgress = await store.createSection({ name: 'In Progress', type: 'status', propertyValue: 'in_progress', color: '#f59e0b', position: { x: 350, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })
      const done = await store.createSection({ name: 'Done', type: 'status', propertyValue: 'done', color: '#10b981', position: { x: 700, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })

      expect(planned.name).toBe('Planned')
      expect(planned.type).toBe('status')
      expect(planned.propertyValue).toBe('planned')

      expect(inProgress.name).toBe('In Progress')
      expect(inProgress.propertyValue).toBe('in_progress')

      expect(done.name).toBe('Done')
      expect(done.propertyValue).toBe('done')

      expect(store.sections.length).toBe(3)
    })

    it('creates project sections', async () => {
      const store = useCanvasStore()

      const section = await store.createSection({ name: 'My Project', type: 'project', propertyValue: 'project-123', color: '#3b82f6', position: { x: 0, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })

      expect(section.name).toBe('My Project')
      expect(section.type).toBe('project')
      expect(section.propertyValue).toBe('project-123')
      expect(section.color).toBe('#3b82f6')
    })
  })

  describe('Task Filtering', () => {
    it('filters tasks by priority section', async () => {
      const store = useCanvasStore()

      const section = await store.createSection({ name: 'High Priority', type: 'priority', propertyValue: 'high', color: '#ef4444', position: { x: 0, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })

      const tasks: Task[] = [
        {
          id: '1',
          title: 'High Task',
          description: '',
          status: 'planned',
          priority: 'high',
          progress: 0,
          completedPomodoros: 0,
          subtasks: [],
          dueDate: '',
          projectId: '1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          title: 'Medium Task',
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
      ]

      // Note: getTasksInSection returns all tasks if no filters are set
      // Priority sections use taskMatchesSection for matching, not getTasksInSection filters
      // Let's test using taskMatchesSection instead
      const filtered = tasks.filter(task => store.taskMatchesSection(task, section.id))

      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('1')
      expect(filtered[0].priority).toBe('high')
    })

    it('filters tasks by status section', async () => {
      const store = useCanvasStore()

      const section = await store.createSection({ name: 'In Progress', type: 'status', propertyValue: 'in_progress', color: '#f59e0b', position: { x: 0, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })

      const tasks: Task[] = [
        {
          id: '1',
          title: 'Task 1',
          description: '',
          status: 'in_progress',
          priority: 'medium',
          progress: 0,
          completedPomodoros: 0,
          subtasks: [],
          dueDate: '',
          projectId: '1',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          title: 'Task 2',
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
      ]

      // Use taskMatchesSection for smart section filtering
      const filtered = tasks.filter(task => store.taskMatchesSection(task, section.id))

      expect(filtered.length).toBe(1)
      expect(filtered[0].id).toBe('1')
      expect(filtered[0].status).toBe('in_progress')
    })
  })

  describe('Task Matching', () => {
    it('matches task to priority section', async () => {
      const store = useCanvasStore()
      const section = await store.createSection({ name: 'High Priority', type: 'priority', propertyValue: 'high', color: '#ef4444', position: { x: 0, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })

      const highTask: Task = {
        id: '1',
        title: 'High Priority Task',
        description: '',
        status: 'planned',
        priority: 'high',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        projectId: '1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const lowTask: Task = {
        ...highTask,
        id: '2',
        priority: 'low'
      }

      expect(store.taskMatchesSection(highTask, section.id)).toBe(true)
      expect(store.taskMatchesSection(lowTask, section.id)).toBe(false)
    })

    it('matches task to status section', async () => {
      const store = useCanvasStore()
      const section = await store.createSection({ name: 'Done', type: 'status', propertyValue: 'done', color: '#10b981', position: { x: 0, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })

      const doneTask: Task = {
        id: '1',
        title: 'Done Task',
        description: '',
        status: 'done',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        projectId: '1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const plannedTask: Task = {
        ...doneTask,
        id: '2',
        status: 'planned'
      }

      expect(store.taskMatchesSection(doneTask, section.id)).toBe(true)
      expect(store.taskMatchesSection(plannedTask, section.id)).toBe(false)
    })

    it('matches task to project section', async () => {
      const store = useCanvasStore()
      const section = await store.createSection({ name: 'Project 1', type: 'project', propertyValue: 'proj-1', color: '#3b82f6', position: { x: 0, y: 0, width: 300, height: 200 }, layout: 'vertical', isVisible: true, isCollapsed: false })

      const task1: Task = {
        id: '1',
        title: 'Task 1',
        description: '',
        status: 'planned',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        projectId: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const task2: Task = {
        ...task1,
        id: '2',
        projectId: 'proj-2'
      }

      expect(store.taskMatchesSection(task1, section.id)).toBe(true)
      expect(store.taskMatchesSection(task2, section.id)).toBe(false)
    })
  })

  describe('Multi-Selection', () => {
    it('toggles multi-select mode', () => {
      const store = useCanvasStore()

      expect(store.multiSelectMode).toBe(false)

      store.toggleMultiSelectMode()
      expect(store.multiSelectMode).toBe(true)

      store.toggleMultiSelectMode()
      expect(store.multiSelectMode).toBe(false)
    })

    it('sets selection mode', () => {
      const store = useCanvasStore()

      store.setSelectionMode('lasso')
      expect(store.selectionMode).toBe('lasso')

      store.setSelectionMode('rectangle')
      expect(store.selectionMode).toBe('rectangle')

      store.setSelectionMode('click')
      expect(store.selectionMode).toBe('click')
    })

    it('manages selection rect state', () => {
      const store = useCanvasStore()

      store.startSelection(50, 50)
      expect(store.isSelecting).toBe(true)
      expect(store.selectionRect).toEqual({ x: 50, y: 50, width: 0, height: 0 })

      store.updateSelection(50, 50) // Initial update same as start
      expect(store.selectionRect).toEqual({ x: 50, y: 50, width: 0, height: 0 })

      store.updateSelection(150, 200) // Drag to new pos
      expect(store.selectionRect).toEqual({ x: 50, y: 50, width: 100, height: 150 })

      store.endSelection()
      expect(store.isSelecting).toBe(false)
    })

    it('selects nodes in rectangle', () => {
      const store = useCanvasStore()

      const nodes = [
        { id: 'task-1', position: { x: 100, y: 100 } },
        { id: 'task-2', position: { x: 300, y: 100 } },
        { id: 'task-3', position: { x: 500, y: 100 } }
      ]

      const rect = { x: 50, y: 50, width: 300, height: 200 }

      store.selectNodesInRect(rect)

      // Should select task-1 and task-2 (both within rect bounds)
      expect(store.selectedNodeIds.length).toBe(2)
      expect(store.selectedNodeIds).toContain('task-1')
      expect(store.selectedNodeIds).toContain('task-2')
    })
  })

  describe('Connection Mode', () => {
    it('toggles connect mode', () => {
      const store = useCanvasStore()

      expect(store.connectMode).toBe(false)

      store.toggleConnectMode()
      expect(store.connectMode).toBe(true)

      store.toggleConnectMode()
      expect(store.connectMode).toBe(false)
      expect(store.connectingFrom).toBeNull()
    })

    it('starts connection from node', () => {
      const store = useCanvasStore()

      store.startConnection('task-1')

      expect(store.connectMode).toBe(true)
      expect(store.connectingFrom).toBe('task-1')
    })

    it('clears connection', () => {
      const store = useCanvasStore()
      store.startConnection('task-1')

      store.clearConnection()

      expect(store.connectMode).toBe(false)
      expect(store.connectingFrom).toBeNull()
    })
  })

  describe('Display Preferences', () => {
    it('toggles priority indicator', () => {
      const store = useCanvasStore()

      expect(store.showPriorityIndicator).toBe(true)

      store.togglePriorityIndicator()
      expect(store.showPriorityIndicator).toBe(false)

      store.togglePriorityIndicator()
      expect(store.showPriorityIndicator).toBe(true)
    })

    it('toggles status badge', () => {
      const store = useCanvasStore()

      expect(store.showStatusBadge).toBe(true)

      store.toggleStatusBadge()
      expect(store.showStatusBadge).toBe(false)
    })

    it('toggles duration badge', () => {
      const store = useCanvasStore()

      expect(store.showDurationBadge).toBe(true)

      store.toggleDurationBadge()
      expect(store.showDurationBadge).toBe(false)
    })

    it('toggles schedule badge', () => {
      const store = useCanvasStore()

      expect(store.showScheduleBadge).toBe(true)

      store.toggleScheduleBadge()
      expect(store.showScheduleBadge).toBe(false)
    })
  })

  describe('Active Section', () => {
    it('sets active section', () => {
      const store = useCanvasStore()

      store.setActiveSection('section-123')
      expect(store.activeSectionId).toBe('section-123')

      store.setActiveSection(null)
      expect(store.activeSectionId).toBeNull()
    })

    it('clears active section when section is deleted', async () => {
      const store = useCanvasStore()
      const section = await store.createSection({
        name: 'Section',
        type: 'custom',
        position: { x: 0, y: 0, width: 300, height: 250 },
        color: '#000000',
        layout: 'vertical',
        isVisible: true,
        isCollapsed: false
      })

      store.setActiveSection(section.id)
      expect(store.activeSectionId).toBe(section.id)

      store.deleteSection(section.id)
      expect(store.activeSectionId).toBeNull()
    })
  })
})
