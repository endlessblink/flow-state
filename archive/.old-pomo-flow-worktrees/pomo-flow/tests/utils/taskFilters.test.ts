/**
 * Unit Tests for Unified Task Filtering System
 * Tests the single source of truth for all task filtering across views
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  filterTasksByView,
  getChildProjectIds,
  type FilterOptions,
  type Task,
  type Project,
  type ViewType
} from '@/utils/taskFilters'
import { formatDateKey, parseDateKey } from '@/stores/tasks'

// Mock date functions for consistent testing
const mockToday = '2025-11-01'
vi.mock('@/stores/tasks', async () => {
  const actual = await vi.importActual('@/stores/tasks')
  return {
    ...actual,
    formatDateKey: vi.fn(() => mockToday),
    parseDateKey: vi.fn((date: string) => {
      if (date === mockToday) return new Date('2025-11-01')
      if (date === '2025-10-31') return new Date('2025-10-31')
      if (date === '2025-11-02') return new Date('2025-11-02')
      if (date === '2025-11-03') return new Date('2025-11-03') // Sunday
      return null
    })
  }
})

describe('Unified Task Filtering System', () => {
  let mockTasks: Task[]
  let mockProjects: Project[]

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Create comprehensive test data
    mockTasks = [
      {
        id: 'task-1',
        title: 'Overdue Task',
        description: 'Past due date',
        status: 'planned',
        priority: 'high',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '2025-10-31', // Yesterday
        projectId: 'project-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        isInInbox: false
      },
      {
        id: 'task-2',
        title: 'Today Task',
        description: 'Due today',
        status: 'in_progress',
        priority: 'medium',
        progress: 50,
        completedPomodoros: 2,
        subtasks: [],
        dueDate: mockToday,
        projectId: 'project-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        isInInbox: false
      },
      {
        id: 'task-3',
        title: 'Future Task',
        description: 'Due tomorrow',
        status: 'planned',
        priority: 'low',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '2025-11-02',
        projectId: 'project-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        isInInbox: false
      },
      {
        id: 'task-4',
        title: 'Done Task',
        description: 'Completed task',
        status: 'done',
        priority: null,
        progress: 100,
        completedPomodoros: 5,
        subtasks: [],
        dueDate: mockToday,
        projectId: 'project-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        isInInbox: false
      },
      {
        id: 'task-5',
        title: 'Inbox Task',
        description: 'Not positioned',
        status: 'backlog',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        projectId: 'project-3',
        createdAt: new Date(),
        updatedAt: new Date(),
        isInInbox: true
      },
      {
        id: 'task-6',
        title: 'Weekend Task',
        description: 'Due on Sunday',
        status: 'planned',
        priority: 'high',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '2025-11-03', // Sunday
        projectId: 'project-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        isInInbox: false
      }
    ]

    mockProjects = [
      {
        id: 'project-1',
        name: 'Work Project',
        color: 'blue',
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null
      },
      {
        id: 'project-2',
        name: 'Personal Project',
        color: 'green',
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null
      },
      {
        id: 'project-3',
        name: 'Inbox',
        color: 'gray',
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null
      },
      {
        id: 'project-1-child',
        name: 'Work Subproject',
        color: 'blue',
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: 'project-1'
      },
      {
        id: 'project-1-grandchild',
        name: 'Work Sub-Subproject',
        color: 'blue',
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: 'project-1-child'
      }
    ]
  })

  describe('filterTasksByView - Core Functionality', () => {
    it('should return all tasks when no filters are applied', () => {
      const result = filterTasksByView(mockTasks, 'board', {}, mockProjects)
      expect(result).toHaveLength(6)
      expect(result.map(t => t.id)).toEqual(expect.arrayContaining([
        'task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6'
      ]))
    })

    it('should handle empty task array gracefully', () => {
      const result = filterTasksByView([], 'board', {}, mockProjects)
      expect(result).toHaveLength(0)
    })

    it('should handle invalid tasks input gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = filterTasksByView(null as any, 'board', {}, mockProjects)
      expect(result).toHaveLength(0)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid tasks input')
      )
      consoleSpy.mockRestore()
    })

    it('should handle invalid viewType gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = filterTasksByView(mockTasks, 'invalid' as ViewType, {}, mockProjects)
      expect(result).toHaveLength(6) // Should return original tasks
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid viewType')
      )
      consoleSpy.mockRestore()
    })
  })

  describe('getChildProjectIds - Hierarchical Project Support', () => {
    it('should return only parent ID when no projects provided', () => {
      const result = getChildProjectIds('project-1')
      expect(result).toEqual(['project-1'])
    })

    it('should return only parent ID when projects array is empty', () => {
      const result = getChildProjectIds('project-1', [])
      expect(result).toEqual(['project-1'])
    })

    it('should return parent and child project IDs', () => {
      const result = getChildProjectIds('project-1', mockProjects)
      expect(result).toEqual(['project-1', 'project-1-child', 'project-1-grandchild'])
    })

    it('should return only parent ID for project with no children', () => {
      const result = getChildProjectIds('project-2', mockProjects)
      expect(result).toEqual(['project-2'])
    })

    it('should handle invalid projectId gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = getChildProjectIds('', mockProjects)
      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid projectId')
      )
      consoleSpy.mockRestore()
    })

    it('should prevent infinite recursion with circular references', () => {
      // Create circular reference
      const circularProjects = [...mockProjects]
      circularProjects.push({
        id: 'project-1',
        name: 'Circular Project',
        color: 'red',
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: 'project-1-grandchild' // Creates circular reference
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = getChildProjectIds('project-1', circularProjects)
      expect(result).toContain('project-1')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circular reference detected')
      )
      consoleSpy.mockRestore()
    })
  })

  describe('Project Filtering', () => {
    it('should filter by specific project ID', () => {
      const filters: FilterOptions = { projectId: 'project-1' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)

      expect(result.map(t => t.id)).toEqual(['task-1', 'task-2', 'task-4'])
    })

    it('should filter by parent project and include children', () => {
      // Add task in child project
      const taskInChild = {
        ...mockTasks[0],
        id: 'task-child',
        projectId: 'project-1-child'
      }
      const tasksWithChild = [...mockTasks, taskInChild]

      const filters: FilterOptions = { projectId: 'project-1' }
      const result = filterTasksByView(tasksWithChild, 'board', filters, mockProjects)

      expect(result.map(t => t.id)).toEqual(expect.arrayContaining([
        'task-1', 'task-2', 'task-4', 'task-child'
      ]))
    })

    it('should handle "all" project filter', () => {
      const filters: FilterOptions = { projectId: 'all' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result).toHaveLength(6)
    })

    it('should handle "inbox" project filter', () => {
      const filters: FilterOptions = { projectId: 'inbox' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-5'])
    })
  })

  describe('Status Filtering', () => {
    it('should filter by status', () => {
      const filters: FilterOptions = { statusFilter: 'done' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-4'])
    })

    it('should handle both projectId and statusFilter', () => {
      const filters: FilterOptions = {
        projectId: 'project-1',
        statusFilter: 'planned'
      }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-1'])
    })
  })

  describe('Priority Filtering', () => {
    it('should filter by high priority', () => {
      const filters: FilterOptions = { priorityFilter: 'high' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-1', 'task-6'])
    })

    it('should filter by null priority', () => {
      const filters: FilterOptions = { priorityFilter: null }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-4'])
    })
  })

  describe('Smart View Filtering', () => {
    it('should filter by today smart view', () => {
      const filters: FilterOptions = { smartView: 'today' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-2', 'task-4'])
    })

    it('should filter by overdue smart view', () => {
      const filters: FilterOptions = { smartView: 'overdue' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-1'])
    })

    it('should filter by completed smart view', () => {
      const filters: FilterOptions = { smartView: 'completed' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-4'])
    })

    it('should filter by inbox smart view', () => {
      const filters: FilterOptions = { smartView: 'inbox' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-5'])
    })

    it('should filter by weekend smart view', () => {
      const filters: FilterOptions = { smartView: 'weekend' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-6']) // Sunday task
    })
  })

  describe('Date Filtering', () => {
    it('should filter by specific date', () => {
      const filters: FilterOptions = { dateFilter: mockToday }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-2', 'task-4'])
    })

    it('should filter by date range', () => {
      const filters: FilterOptions = {
        dateRange: {
          start: '2025-10-31',
          end: '2025-11-02'
        }
      }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-1', 'task-2', 'task-3', 'task-4'])
    })
  })

  describe('Text Search Filtering', () => {
    it('should filter by title search', () => {
      const filters: FilterOptions = { searchText: 'Task' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result).toHaveLength(6)
    })

    it('should filter by description search', () => {
      const filters: FilterOptions = { searchText: 'due' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-1', 'task-2', 'task-3'])
    })

    it('should handle empty search text', () => {
      const filters: FilterOptions = { searchText: '' }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result).toHaveLength(6)
    })
  })

  describe('UI Preference Filtering', () => {
    it('should hide done tasks when hideDoneTasks is true', () => {
      const filters: FilterOptions = { hideDoneTasks: true }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).not.toContain('task-4')
      expect(result).toHaveLength(5)
    })

    it('should include done tasks when hideDoneTasks is false', () => {
      const filters: FilterOptions = { hideDoneTasks: false }
      const result = filterTasksByView(mockTasks, 'board', filters, mockProjects)
      expect(result.map(t => t.id)).toContain('task-4')
      expect(result).toHaveLength(6)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed task data gracefully', () => {
      const malformedTasks = [
        null as any,
        undefined as any,
        { id: 'valid', title: 'Valid Task' } as Task,
        { id: 'invalid-no-title' } as any
      ]

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = filterTasksByView(malformedTasks, 'board', {}, mockProjects)

      expect(result).toHaveLength(4) // Should return all tasks on error
      consoleSpy.mockRestore()
    })

    it('should handle filter function errors gracefully', () => {
      const problematicTask = {
        ...mockTasks[0],
        projectId: undefined // This could cause issues
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = filterTasksByView([problematicTask], 'board', { projectId: 'project-1' }, mockProjects)

      expect(result).toHaveLength(1) // Should include task on error
      consoleSpy.mockRestore()
    })

    it('should handle missing projects array in project filtering', () => {
      const filters: FilterOptions = { projectId: 'project-1' }
      const result = filterTasksByView(mockTasks, 'board', filters)

      // Should still work, just no hierarchical filtering
      expect(result.map(t => t.id)).toEqual(['task-1', 'task-2', 'task-4'])
    })
  })

  describe('Performance and Optimization', () => {
    it('should handle large datasets efficiently', () => {
      // Create large dataset
      const largeTasks: Task[] = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
        title: `Task ${i}`,
        projectId: i % 10 === 0 ? 'project-1' : 'project-2'
      }))

      const startTime = performance.now()
      const filters: FilterOptions = { projectId: 'project-1' }
      const result = filterTasksByView(largeTasks, 'board', filters, mockProjects)
      const endTime = performance.now()

      expect(result.length).toBeLessThanOrEqual(1000)
      expect(endTime - startTime).toBeLessThan(100) // Should complete in <100ms
    })
  })

  describe('Integration with Different View Types', () => {
    it('should work with board view type', () => {
      const result = filterTasksByView(mockTasks, 'board', { statusFilter: 'done' }, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-4'])
    })

    it('should work with calendar view type', () => {
      const result = filterTasksByView(mockTasks, 'calendar', { dateFilter: mockToday }, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-2', 'task-4'])
    })

    it('should work with canvas view type', () => {
      const result = filterTasksByView(mockTasks, 'canvas', { showInInbox: true }, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-5'])
    })

    it('should work with list view type', () => {
      const result = filterTasksByView(mockTasks, 'list', { smartView: 'overdue' }, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-1'])
    })

    it('should work with all view type', () => {
      const result = filterTasksByView(mockTasks, 'all', { priorityFilter: 'high' }, mockProjects)
      expect(result.map(t => t.id)).toEqual(['task-1', 'task-6'])
    })
  })
})