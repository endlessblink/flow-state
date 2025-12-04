// Task Canvas Store - Canvas-specific functionality
// Extracted from tasks.ts for better maintainability

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useTaskCoreStore, type Task } from './taskCore'

export interface CanvasSection {
  id: string
  title: string
  type: 'priority' | 'status' | 'project' | 'custom'
  position: { x: number; y: number }
  size: { width: number; height: number }
  collapsed: boolean
  collapsedHeight?: number
  filter?: {
    priority?: Task['priority']
    status?: Task['status']
    projectId?: string
    custom?: string
  }
  color?: string
}

export interface ViewportState {
  x: number
  y: number
  zoom: number
}

export const useTaskCanvasStore = defineStore('taskCanvas', () => {
  const coreStore = useTaskCoreStore()

  // State
  const sections = ref<CanvasSection[]>([])
  const selectedTasks = ref<string[]>([])
  const isMultiSelectMode = ref(false)
  const selectionStart = ref<{ x: number; y: number } | null>(null)
  const selectionEnd = ref<{ x: number; y: number } | null>(null)
  const viewport = ref<ViewportState>({ x: 0, y: 0, zoom: 1 })
  const canvasSize = ref({ width: 2000, height: 2000 })
  const showGrid = ref(true)
  const snapToGrid = ref(true)
  const gridSize = ref(20)

  // Computed properties
  const allTasks = computed(() => coreStore.allTasks)
  const canvasTasks = computed(() =>
    allTasks.value.filter(task => task.canvasPosition)
  )
  const inboxTasks = computed(() =>
    allTasks.value.filter(task => task.isInInbox)
  )

  // Section operations
  const createSection = (sectionData: Partial<CanvasSection>): CanvasSection => {
    const section: CanvasSection = {
      id: `section-${Date.now()}`,
      title: sectionData.title || 'New Section',
      type: sectionData.type || 'custom',
      position: sectionData.position || { x: 100, y: 100 },
      size: sectionData.size || { width: 300, height: 400 },
      collapsed: sectionData.collapsed || false,
      filter: sectionData.filter,
      color: sectionData.color
    }

    sections.value.push(section)
    return section
  }

  const updateSection = (sectionId: string, updates: Partial<CanvasSection>): boolean => {
    const sectionIndex = sections.value.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) {
      console.warn(`Section with id ${sectionId} not found`)
      return false
    }

    sections.value[sectionIndex] = {
      ...sections.value[sectionIndex],
      ...updates
    }

    return true
  }

  const deleteSection = (sectionId: string): boolean => {
    const sectionIndex = sections.value.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) {
      console.warn(`Section with id ${sectionId} not found`)
      return false
    }

    sections.value.splice(sectionIndex, 1)
    return true
  }

  const getSection = (sectionId: string): CanvasSection | undefined => {
    return sections.value.find(s => s.id === sectionId)
  }

  const toggleSectionCollapsed = (sectionId: string): boolean => {
    const section = getSection(sectionId)
    if (!section) return false

    // Store current height before collapsing
    if (!section.collapsed) {
      updateSection(sectionId, {
        collapsed: true,
        collapsedHeight: section.size.height
      })
    } else {
      // Restore previous height
      updateSection(sectionId, {
        collapsed: false,
        size: {
          ...section.size,
          height: section.collapsedHeight || 400
        }
      })
    }

    return true
  }

  // Task canvas operations
  const positionTask = (taskId: string, x: number, y: number): boolean => {
    const task = coreStore.getTask(taskId)
    if (!task) return false

    // Apply grid snapping if enabled
    let finalX = x
    let finalY = y
    if (snapToGrid.value) {
      finalX = Math.round(x / gridSize.value) * gridSize.value
      finalY = Math.round(y / gridSize.value) * gridSize.value
    }

    return coreStore.updateTask(taskId, {
      canvasPosition: { x: finalX, y: finalY },
      isInInbox: false
    })
  }

  const moveTaskByOffset = (taskId: string, dx: number, dy: number): boolean => {
    const task = coreStore.getTask(taskId)
    if (!task || !task.canvasPosition) return false

    const newX = task.canvasPosition.x + dx
    const newY = task.canvasPosition.y + dy

    return positionTask(taskId, newX, newY)
  }

  const addTaskToInbox = (taskId: string): boolean => {
    const task = coreStore.getTask(taskId)
    if (!task) return false

    return coreStore.updateTask(taskId, {
      isInInbox: true,
      canvasPosition: undefined
    })
  }

  const removeTaskFromCanvas = (taskId: string): boolean => {
    return addTaskToInbox(taskId)
  }

  // Section filtering
  const getTasksForSection = (section: CanvasSection): Task[] => {
    if (!section.filter) return []

    return allTasks.value.filter(task => {
      if (section.filter!.priority && task.priority !== section.filter!.priority) {
        return false
      }
      if (section.filter!.status && task.status !== section.filter!.status) {
        return false
      }
      if (section.filter!.projectId && task.projectId !== section.filter!.projectId) {
        return false
      }
      if (section.filter!.custom) {
        // Custom filter logic could be implemented here
        return task.title.toLowerCase().includes(section.filter!.custom.toLowerCase())
      }
      return true
    })
  }

  const createPrioritySections = (): void => {
    // Clear existing priority sections
    sections.value = sections.value.filter(s => s.type !== 'priority')

    const priorities: Array<Task['priority']> = ['high', 'medium', 'low', null]
    const colors = {
      high: '#EF4444',
      medium: '#F59E0B',
      low: '#10B981',
      null: '#6B7280'
    }

    priorities.forEach((priority, index) => {
      createSection({
        title: priority ? `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority` : 'No Priority',
        type: 'priority',
        position: { x: 100 + (index * 350), y: 100 },
        size: { width: 300, height: 400 },
        filter: { priority },
        color: colors[priority!]
      })
    })
  }

  const createStatusSections = (): void => {
    // Clear existing status sections
    sections.value = sections.value.filter(s => s.type !== 'status')

    const statuses: Array<Task['status']> = ['planned', 'in_progress', 'done', 'backlog', 'on_hold']
    const colors = {
      planned: '#3B82F6',
      'in_progress': '#F59E0B',
      done: '#10B981',
      backlog: '#6B7280',
      'on_hold': '#EF4444'
    }

    statuses.forEach((status, index) => {
      createSection({
        title: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type: 'status',
        position: { x: 100 + (index * 350), y: 100 },
        size: { width: 300, height: 400 },
        filter: { status },
        color: colors[status]
      })
    })
  }

  const createProjectSections = (): void => {
    // Clear existing project sections
    sections.value = sections.value.filter(s => s.type !== 'project')

    const projects = coreStore.allProjects
    projects.forEach((project, index) => {
      createSection({
        title: project.name,
        type: 'project',
        position: { x: 100 + (index * 350), y: 100 },
        size: { width: 300, height: 400 },
        filter: { projectId: project.id },
        color: Array.isArray(project.color) ? project.color[0] : project.color
      })
    })
  }

  // Selection operations
  const selectTask = (taskId: string, multiSelect = false): void => {
    if (!multiSelect) {
      selectedTasks.value = [taskId]
    } else {
      if (!selectedTasks.value.includes(taskId)) {
        selectedTasks.value.push(taskId)
      }
    }
  }

  const deselectTask = (taskId: string): void => {
    const index = selectedTasks.value.indexOf(taskId)
    if (index > -1) {
      selectedTasks.value.splice(index, 1)
    }
  }

  const toggleTaskSelection = (taskId: string): void => {
    const index = selectedTasks.value.indexOf(taskId)
    if (index > -1) {
      selectedTasks.value.splice(index, 1)
    } else {
      selectedTasks.value.push(taskId)
    }
  }

  const selectAllTasks = (): void => {
    selectedTasks.value = canvasTasks.value.map(task => task.id)
  }

  const clearSelection = (): void => {
    selectedTasks.value = []
    isMultiSelectMode.value = false
    selectionStart.value = null
    selectionEnd.value = null
  }

  const getSelectedTasks = computed(() =>
    canvasTasks.value.filter(task => selectedTasks.value.includes(task.id))
  )

  // Multi-selection operations
  const startMultiSelect = (x: number, y: number): void => {
    isMultiSelectMode.value = true
    selectionStart.value = { x, y }
    selectionEnd.value = { x, y }
  }

  const updateMultiSelect = (x: number, y: number): void => {
    if (isMultiSelectMode.value && selectionStart.value) {
      selectionEnd.value = { x, y }

      // Find tasks within selection rectangle
      const minX = Math.min(selectionStart.value.x, x)
      const maxX = Math.max(selectionStart.value.x, x)
      const minY = Math.min(selectionStart.value.y, y)
      const maxY = Math.max(selectionStart.value.y, y)

      const tasksInSelection = canvasTasks.value.filter(task => {
        if (!task.canvasPosition) return false
        const pos = task.canvasPosition
        return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY
      })

      selectedTasks.value = tasksInSelection.map(task => task.id)
    }
  }

  const endMultiSelect = (): void => {
    isMultiSelectMode.value = false
    selectionStart.value = null
    selectionEnd.value = null
  }

  // Viewport operations
  const setViewport = (x: number, y: number, zoom: number): void => {
    viewport.value = { x, y, zoom }
  }

  const panViewport = (dx: number, dy: number): void => {
    viewport.value.x += dx
    viewport.value.y += dy
  }

  const zoomViewport = (factor: number, centerX?: number, centerY?: number): void => {
    const newZoom = Math.max(0.1, Math.min(3, viewport.value.zoom * factor))

    if (centerX !== undefined && centerY !== undefined) {
      // Zoom towards the center point
      const scaleChange = newZoom - viewport.value.zoom
      viewport.value.x -= centerX * scaleChange
      viewport.value.y -= centerY * scaleChange
    }

    viewport.value.zoom = newZoom
  }

  const resetViewport = (): void => {
    viewport.value = { x: 0, y: 0, zoom: 1 }
  }

  // Canvas utilities
  const fitToScreen = (): void => {
    if (canvasTasks.value.length === 0) {
      resetViewport()
      return
    }

    const padding = 50
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    canvasTasks.value.forEach(task => {
      if (task.canvasPosition) {
        minX = Math.min(minX, task.canvasPosition.x)
        minY = Math.min(minY, task.canvasPosition.y)
        maxX = Math.max(maxX, task.canvasPosition.x)
        maxY = Math.max(maxY, task.canvasPosition.y)
      }
    })

    const contentWidth = maxX - minX + 200
    const contentHeight = maxY - minY + 200

    const scaleX = (canvasSize.value.width - padding * 2) / contentWidth
    const scaleY = (canvasSize.value.height - padding * 2) / contentHeight
    const scale = Math.min(scaleX, scaleY, 1)

    viewport.value = {
      x: -(minX - 100) * scale,
      y: -(minY - 100) * scale,
      zoom: scale
    }
  }

  const autoArrange = (): void => {
    const gridCols = Math.ceil(Math.sqrt(canvasTasks.value.length))
    const gridRows = Math.ceil(canvasTasks.value.length / gridCols)
    const cellWidth = 250
    const cellHeight = 100
    const spacing = 50

    canvasTasks.value.forEach((task, index) => {
      const col = index % gridCols
      const row = Math.floor(index / gridCols)
      const x = 100 + col * (cellWidth + spacing)
      const y = 100 + row * (cellHeight + spacing)

      positionTask(task.id, x, y)
    })
  }

  // Batch operations
  const deleteSelectedTasks = (): number => {
    let deletedCount = 0
    selectedTasks.value.forEach(taskId => {
      if (coreStore.deleteTask(taskId)) {
        deletedCount++
      }
    })
    clearSelection()
    return deletedCount
  }

  const moveSelectedTasksToProject = (projectId: string): number => {
    let updatedCount = 0
    selectedTasks.value.forEach(taskId => {
      if (coreStore.updateTask(taskId, { projectId })) {
        updatedCount++
      }
    })
    return updatedCount
  }

  return {
    // State
    sections,
    selectedTasks,
    isMultiSelectMode,
    selectionStart,
    selectionEnd,
    viewport,
    canvasSize,
    showGrid,
    snapToGrid,
    gridSize,

    // Computed
    allTasks,
    canvasTasks,
    inboxTasks,
    getSelectedTasks,

    // Section operations
    createSection,
    updateSection,
    deleteSection,
    getSection,
    toggleSectionCollapsed,
    getTasksForSection,
    createPrioritySections,
    createStatusSections,
    createProjectSections,

    // Task canvas operations
    positionTask,
    moveTaskByOffset,
    addTaskToInbox,
    removeTaskFromCanvas,

    // Selection operations
    selectTask,
    deselectTask,
    toggleTaskSelection,
    selectAllTasks,
    clearSelection,
    startMultiSelect,
    updateMultiSelect,
    endMultiSelect,

    // Viewport operations
    setViewport,
    panViewport,
    zoomViewport,
    resetViewport,
    fitToScreen,
    autoArrange,

    // Batch operations
    deleteSelectedTasks,
    moveSelectedTasksToProject
  }
})