/**
 * Simple Canvas Service - Direct Store Access Pattern
 *
 * This service provides a clean interface for canvas operations with DIRECT access
 * to Pinia stores for optimal performance and instant sync across all views.
 */

import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import type { Task } from '@/stores/tasks'

export interface CanvasPosition {
  x: number
  y: number
}

export interface NewSectionData {
  type: 'priority' | 'status' | 'project' | 'custom'
  value: string
  position: CanvasPosition
  title?: string
}

export interface UpdateSectionData extends Partial<NewSectionData> {
  id: string
}

export interface TaskPositionUpdate {
  taskId: string
  position: CanvasPosition
}

export interface MultiTaskUpdate {
  taskIds: string[]
  updates: Partial<Task>
}

/**
 * Simple Canvas Service - Business logic with DIRECT store access
 *
 * Follows the two-layer architecture:
 * Layer 1: Direct Pinia Store (state + persistence)
 * Layer 2: Simple Service (business logic only)
 */
export function useCanvasServiceSimple() {
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()

  /**
   * Position a task on the canvas
   * Moves task from inbox to canvas with DIRECT store access
   */
  const positionTaskOnCanvas = async (taskId: string, position: CanvasPosition): Promise<void> => {
    try {
      const task = taskStore.getTaskById(taskId)
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`)
      }

      // Update task with canvas position and mark as not in inbox
      await taskStore.updateTaskWithUndo(taskId, {
        canvasPosition: position,
        isInInbox: false
      })

      console.log(`✅ SimpleCanvasService: Positioned task "${task.title}" at (${position.x}, ${position.y})`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to position task on canvas`, error)
      throw error
    }
  }

  /**
   * Move task to new position
   */
  const moveTaskOnCanvas = async (taskId: string, position: CanvasPosition): Promise<void> => {
    try {
      const task = taskStore.getTaskById(taskId)
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`)
      }

      // Update only the canvas position
      await taskStore.updateTaskWithUndo(taskId, {
        canvasPosition: position
      })

      console.log(`✅ SimpleCanvasService: Moved task "${task.title}" to (${position.x}, ${position.y})`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to move task on canvas`, error)
      throw error
    }
  }

  /**
   * Move task back to inbox
   */
  const moveTaskToInbox = async (taskId: string): Promise<void> => {
    try {
      const task = taskStore.getTaskById(taskId)
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`)
      }

      // Remove from canvas and mark as in inbox
      await taskStore.updateTaskWithUndo(taskId, {
        canvasPosition: undefined,
        isInInbox: true
      })

      console.log(`✅ SimpleCanvasService: Moved task "${task.title}" back to inbox`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to move task to inbox`, error)
      throw error
    }
  }

  /**
   * Bulk position multiple tasks
   */
  const positionMultipleTasks = async (updates: TaskPositionUpdate[]): Promise<void> => {
    try {
      for (const update of updates) {
        await positionTaskOnCanvas(update.taskId, update.position)
      }

      console.log(`✅ SimpleCanvasService: Positioned ${updates.length} tasks on canvas`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to position multiple tasks`, error)
      throw error
    }
  }

  /**
   * Create a new canvas section
   */
  const createCanvasSection = async (sectionData: NewSectionData): Promise<void> => {
    try {
      await canvasStore.createSectionWithUndo(sectionData)

      console.log(`✅ SimpleCanvasService: Created ${sectionData.type} section for "${sectionData.value}"`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to create canvas section`, error)
      throw error
    }
  }

  /**
   * Update a canvas section
   */
  const updateCanvasSection = async (updateData: UpdateSectionData): Promise<void> => {
    try {
      const { id, ...updates } = updateData

      await canvasStore.updateSectionWithUndo(id, updates)

      console.log(`✅ SimpleCanvasService: Updated canvas section ${id}`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to update canvas section`, error)
      throw error
    }
  }

  /**
   * Delete a canvas section
   */
  const deleteCanvasSection = async (sectionId: string): Promise<void> => {
    try {
      await canvasStore.deleteSectionWithUndo(sectionId)

      console.log(`✅ SimpleCanvasService: Deleted canvas section ${sectionId}`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to delete canvas section`, error)
      throw error
    }
  }

  /**
   * Get tasks in a specific section
   */
  const getTasksInSection = (sectionId: string): Task[] => {
    return canvasStore.getTasksInSection(sectionId)
  }

  /**
   * Check if a task belongs to a section (logically)
   */
  const isTaskInSection = (task: Task, sectionId: string): boolean => {
    return canvasStore.isTaskInSection(task, sectionId)
  }

  /**
   * Find the nearest section to a position
   */
  const findNearestSection = (position: CanvasPosition): string | null => {
    return canvasStore.findNearestSection(position)
  }

  /**
   * Get magnetic snap position for a task
   */
  const getMagneticSnapPosition = (position: CanvasPosition, taskId?: string): CanvasPosition => {
    return canvasStore.getMagneticSnapPosition(position, taskId)
  }

  /**
   * Toggle section visibility
   */
  const toggleSectionVisibility = async (sectionId: string): Promise<void> => {
    try {
      await canvasStore.toggleSectionVisibilityWithUndo(sectionId)

      console.log(`✅ SimpleCanvasService: Toggled visibility for section ${sectionId}`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to toggle section visibility`, error)
      throw error
    }
  }

  /**
   * Toggle section collapse state
   */
  const toggleSectionCollapse = async (sectionId: string): Promise<void> => {
    try {
      await canvasStore.toggleSectionCollapseWithUndo(sectionId)

      console.log(`✅ SimpleCanvasService: Toggled collapse state for section ${sectionId}`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to toggle section collapse`, error)
      throw error
    }
  }

  /**
   * Set active section
   */
  const setActiveSection = (sectionId: string | null): void => {
    canvasStore.setActiveSection(sectionId)
  }

  /**
   * Get canvas bounds for all content
   */
  const getCanvasBounds = () => {
    return canvasStore.calculateContentBounds()
  }

  /**
   * Get minimum zoom level for canvas
   */
  const getMinZoom = (): number => {
    return canvasStore.calculateDynamicMinZoom()
  }

  /**
   * Clear canvas (remove all task positions)
   */
  const clearCanvas = async (): Promise<void> => {
    try {
      const positionedTasks = taskStore.tasks.filter(task => task.canvasPosition && !task.isInInbox)

      for (const task of positionedTasks) {
        await moveTaskToInbox(task.id)
      }

      console.log(`✅ SimpleCanvasService: Cleared canvas (${positionedTasks.length} tasks moved to inbox)`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to clear canvas`, error)
      throw error
    }
  }

  /**
   * Auto-organize tasks on canvas
   */
  const autoOrganizeCanvas = async (): Promise<void> => {
    try {
      const inboxTasks = taskStore.tasks.filter(task => task.isInInbox)
      const gridSize = 200 // pixels between tasks
      const startX = 100
      const startY = 100

      const updates: TaskPositionUpdate[] = inboxTasks.map((task, index) => {
        const row = Math.floor(index / 5)
        const col = index % 5

        return {
          taskId: task.id,
          position: {
            x: startX + col * gridSize,
            y: startY + row * gridSize
          }
        }
      })

      await positionMultipleTasks(updates)

      console.log(`✅ SimpleCanvasService: Auto-organized ${inboxTasks.length} tasks on canvas`)
    } catch (error) {
      console.error(`❌ SimpleCanvasService: Failed to auto-organize canvas`, error)
      throw error
    }
  }

  /**
   * Create priority section
   */
  const createPrioritySection = async (priority: string, position: CanvasPosition): Promise<void> => {
    return await createCanvasSection({
      type: 'priority',
      value: priority,
      position,
      title: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`
    })
  }

  /**
   * Create status section
   */
  const createStatusSection = async (status: string, position: CanvasPosition): Promise<void> => {
    return await createCanvasSection({
      type: 'status',
      value: status,
      position,
      title: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    })
  }

  /**
   * Create project section
   */
  const createProjectSection = async (projectId: string, position: CanvasPosition): Promise<void> => {
    const project = taskStore.getProjectById(projectId)
    const title = project?.name || 'Unknown Project'

    return await createCanvasSection({
      type: 'project',
      value: projectId,
      position,
      title
    })
  }

  /**
   * Get canvas statistics
   */
  const getCanvasStatistics = () => {
    const tasks = taskStore.tasks
    const sections = canvasStore.sections

    return {
      totalTasks: tasks.length,
      positionedTasks: tasks.filter(task => task.canvasPosition && !task.isInInbox).length,
      inboxTasks: tasks.filter(task => task.isInInbox).length,
      totalSections: sections.length,
      visibleSections: sections.filter(section => section.isVisible).length,
      collapsedSections: sections.filter(section => section.isCollapsed).length
    }
  }

  return {
    // Task positioning operations
    positionTaskOnCanvas,
    moveTaskOnCanvas,
    moveTaskToInbox,
    positionMultipleTasks,
    autoOrganizeCanvas,
    clearCanvas,

    // Section operations
    createCanvasSection,
    updateCanvasSection,
    deleteCanvasSection,
    toggleSectionVisibility,
    toggleSectionCollapse,
    setActiveSection,

    // Convenience section creators
    createPrioritySection,
    createStatusSection,
    createProjectSection,

    // Query operations
    getTasksInSection,
    isTaskInSection,
    findNearestSection,
    getMagneticSnapPosition,
    getCanvasBounds,
    getMinZoom,
    getCanvasStatistics,

    // Direct store access for reading (components should use computed properties)
    taskStore,
    canvasStore
  }
}