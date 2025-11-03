/**
 * Simple Project Service - Direct Store Access Pattern
 *
 * This service provides a clean interface for project operations with DIRECT access
 * to Pinia stores for optimal performance and instant sync across all views.
 */

import { useTaskStore } from '@/stores/tasks'
import type { Project } from '@/stores/tasks'

export interface NewProjectData {
  name: string
  description?: string
  color?: string
  colorType?: Project['colorType']
  emoji?: string
  viewType?: Project['viewType']
  parentId?: string | null
}

export interface UpdateProjectData extends Partial<NewProjectData> {
  id: string
}

/**
 * Simple Project Service - Business logic with DIRECT store access
 *
 * Follows the two-layer architecture:
 * Layer 1: Direct Pinia Store (state + persistence)
 * Layer 2: Simple Service (business logic only)
 */
export function useProjectServiceSimple() {
  const taskStore = useTaskStore()

  /**
   * Create a new project with DIRECT store access
   * Updates store immediately = instant sync across all views
   */
  const createProject = async (projectData: NewProjectData): Promise<Project> => {
    try {
      // Validate required fields
      if (!projectData.name || projectData.name.trim().length === 0) {
        throw new Error('Project name is required')
      }

      // Use store's createProjectWithUndo method
      const project = await taskStore.createProjectWithUndo({
        name: projectData.name.trim(),
        description: projectData.description?.trim() || '',
        color: projectData.color || '#6B7280',
        colorType: projectData.colorType || 'color',
        emoji: projectData.emoji,
        viewType: projectData.viewType || 'status',
        parentId: projectData.parentId || null
      })

      console.log(`✅ SimpleProjectService: Created project "${project.name}" (ID: ${project.id})`)
      return project
    } catch (error) {
      console.error(`❌ SimpleProjectService: Failed to create project`, error)
      throw error
    }
  }

  /**
   * Update an existing project with DIRECT store access
   * Updates store immediately = instant sync across all views
   */
  const updateProject = async (updateData: UpdateProjectData): Promise<Project> => {
    try {
      const { id, ...updates } = updateData

      if (!id) {
        throw new Error('Project ID is required for updates')
      }

      // Clean the update data
      const cleanUpdates: Partial<Project> = {}
      if (updates.name !== undefined) {
        cleanUpdates.name = updates.name?.trim() || ''
      }
      if (updates.description !== undefined) {
        cleanUpdates.description = updates.description?.trim() || ''
      }
      if (updates.color !== undefined) {
        cleanUpdates.color = updates.color
      }
      if (updates.colorType !== undefined) {
        cleanUpdates.colorType = updates.colorType
      }
      if (updates.emoji !== undefined) {
        cleanUpdates.emoji = updates.emoji
      }
      if (updates.viewType !== undefined) {
        cleanUpdates.viewType = updates.viewType
      }
      if (updates.parentId !== undefined) {
        cleanUpdates.parentId = updates.parentId
      }

      // Add updatedAt timestamp
      cleanUpdates.updatedAt = new Date()

      // Use store's updateProjectWithUndo method
      const project = await taskStore.updateProjectWithUndo(id, cleanUpdates)

      console.log(`✅ SimpleProjectService: Updated project "${project.name}" (ID: ${id})`)
      return project
    } catch (error) {
      console.error(`❌ SimpleProjectService: Failed to update project (ID: ${updateData.id})`, error)
      throw error
    }
  }

  /**
   * Delete a project with DIRECT store access
   * Updates store immediately = instant sync across all views
   */
  const deleteProject = async (projectId: string): Promise<void> => {
    try {
      if (!projectId) {
        throw new Error('Project ID is required for deletion')
      }

      const project = taskStore.getProjectById(projectId)
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`)
      }

      // Don't allow deletion of the default "My Tasks" project
      if (projectId === '1' || project.name === 'My Tasks') {
        throw new Error('Cannot delete the default "My Tasks" project')
      }

      await taskStore.deleteProjectWithUndo(projectId)

      console.log(`✅ SimpleProjectService: Deleted project "${project.name}" (ID: ${projectId})`)
    } catch (error) {
      console.error(`❌ SimpleProjectService: Failed to delete project (ID: ${projectId})`, error)
      throw error
    }
  }

  /**
   * Set project color
   */
  const setProjectColor = async (
    projectId: string,
    color: string,
    colorType?: Project['colorType']
  ): Promise<Project> => {
    try {
      return await updateProject({
        id: projectId,
        color,
        colorType: colorType || 'color'
      })
    } catch (error) {
      console.error(`❌ SimpleProjectService: Failed to set project color`, error)
      throw error
    }
  }

  /**
   * Set project view type
   */
  const setProjectViewType = async (
    projectId: string,
    viewType: Project['viewType']
  ): Promise<Project> => {
    try {
      return await updateProject({
        id: projectId,
        viewType
      })
    } catch (error) {
      console.error(`❌ SimpleProjectService: Failed to set project view type`, error)
      throw error
    }
  }

  /**
   * Move project to different parent (for nested projects)
   */
  const moveProject = async (
    projectId: string,
    newParentId: string | null
  ): Promise<Project> => {
    try {
      // Prevent circular references
      if (newParentId && isDescendantOf(newParentId, projectId)) {
        throw new Error('Cannot move a project to be a descendant of itself')
      }

      return await updateProject({
        id: projectId,
        parentId: newParentId
      })
    } catch (error) {
      console.error(`❌ SimpleProjectService: Failed to move project`, error)
      throw error
    }
  }

  /**
   * Get project by ID (convenience method)
   */
  const getProjectById = (projectId: string): Project | undefined => {
    return taskStore.getProjectById(projectId)
  }

  /**
   * Get default project ID
   */
  const getDefaultProjectId = (): string => {
    return taskStore.getDefaultProjectId()
  }

  /**
   * Get all projects (convenience method)
   */
  const getAllProjects = (): Project[] => {
    return taskStore.projects
  }

  /**
   * Get root projects (projects with no parent)
   */
  const getRootProjects = (): Project[] => {
    return taskStore.projects.filter(project => !project.parentId)
  }

  /**
   * Get child projects of a parent project
   */
  const getChildProjects = (parentId: string): Project[] => {
    return taskStore.getChildProjects(parentId)
  }

  /**
   * Get project hierarchy (flattened list with nesting info)
   */
  const getProjectHierarchy = (): Array<Project & { level: number; path: string[] }> => {
    const result: Array<Project & { level: number; path: string[] }> = []
    const visited = new Set<string>()

    const traverse = (project: Project, level: number = 0, path: string[] = []): void => {
      if (visited.has(project.id)) {
        console.warn(`Circular reference detected in project hierarchy: ${project.id}`)
        return
      }

      visited.add(project.id)
      result.push({
        ...project,
        level,
        path: [...path, project.name]
      })

      // Process children
      const children = taskStore.getChildProjects(project.id)
      children.forEach(child => {
        traverse(child, level + 1, [...path, project.name])
      })

      visited.delete(project.id) // Allow reuse in other branches
    }

    // Start with root projects
    const rootProjects = getRootProjects()
    rootProjects.forEach(project => {
      traverse(project)
    })

    return result
  }

  /**
   * Get task count for a project
   */
  const getProjectTaskCount = (projectId: string): number => {
    return taskStore.getProjectTaskCount(projectId)
  }

  /**
   * Check if a project is a descendant of another project
   */
  const isDescendantOf = (projectId: string, ancestorId: string): boolean => {
    return taskStore.isDescendantOf(projectId, ancestorId)
  }

  /**
   * Create a default "My Tasks" project if it doesn't exist
   */
  const ensureDefaultProject = async (): Promise<Project> => {
    const existingDefault = taskStore.projects.find(p => p.id === '1' || p.name === 'My Tasks')

    if (existingDefault) {
      return existingDefault
    }

    // Create default project
    return await createProject({
      name: 'My Tasks',
      description: 'Default uncategorized tasks bucket',
      color: '#6B7280',
      colorType: 'color',
      viewType: 'status',
      parentId: null
    })
  }

  return {
    // Core CRUD operations (DIRECT store access)
    createProject,
    updateProject,
    deleteProject,

    // Convenience operations
    setProjectColor,
    setProjectViewType,
    moveProject,

    // Query operations
    getProjectById,
    getAllProjects,
    getRootProjects,
    getChildProjects,
    getProjectHierarchy,
    getProjectTaskCount,
    getDefaultProjectId,

    // Utility operations
    isDescendantOf,
    ensureDefaultProject,

    // Direct store access for reading (components should use computed properties)
    store: taskStore
  }
}

/**
 * Type guards for validation
 */
export const isValidProjectData = (data: any): data is NewProjectData => {
  return (
    typeof data === 'object' &&
    typeof data.name === 'string' &&
    data.name.trim().length > 0
  )
}

export const isValidUpdateProjectData = (data: any): data is UpdateProjectData => {
  return (
    typeof data === 'object' &&
    typeof data.id === 'string' &&
    data.id.trim().length > 0
  )
}