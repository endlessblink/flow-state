/**
 * Unit Tests for Simple Project Service
 * Tests direct store access pattern and business logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectServiceSimple } from '@/services/projectServiceSimple'
import { useTaskStore } from '@/stores/tasks'

// Mock the task store for isolated testing
vi.mock('@/stores/tasks', () => ({
  useTaskStore: vi.fn()
}))

describe('useProjectServiceSimple', () => {
  let mockTaskStore: any
  let projectService: ReturnType<typeof useProjectServiceSimple>

  beforeEach(() => {
    setActivePinia(createPinia())

    // Create mock task store
    mockTaskStore = {
      projects: [
        {
          id: '1',
          name: 'My Tasks',
          description: 'Default tasks',
          color: '#6B7280',
          viewType: 'status',
          parentId: null
        },
        {
          id: '2',
          name: 'Work Project',
          description: 'Work related tasks',
          color: '#3B82F6',
          viewType: 'kanban',
          parentId: null
        },
        {
          id: '3',
          name: 'Sub Project',
          description: 'Sub project under work',
          color: '#10B981',
          viewType: 'list',
          parentId: '2'
        }
      ],
      createProjectWithUndo: vi.fn(),
      updateProjectWithUndo: vi.fn(),
      deleteProjectWithUndo: vi.fn(),
      getProjectById: vi.fn(),
      getDefaultProjectId: vi.fn().mockReturnValue('1'),
      getChildProjects: vi.fn(),
      getProjectTaskCount: vi.fn(),
      isDescendantOf: vi.fn()
    }

    // Mock useTaskStore to return our mock
    const { useTaskStore } = require('@/stores/tasks')
    useTaskStore.mockReturnValue(mockTaskStore)

    projectService = useProjectServiceSimple()
  })

  describe('createProject', () => {
    it('should create a project with valid data', async () => {
      const projectData = {
        name: 'New Project',
        description: 'Project description',
        color: '#FF6B6B',
        viewType: 'status' as const
      }

      const mockProject = {
        id: 'project-1',
        name: 'New Project',
        description: 'Project description',
        color: '#FF6B6B',
        viewType: 'status',
        parentId: null
      }

      mockTaskStore.createProjectWithUndo.mockResolvedValue(mockProject)

      const result = await projectService.createProject(projectData)

      expect(mockTaskStore.createProjectWithUndo).toHaveBeenCalledWith({
        name: 'New Project',
        description: 'Project description',
        color: '#FF6B6B',
        viewType: 'status',
        parentId: null
      })

      expect(result).toEqual(mockProject)
    })

    it('should use default values when not provided', async () => {
      const projectData = {
        name: 'Minimal Project'
      }

      const mockProject = {
        id: 'project-1',
        name: 'Minimal Project',
        color: '#6B7280',
        viewType: 'status',
        parentId: null
      }

      mockTaskStore.createProjectWithUndo.mockResolvedValue(mockProject)

      await projectService.createProject(projectData)

      expect(mockTaskStore.createProjectWithUndo).toHaveBeenCalledWith({
        name: 'Minimal Project',
        description: '',
        color: '#6B7280',
        viewType: 'status',
        parentId: null
      })
    })

    it('should throw error for empty project name', async () => {
      const projectData = {
        name: '',
        description: 'Project description'
      }

      await expect(projectService.createProject(projectData)).rejects.toThrow('Project name is required')
      expect(mockTaskStore.createProjectWithUndo).not.toHaveBeenCalled()
    })

    it('should trim whitespace from name and description', async () => {
      const projectData = {
        name: '  Project Name  ',
        description: '  Project Description  '
      }

      const mockProject = { id: 'project-1' }
      mockTaskStore.createProjectWithUndo.mockResolvedValue(mockProject)

      await projectService.createProject(projectData)

      expect(mockTaskStore.createProjectWithUndo).toHaveBeenCalledWith({
        name: 'Project Name',
        description: 'Project Description',
        color: '#6B7280',
        viewType: 'status',
        parentId: null
      })
    })
  })

  describe('updateProject', () => {
    it('should update a project with valid data', async () => {
      const updateData = {
        id: 'project-1',
        name: 'Updated Project',
        description: 'Updated description',
        color: '#FF0000'
      }

      const mockProject = {
        id: 'project-1',
        name: 'Updated Project',
        description: 'Updated description',
        color: '#FF0000'
      }

      mockTaskStore.updateProjectWithUndo.mockResolvedValue(mockProject)

      const result = await projectService.updateProject(updateData)

      expect(mockTaskStore.updateProjectWithUndo).toHaveBeenCalledWith('project-1', {
        name: 'Updated Project',
        description: 'Updated description',
        color: '#FF0000',
        updatedAt: expect.any(Date)
      })

      expect(result).toEqual(mockProject)
    })

    it('should throw error for missing project ID', async () => {
      const updateData = {
        name: 'Updated Project'
      }

      await expect(projectService.updateProject(updateData as any)).rejects.toThrow('Project ID is required for updates')
      expect(mockTaskStore.updateProjectWithUndo).not.toHaveBeenCalled()
    })

    it('should handle undefined values correctly', async () => {
      const updateData = {
        id: 'project-1',
        name: 'Updated Project',
        description: undefined
      }

      const mockProject = { id: 'project-1' }
      mockTaskStore.updateProjectWithUndo.mockResolvedValue(mockProject)

      await projectService.updateProject(updateData)

      expect(mockTaskStore.updateProjectWithUndo).toHaveBeenCalledWith('project-1', {
        name: 'Updated Project',
        description: '',
        updatedAt: expect.any(Date)
      })
    })
  })

  describe('deleteProject', () => {
    it('should delete a project with valid ID', async () => {
      const projectId = 'project-1'
      const mockProject = {
        id: projectId,
        name: 'Test Project'
      }

      mockTaskStore.getProjectById.mockReturnValue(mockProject)
      mockTaskStore.deleteProjectWithUndo.mockResolvedValue()

      await projectService.deleteProject(projectId)

      expect(mockTaskStore.getProjectById).toHaveBeenCalledWith('project-1')
      expect(mockTaskStore.deleteProjectWithUndo).toHaveBeenCalledWith('project-1')
    })

    it('should not allow deletion of default "My Tasks" project by ID', async () => {
      const projectId = '1'

      await expect(projectService.deleteProject(projectId)).rejects.toThrow('Cannot delete the default "My Tasks" project')
      expect(mockTaskStore.deleteProjectWithUndo).not.toHaveBeenCalled()
    })

    it('should not allow deletion of default "My Tasks" project by name', async () => {
      const projectId = 'project-1'
      const mockProject = {
        id: projectId,
        name: 'My Tasks'
      }

      mockTaskStore.getProjectById.mockReturnValue(mockProject)

      await expect(projectService.deleteProject(projectId)).rejects.toThrow('Cannot delete the default "My Tasks" project')
      expect(mockTaskStore.deleteProjectWithUndo).not.toHaveBeenCalled()
    })

    it('should throw error for non-existent project', async () => {
      const projectId = 'non-existent'

      mockTaskStore.getProjectById.mockReturnValue(undefined)

      await expect(projectService.deleteProject(projectId)).rejects.toThrow('Project with ID non-existent not found')
      expect(mockTaskStore.deleteProjectWithUndo).not.toHaveBeenCalled()
    })

    it('should throw error for missing project ID', async () => {
      await expect(projectService.deleteProject('')).rejects.toThrow('Project ID is required for deletion')
      expect(mockTaskStore.deleteProjectWithUndo).not.toHaveBeenCalled()
    })
  })

  describe('setProjectColor', () => {
    it('should set project color with default color type', async () => {
      const projectId = 'project-1'
      const color = '#FF0000'
      const mockProject = { id: projectId, color: '#FF0000' }

      mockTaskStore.updateProjectWithUndo.mockResolvedValue(mockProject)

      const result = await projectService.setProjectColor(projectId, color)

      expect(mockTaskStore.updateProjectWithUndo).toHaveBeenCalledWith(projectId, {
        color,
        colorType: 'color'
      })
      expect(result).toEqual(mockProject)
    })

    it('should set project color with custom color type', async () => {
      const projectId = 'project-1'
      const color = '#FF0000'
      const colorType = 'hex' as const
      const mockProject = { id: projectId, color: '#FF0000' }

      mockTaskStore.updateProjectWithUndo.mockResolvedValue(mockProject)

      const result = await projectService.setProjectColor(projectId, color, colorType)

      expect(mockTaskStore.updateProjectWithUndo).toHaveBeenCalledWith(projectId, {
        color,
        colorType: 'hex'
      })
      expect(result).toEqual(mockProject)
    })
  })

  describe('setProjectViewType', () => {
    it('should set project view type', async () => {
      const projectId = 'project-1'
      const viewType = 'kanban' as const
      const mockProject = { id: projectId, viewType: 'kanban' }

      mockTaskStore.updateProjectWithUndo.mockResolvedValue(mockProject)

      const result = await projectService.setProjectViewType(projectId, viewType)

      expect(mockTaskStore.updateProjectWithUndo).toHaveBeenCalledWith(projectId, {
        viewType: 'kanban'
      })
      expect(result).toEqual(mockProject)
    })
  })

  describe('moveProject', () => {
    it('should move project to new parent', async () => {
      const projectId = 'project-1'
      const newParentId = 'project-2'
      const mockProject = { id: projectId, parentId: newParentId }

      mockTaskStore.updateProjectWithUndo.mockResolvedValue(mockProject)
      mockTaskStore.isDescendantOf.mockReturnValue(false)

      const result = await projectService.moveProject(projectId, newParentId)

      expect(mockTaskStore.isDescendantOf).toHaveBeenCalledWith(newParentId, projectId)
      expect(mockTaskStore.updateProjectWithUndo).toHaveBeenCalledWith(projectId, {
        parentId: newParentId
      })
      expect(result).toEqual(mockProject)
    })

    it('should move project to root (null parent)', async () => {
      const projectId = 'project-1'
      const newParentId = null
      const mockProject = { id: projectId, parentId: null }

      mockTaskStore.updateProjectWithUndo.mockResolvedValue(mockProject)

      const result = await projectService.moveProject(projectId, newParentId)

      expect(mockTaskStore.updateProjectWithUndo).toHaveBeenCalledWith(projectId, {
        parentId: null
      })
      expect(result).toEqual(mockProject)
    })

    it('should prevent circular references', async () => {
      const projectId = 'project-1'
      const newParentId = 'project-2'

      mockTaskStore.isDescendantOf.mockReturnValue(true)

      await expect(projectService.moveProject(projectId, newParentId)).rejects.toThrow('Cannot move a project to be a descendant of itself')
      expect(mockTaskStore.updateProjectWithUndo).not.toHaveBeenCalled()
    })
  })

  describe('query operations', () => {
    it('should get project by ID', () => {
      const projectId = 'project-1'
      const mockProject = { id: projectId, name: 'Test Project' }

      mockTaskStore.getProjectById.mockReturnValue(mockProject)

      const result = projectService.getProjectById(projectId)

      expect(mockTaskStore.getProjectById).toHaveBeenCalledWith(projectId)
      expect(result).toEqual(mockProject)
    })

    it('should get all projects', () => {
      const result = projectService.getAllProjects()

      expect(result).toBe(mockTaskStore.projects)
      expect(result).toHaveLength(3)
    })

    it('should get default project ID', () => {
      const result = projectService.getDefaultProjectId()

      expect(mockTaskStore.getDefaultProjectId).toHaveBeenCalled()
      expect(result).toBe('1')
    })

    it('should get root projects', () => {
      const result = projectService.getRootProjects()

      expect(result).toEqual([
        mockTaskStore.projects[0], // My Tasks
        mockTaskStore.projects[1]  // Work Project
      ])
    })

    it('should get child projects', () => {
      const parentId = '2'
      const mockChildren = [mockTaskStore.projects[2]] // Sub Project

      mockTaskStore.getChildProjects.mockReturnValue(mockChildren)

      const result = projectService.getChildProjects(parentId)

      expect(mockTaskStore.getChildProjects).toHaveBeenCalledWith(parentId)
      expect(result).toEqual(mockChildren)
    })

    it('should get project task count', () => {
      const projectId = 'project-1'
      const taskCount = 5

      mockTaskStore.getProjectTaskCount.mockReturnValue(taskCount)

      const result = projectService.getProjectTaskCount(projectId)

      expect(mockTaskStore.getProjectTaskCount).toHaveBeenCalledWith(projectId)
      expect(result).toBe(taskCount)
    })

    it('should check if project is descendant of another', () => {
      const projectId = 'project-3'
      const ancestorId = 'project-1'

      mockTaskStore.isDescendantOf.mockReturnValue(true)

      const result = projectService.isDescendantOf(projectId, ancestorId)

      expect(mockTaskStore.isDescendantOf).toHaveBeenCalledWith(projectId, ancestorId)
      expect(result).toBe(true)
    })
  })

  describe('getProjectHierarchy', () => {
    it('should return flat hierarchy with level and path info', () => {
      mockTaskStore.getChildProjects.mockImplementation((parentId: string) => {
        if (parentId === '2') {
          return [mockTaskStore.projects[2]] // Sub Project under Work Project
        }
        return []
      })

      const result = projectService.getProjectHierarchy()

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        id: '1',
        name: 'My Tasks',
        level: 0,
        path: ['My Tasks']
      })
      expect(result[1]).toMatchObject({
        id: '2',
        name: 'Work Project',
        level: 0,
        path: ['Work Project']
      })
      expect(result[2]).toMatchObject({
        id: '3',
        name: 'Sub Project',
        level: 1,
        path: ['Work Project', 'Sub Project']
      })
    })
  })

  describe('ensureDefaultProject', () => {
    it('should return existing default project', async () => {
      const existingDefault = mockTaskStore.projects[0]

      const result = await projectService.ensureDefaultProject()

      expect(result).toBe(existingDefault)
      expect(mockTaskStore.createProjectWithUndo).not.toHaveBeenCalled()
    })

    it('should create default project if it does not exist', async () => {
      // Mock no existing default project
      mockTaskStore.projects = []

      const mockDefaultProject = {
        id: 'new-default',
        name: 'My Tasks',
        description: 'Default uncategorized tasks bucket',
        color: '#6B7280',
        viewType: 'status',
        parentId: null
      }

      mockTaskStore.createProjectWithUndo.mockResolvedValue(mockDefaultProject)

      const result = await projectService.ensureDefaultProject()

      expect(mockTaskStore.createProjectWithUndo).toHaveBeenCalledWith({
        name: 'My Tasks',
        description: 'Default uncategorized tasks bucket',
        color: '#6B7280',
        viewType: 'status',
        parentId: null
      })
      expect(result).toEqual(mockDefaultProject)
    })
  })

  describe('store access', () => {
    it('should provide direct access to the task store', () => {
      expect(projectService.store).toBe(mockTaskStore)
    })
  })
})

describe('Type guards', () => {
  describe('isValidProjectData', () => {
    it('should return true for valid project data', () => {
      const validData = {
        name: 'Test Project',
        description: 'Test Description'
      }

      const { isValidProjectData } = require('@/services/projectServiceSimple')
      expect(isValidProjectData(validData)).toBe(true)
    })

    it('should return false for invalid project data', () => {
      const invalidData = {
        name: '',
        description: 'Test Description'
      }

      const { isValidProjectData } = require('@/services/projectServiceSimple')
      expect(isValidProjectData(invalidData)).toBe(false)
    })

    it('should return false for non-object', () => {
      const { isValidProjectData } = require('@/services/projectServiceSimple')
      expect(isValidProjectData(null)).toBe(false)
      expect(isValidProjectData(undefined)).toBe(false)
      expect(isValidProjectData('string')).toBe(false)
    })
  })

  describe('isValidUpdateProjectData', () => {
    it('should return true for valid update data', () => {
      const validData = {
        id: 'project-1',
        name: 'Updated Project'
      }

      const { isValidUpdateProjectData } = require('@/services/projectServiceSimple')
      expect(isValidUpdateProjectData(validData)).toBe(true)
    })

    it('should return false for invalid update data', () => {
      const invalidData = {
        name: 'Updated Project'
      }

      const { isValidUpdateProjectData } = require('@/services/projectServiceSimple')
      expect(isValidUpdateProjectData(invalidData)).toBe(false)
    })

    it('should return false for empty ID', () => {
      const invalidData = {
        id: '',
        name: 'Updated Project'
      }

      const { isValidUpdateProjectData } = require('@/services/projectServiceSimple')
      expect(isValidUpdateProjectData(invalidData)).toBe(false)
    })
  })
})