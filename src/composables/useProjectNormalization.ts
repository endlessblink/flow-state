import { computed } from 'vue'
import type { Task, Project } from '@/stores/tasks'
import { useUncategorizedTasks } from './useUncategorizedTasks'

/**
 * Type definitions for project normalization
 */
export interface ProjectDisplayInfo {
  id: string | null
  name: string
  color?: string
  taskCount: number
  isActive: boolean
  hasUnknownTasks: boolean
}

export interface ProjectTaskSummary {
  projectId: string | null
  projectName: string
  totalTasks: number
  activeTasks: number
  completedTasks: number
  percentageCompleted: number
}

/**
 * Composable for consistent project display name resolution and task counting
 * across all views and components. Works in tandem with useUncategorizedTasks.
 */
export function useProjectNormalization() {
  const {
    UNCATEGORIZED_PROJECT_NAME,
    getProjectAssociation,
    calculateProjectStats,
    isTaskUncategorized
  } = useUncategorizedTasks()

  /**
   * Resolves project display name with fallback logic
   * @param projectId Project ID to resolve
   * @param projects Array of available projects
   * @returns Normalized project display name
   */
  function getProjectDisplayName(projectId: string | null, projects: Project[]): string {
    if (!projectId) {
      return UNCATEGORIZED_PROJECT_NAME
    }

    const project = projects.find(p => p.id === projectId)
    return project?.name || UNCATEGORIZED_PROJECT_NAME
  }

  /**
   * Gets comprehensive project display information for UI components
   * @param projectId Project ID to analyze
   * @param projects Array of available projects
   * @param tasks Array of tasks to count
   * @returns Complete project display information
   */
  function getProjectDisplayInfo(
    projectId: string | null,
    projects: Project[],
    tasks: Task[]
  ): ProjectDisplayInfo {
    const project = projectId ? projects.find(p => p.id === projectId) : null
    const projectTasks = tasks.filter(task => {
      const association = getProjectAssociation(task, projects)
      return association.projectId === projectId
    })

    return {
      id: projectId,
      name: project?.name || UNCATEGORIZED_PROJECT_NAME,
      color: project?.color,
      taskCount: projectTasks.length,
      isActive: !!project,
      hasUnknownTasks: projectId === null || projectTasks.some(task => isTaskUncategorized(task))
    }
  }

  /**
   * Creates a unique project key for caching and optimization
   * @param projectId Project ID
   * @param projectName Project name
   * @returns Unique cache key
   */
  function getProjectCacheKey(projectId: string | null, projectName: string): string {
    return `${projectId || 'null'}_${projectName.replace(/\s+/g, '_').toLowerCase()}`
  }

  /**
   * Normalizes project data for consistent display across components
   * @param projects Array of projects to normalize
   * @param tasks Array of tasks for counting
   * @returns Normalized project array with consistent metadata
   */
  function normalizeProjectsForDisplay(projects: Project[], tasks: Task[]): ProjectDisplayInfo[] {
    const normalizedProjects = projects.map(project =>
      getProjectDisplayInfo(project.id, projects, tasks)
    )

    // Add "Unknown Project" if there are uncategorized tasks
    const stats = calculateProjectStats(tasks)
    if (stats.uncategorizedTasks > 0) {
      normalizedProjects.unshift({
        id: null,
        name: UNCATEGORIZED_PROJECT_NAME,
        taskCount: stats.uncategorizedTasks,
        isActive: false,
        hasUnknownTasks: true
      })
    }

    return normalizedProjects.sort((a, b) => {
      // Sort by task count (descending), then by name
      if (b.taskCount !== a.taskCount) {
        return b.taskCount - a.taskCount
      }
      return a.name.localeCompare(b.name)
    })
  }

  /**
   * Gets task summary for a specific project
   * @param projectId Project ID to analyze
   * @param projects Array of available projects
   * @param tasks Array of tasks to analyze
   * @returns Project task summary
   */
  function getProjectTaskSummary(
    projectId: string | null,
    projects: Project[],
    tasks: Task[]
  ): ProjectTaskSummary {
    const projectTasks = tasks.filter(task => {
      const association = getProjectAssociation(task, projects)
      return association.projectId === projectId
    })

    const completedTasks = projectTasks.filter(task => task.status === 'done').length
    const activeTasks = projectTasks.length - completedTasks
    const percentageCompleted = projectTasks.length > 0
      ? (completedTasks / projectTasks.length) * 100
      : 0

    return {
      projectId,
      projectName: getProjectDisplayName(projectId, projects),
      totalTasks: projectTasks.length,
      activeTasks,
      completedTasks,
      percentageCompleted
    }
  }

  /**
   * Validates project data integrity
   * @param projects Array of projects to validate
   * @param tasks Array of tasks to check for orphaned references
   * @returns Validation result with issues
   */
  function validateProjectData(projects: Project[], tasks: Task[]): {
    isValid: boolean
    issues: string[]
    orphanedTaskCount: number
    duplicateProjectCount: number
  } {
    const issues: string[] = []
    const projectIds = new Set(projects.map(p => p.id))
    const duplicateNames = new Map<string, number>()

    // Check for duplicate project names
    projects.forEach(project => {
      const normalizedName = project.name.toLowerCase().trim()
      const count = duplicateNames.get(normalizedName) || 0
      duplicateNames.set(normalizedName, count + 1)
    })

    duplicateNames.forEach((count, name) => {
      if (count > 1) {
        issues.push(`Duplicate project name: "${name}" (${count} occurrences)`)
      }
    })

    // Check for orphaned task references
    let orphanedTaskCount = 0
    tasks.forEach(task => {
      if (task.projectId && !projectIds.has(task.projectId)) {
        orphanedTaskCount++
      }
    })

    if (orphanedTaskCount > 0) {
      issues.push(`${orphanedTaskCount} tasks reference non-existent projects`)
    }

    return {
      isValid: issues.length === 0,
      issues,
      orphanedTaskCount,
      duplicateProjectCount: Array.from(duplicateNames.values()).filter(count => count > 1).length
    }
  }

  /**
   * Groups tasks by project with normalized project information
   * @param tasks Array of tasks to group
   * @param projects Array of available projects
   * @returns Tasks grouped by project
   */
  function groupTasksByProject(tasks: Task[], projects: Project[]): Map<string | null, Task[]> {
    const projectGroups = new Map<string | null, Task[]>()

    // Initialize groups for all projects
    projects.forEach(project => {
      projectGroups.set(project.id, [])
    })

    // Add group for uncategorized tasks
    projectGroups.set(null, [])

    tasks.forEach(task => {
      const association = getProjectAssociation(task, projects)
      const targetProjectId = association.projectId

      if (!projectGroups.has(targetProjectId)) {
        projectGroups.set(targetProjectId, [])
      }

      projectGroups.get(targetProjectId)!.push(task)
    })

    return projectGroups
  }

  /**
   * Filters tasks to show only those belonging to specified project or uncategorized
   * @param tasks Array of tasks to filter
   * @param targetProjectId Target project ID (null for uncategorized)
   * @param projects Array of available projects
   * @returns Filtered tasks array
   */
  function filterTasksByProject(
    tasks: Task[],
    targetProjectId: string | null,
    projects: Project[]
  ): Task[] {
    return tasks.filter(task => {
      const association = getProjectAssociation(task, projects)
      return association.projectId === targetProjectId
    })
  }

  /**
   * Creates a computed property that automatically updates project counts
   * @param tasks Reactive tasks array
   * @param projects Reactive projects array
   * @returns Computed project display info with counts
   */
  function createProjectCountsComputed(
    tasks: () => Task[],
    projects: () => Project[]
  ) {
    return computed(() => {
      return normalizeProjectsForDisplay(projects(), tasks())
    })
  }

  return {
    // Core display functions
    getProjectDisplayName,
    getProjectDisplayInfo,
    normalizeProjectsForDisplay,

    // Analysis functions
    getProjectTaskSummary,
    groupTasksByProject,
    filterTasksByProject,

    // Utility functions
    getProjectCacheKey,
    validateProjectData,
    createProjectCountsComputed,

    // Constants from useUncategorizedTasks
    UNCATEGORIZED_PROJECT_NAME
  }
}