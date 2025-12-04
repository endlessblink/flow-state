import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import type { Task } from './tasks'
import { isSmartGroup, getSmartGroupType, getSmartGroupDate, type SmartGroupType } from '@/composables/useTaskSmartGroups'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

// Task store import for safe sync functionality
let taskStore: any = null

export interface SectionFilter {
  priorities?: ('low' | 'medium' | 'high')[]
  statuses?: Task['status'][]
  projects?: string[]
  tags?: string[]
  dateRange?: { start: Date; end: Date }
}

export interface TaskPosition {
  id: string
  position: { x: number; y: number }
  relativePosition: { x: number; y: number }
}

/**
 * Canvas container for organizing tasks.
 *
 * **Terminology**:
 * - **Groups** (`type: 'custom'`): Visual organization only, no property updates
 * - **Sections** (`type: 'priority'|'status'|'timeline'|'project'`): Smart automation, auto-updates task properties
 *
 * When a task is dragged into a Section, its properties (priority, status, dueDate, etc.)
 * are automatically updated based on the section's type and propertyValue.
 * Groups do not modify task properties.
 */
export interface CanvasSection {
  id: string
  name: string
  type: 'priority' | 'status' | 'timeline' | 'custom' | 'project'
  position: { x: number; y: number; width: number; height: number }
  color: string
  filters?: SectionFilter
  layout: 'vertical' | 'horizontal' | 'grid' | 'freeform'
  isVisible: boolean
  isCollapsed: boolean
  propertyValue?: string | 'high' | 'medium' | 'low' | 'planned' | 'in_progress' | 'done' | 'backlog'
  autoCollect?: boolean // Auto-collect matching tasks from inbox
  collapsedHeight?: number // Store height when collapsed to restore on expand
}

export interface CanvasState {
  viewport: {
    x: number
    y: number
    zoom: number
  }
  selectedNodeIds: string[]
  connectMode: boolean
  connectingFrom: string | null
  sections: CanvasSection[]
  activeSectionId: string | null
  showSectionGuides: boolean
  snapToSections: boolean
  multiSelectMode: boolean
  selectionRect: { x: number; y: number; width: number; height: number } | null
  selectionMode: 'rectangle' | 'lasso' | 'click'
  isSelecting: boolean
  // Vue Flow integration properties
  nodes: any[] // Vue Flow nodes
  edges: any[] // Vue Flow edges
  // Additional state properties
  zoomHistory: { zoom: number; timestamp: number }[]
  multiSelectActive: boolean
}

export const useCanvasStore = defineStore('canvas', () => {
  const db = useDatabase()

  // Viewport state
  const viewport = ref({
    x: 0,
    y: 0,
    zoom: 1
  })

  // Selection state
  const selectedNodeIds = ref<string[]>([])

  // Connection mode state
  const connectMode = ref(false)
  const connectingFrom = ref<string | null>(null)

  // Sections state
  const sections = ref<CanvasSection[]>([])
  const activeSectionId = ref<string | null>(null)
  const showSectionGuides = ref(true)
  const snapToSections = ref(true)

  // Store for collapsed task positions to restore on expand
  const collapsedTaskPositions = ref<Map<string, TaskPosition[]>>(new Map())

  // Vue Flow integration properties
  const nodes = ref<any[]>([])
  const edges = ref<any[]>([])

  // Computed property for collapsed task counts
  const getCollapsedTaskCount = (sectionId: string) => {
    const tasks = collapsedTaskPositions.value.get(sectionId)
    return tasks ? tasks.length : 0
  }

  // Multi-selection state
  const multiSelectMode = ref(false)
  const multiSelectActive = ref(false)
  const selectionRect = ref<{ x: number; y: number; width: number; height: number } | null>(null)
  const selectionMode = ref<'rectangle' | 'lasso' | 'click'>('rectangle')
  const isSelecting = ref(false)

  // Node display preferences
  const showPriorityIndicator = ref(true)
  const showStatusBadge = ref(true)
  const showDurationBadge = ref(true)
  const showScheduleBadge = ref(true)

  // Sync trigger for external components (e.g., undo system) to request canvas refresh
  const syncTrigger = ref(0)

  /**
   * Request a canvas sync from external code (like undo/redo system)
   * CanvasView.vue watches this and calls syncNodes() when it changes
   */
  const requestSync = () => {
    syncTrigger.value++
    console.log('🔄 [CANVAS-STORE] Sync requested, trigger:', syncTrigger.value)
  }

  // Zoom configuration
  const zoomConfig = ref({
    minZoom: 0.05, // 5% minimum zoom (down from 10%)
    maxZoom: 4.0,  // 400% maximum zoom (up from 200%)
    fitToContentPadding: 0.15, // 15% padding around content
    zoomStep: 0.1, // 10% zoom steps
    wheelSensitivity: 1.0, // Mouse wheel sensitivity multiplier
    invertWheel: false, // Invert wheel direction for zoom
    wheelZoomMode: 'zoom' as 'zoom' | 'pan' // Mode for wheel behavior
  })

  // Zoom history for undo/redo functionality
  const zoomHistory = ref<Array<{zoom: number, timestamp: number}>>([])
  const maxZoomHistory = 50 // Maximum history entries to keep

  // Safe Task Sync Functionality
  const syncTasksToCanvas = (tasks: Task[]) => {
    try {
      console.log('🔄 Safely syncing tasks to canvas:', tasks.length)

      // DEBUG: Log all tasks with canvas-related properties
      const tasksWithCanvasProps = tasks.filter(t => t.canvasPosition || t.isInInbox === false)
      console.log('🔍 [CANVAS-SYNC-DEBUG] Tasks with canvas properties:', tasksWithCanvasProps.length)
      tasksWithCanvasProps.forEach(t => {
        console.log(`   - ${t.title}: isInInbox=${t.isInInbox}, canvasPosition=${JSON.stringify(t.canvasPosition)}`)
      })

      // Create task nodes only for tasks that should appear on canvas
      // Tasks in inbox (isInInbox: true) should NOT appear on canvas
      // FIXED: Use explicit check (isInInbox === false) to avoid undefined bypass
      const taskNodes = tasks
        .filter(task => task.isInInbox === false && task.canvasPosition)
        .map(task => ({
          id: task.id,
          type: 'task',
          position: task.canvasPosition || { x: 100, y: 100 },
          data: {
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            progress: task.progress,
            dueDate: task.dueDate,
            projectId: task.projectId,
            task: task // Full task object reference
          },
          draggable: true
        }))

      // Filter out existing non-task nodes, keep them
      const nonTaskNodes = nodes.value.filter(node => node.type !== 'task')

      // Merge task nodes with existing non-task nodes
      nodes.value = [...nonTaskNodes, ...taskNodes]

      console.log('✅ Canvas sync completed:', taskNodes.length, 'task nodes created (excluded inbox tasks)')
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.COMPONENT,
        message: 'Canvas sync failed',
        error: error as Error,
        showNotification: false // Non-critical, canvas will recover
      })
      // Continue - don't crash app
    }
  }

  // Initialize task store when available and set up reactive watcher
  const initializeTaskSync = () => {
    try {
      // Lazy load task store to avoid initialization race condition
      import('./tasks').then(({ useTaskStore }) => {
        taskStore = useTaskStore()

        console.log('🔗 Task store connected, setting up safe sync watcher')

        // Set up reactive watcher with safety guards for task deletions
        // CRITICAL FIX: Pinia auto-unwraps refs, so taskStore.tasks IS the array, NOT a ref!
        // Using .value here returns undefined and breaks the entire canvas sync
        watch(() => taskStore.tasks, (newTasks, oldTasks) => {
          if (newTasks && Array.isArray(newTasks)) {
            console.log('🔄 Tasks changed, safely syncing to canvas:', newTasks.length)

            // If tasks were deleted, immediately remove them from canvas nodes
            if (oldTasks && Array.isArray(oldTasks) && newTasks.length < oldTasks.length) {
              const deletedTaskIds = oldTasks
                .filter(oldTask => !newTasks.some(newTask => newTask.id === oldTask.id))
                .map(deletedTask => deletedTask.id)

              if (deletedTaskIds.length > 0) {
                console.log('🗑️ Tasks deleted, removing from canvas:', deletedTaskIds)
                // Immediately remove deleted task nodes from canvas
                nodes.value = nodes.value.filter(node =>
                  !deletedTaskIds.includes(node.id) || node.type !== 'task'
                )
              }
            }

            syncTasksToCanvas(newTasks)
          }
        }, { deep: true, immediate: false, flush: 'sync' })

        // Initial sync if tasks are already available
        // CRITICAL FIX: taskStore.tasks is already the array (Pinia unwraps refs)
        if (taskStore.tasks && Array.isArray(taskStore.tasks)) {
          console.log('🚀 Initial sync for existing tasks:', taskStore.tasks.length)
          syncTasksToCanvas(taskStore.tasks)
        }
      }).catch(error => {
        console.error('❌ Failed to load task store:', error)
      })
    } catch (error) {
      console.error('❌ Task sync initialization failed:', error)
    }
  }

  // Initialize task sync after database is properly ready instead of using hard timeout
  const initializeWhenDatabaseReady = async () => {
    try {
      console.log('🔄 [CANVAS] Waiting for database to be ready before initializing task sync...')

      // Wait for database to be ready using proper check
      const maxWaitTime = 5000
      const checkInterval = 100
      let attempts = 0
      const maxAttempts = maxWaitTime / checkInterval

      while (!db.isReady?.value && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        attempts++
      }

      if (db.isReady?.value) {
        console.log('✅ [CANVAS] Database is ready, initializing task sync...')
        initializeTaskSync()
      } else {
        console.warn('⚠️ [CANVAS] Database not ready after timeout, initializing anyway...')
        initializeTaskSync()
      }
    } catch (error) {
      console.error('❌ [CANVAS] Failed to wait for database ready:', error)
      // Fallback: try to initialize anyway after a longer delay
      setTimeout(initializeTaskSync, 1000)
    }
  }

  // Initialize when database is ready instead of using arbitrary setTimeout
  initializeWhenDatabaseReady()

  // Actions
  const setViewport = (x: number, y: number, zoom: number) => {
    viewport.value = { x, y, zoom }
  }

  // Zoom management functions
  const saveZoomToHistory = (zoom: number) => {
    const entry = { zoom, timestamp: Date.now() }
    zoomHistory.value.push(entry)

    // Limit history size
    if (zoomHistory.value.length > maxZoomHistory) {
      zoomHistory.value.shift()
    }
  }

  const setViewportWithHistory = (x: number, y: number, zoom: number) => {
    saveZoomToHistory(zoom)
    setViewport(x, y, zoom)
  }

  const updateZoomConfig = (config: Partial<typeof zoomConfig.value>) => {
    zoomConfig.value = { ...zoomConfig.value, ...config }
  }

  // Content bounds calculation for dynamic zoom limits
  const calculateContentBounds = (tasks: Task[]) => {
    if (!tasks.length) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    tasks.forEach(task => {
      if (task.canvasPosition) {
        const taskWidth = 220
        const taskHeight = 100
        minX = Math.min(minX, task.canvasPosition.x)
        minY = Math.min(minY, task.canvasPosition.y)
        maxX = Math.max(maxX, task.canvasPosition.x + taskWidth)
        maxY = Math.max(maxY, task.canvasPosition.y + taskHeight)
      }
    })

    // Add padding
    const padding = 100
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    }
  }

  // Calculate dynamic minimum zoom based on content bounds
  const calculateDynamicMinZoom = (contentBounds: ReturnType<typeof calculateContentBounds>, viewportWidth: number, viewportHeight: number) => {
    const contentWidth = contentBounds.maxX - contentBounds.minX
    const contentHeight = contentBounds.maxY - contentBounds.minY

    if (contentWidth === 0 || contentHeight === 0) return zoomConfig.value.minZoom

    const zoomX = viewportWidth / contentWidth
    const zoomY = viewportHeight / contentHeight

    // Return the smaller zoom to fit content, but respect configured minimum
    return Math.max(zoomConfig.value.minZoom, Math.min(zoomX, zoomY) * (1 - zoomConfig.value.fitToContentPadding))
  }

  const setSelectedNodes = (nodeIds: string[]) => {
    selectedNodeIds.value = nodeIds
  }

  const toggleConnectMode = () => {
    connectMode.value = !connectMode.value
    if (!connectMode.value) {
      connectingFrom.value = null
    }
  }

  const startConnection = (nodeId: string) => {
    connectingFrom.value = nodeId
    connectMode.value = true
  }

  const clearConnection = () => {
    connectingFrom.value = null
    connectMode.value = false
  }

  // Section management actions
  const createSection = (section: Omit<CanvasSection, 'id'>) => {
    const newSection: CanvasSection = {
      ...section,
      id: `section-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }
    sections.value.push(newSection)
    return newSection
  }

  const updateSection = (id: string, updates: Partial<CanvasSection>) => {
    const section = sections.value.find(s => s.id === id)
    if (section) {
      Object.assign(section, updates)
    }
  }

  const deleteSection = (id: string) => {
    if (import.meta.env.DEV) {
      ;(window as any).__lastDeletedSection = { id, before: sections.value.map(s => s.id) }
    }
    const index = sections.value.findIndex(s => s.id === id)
    if (index > -1) {
      sections.value.splice(index, 1)
      if (import.meta.env.DEV) {
        ;(window as any).__lastDeletedSection.after = sections.value.map(s => s.id)
      }
      if (activeSectionId.value === id) {
        activeSectionId.value = null
      }
    } else if (import.meta.env.DEV) {
      ;(window as any).__lastDeletedSection.missed = true
    }
  }

  const toggleSectionVisibility = (id: string) => {
    const section = sections.value.find(s => s.id === id)
    if (section) {
      section.isVisible = !section.isVisible
    }
  }

  const toggleSectionCollapse = (id: string, allTasks: Task[] = []) => {
    const section = sections.value.find(s => s.id === id)
    if (!section) return

    // Get tasks that belong to this section (both geometrically and logically)
    const sectionTasks = getTasksInSectionBounds(section, allTasks)

    if (section.isCollapsed) {
      // EXPAND: Restore section height and task positions
      const savedPositions = collapsedTaskPositions.value.get(id)
      if (savedPositions) {
        savedPositions.forEach(savedTask => {
          const task = allTasks.find(t => t.id === savedTask.id)
          if (task && task.canvasPosition) {
            // Restore absolute position
            task.canvasPosition = { ...savedTask.position }
          }
        })
        collapsedTaskPositions.value.delete(id)
      }

      // Restore original height if it was stored
      if (section.collapsedHeight) {
        section.position.height = section.collapsedHeight
        section.collapsedHeight = undefined
        console.log(`📂 Restored section "${section.name}" height to ${section.position.height}px`)
      }

      section.isCollapsed = false
      console.log(`📂 Expanded section "${section.name}" and restored ${savedPositions?.length || 0} task positions`)
    } else {
      // COLLAPSE: Store task positions and section height before hiding
      const taskPositions: TaskPosition[] = sectionTasks
        .filter(task => task.canvasPosition) // Only tasks with canvas positions
        .map(task => ({
          id: task.id,
          position: { ...task.canvasPosition! }, // Store absolute position
          relativePosition: {
            x: task.canvasPosition!.x - section.position.x,
            y: task.canvasPosition!.y - section.position.y
          }
        }))

      // Store current height before collapsing
      section.collapsedHeight = section.position.height
      collapsedTaskPositions.value.set(id, taskPositions)
      section.isCollapsed = true
      console.log(`📁 Collapsed section "${section.name}" (stored height: ${section.collapsedHeight}px) and stored ${taskPositions.length} task positions`)
    }
  }

  const setActiveSection = (id: string | null) => {
    activeSectionId.value = id
  }

  // Multi-selection actions
  const toggleMultiSelectMode = () => {
    multiSelectMode.value = !multiSelectMode.value
    if (!multiSelectMode.value) {
      clearSelection()
    }
  }

  const setSelectionMode = (mode: 'rectangle' | 'lasso' | 'click') => {
    selectionMode.value = mode
  }

  const startSelection = (x: number, y: number) => {
    isSelecting.value = true
    selectionRect.value = { x, y, width: 0, height: 0 }
  }

  const updateSelection = (currentX: number, currentY: number) => {
    if (!isSelecting.value || !selectionRect.value) return
    
    const startX = selectionRect.value.x
    const startY = selectionRect.value.y
    
    selectionRect.value = {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY)
    }
  }

  const endSelection = () => {
    isSelecting.value = false
  }

  const clearSelection = () => {
    selectedNodeIds.value = []
    selectionRect.value = null
    isSelecting.value = false
  }

  const selectNodesInRect = (rect: { x: number; y: number; width: number; height: number }, nodes: any[]) => {
    const selectedIds: string[] = []
    
    nodes.forEach(node => {
      const nodeX = node.position.x
      const nodeY = node.position.y
      const nodeWidth = 200 // Approximate node width
      const nodeHeight = 80 // Approximate node height
      
      if (
        nodeX < rect.x + rect.width &&
        nodeX + nodeWidth > rect.x &&
        nodeY < rect.y + rect.height &&
        nodeY + nodeHeight > rect.y
      ) {
        selectedIds.push(node.id)
      }
    })
    
    selectedNodeIds.value = selectedIds
  }

  const toggleNodeSelection = (nodeId: string) => {
    const index = selectedNodeIds.value.indexOf(nodeId)
    if (index > -1) {
      selectedNodeIds.value.splice(index, 1)
    } else {
      selectedNodeIds.value.push(nodeId)
    }
  }

  const selectAll = () => {
    // This would need to be called with all node IDs
    // Implementation depends on how we access all nodes
  }

  // Bulk operations - Note: These are called from CanvasView which has access to taskStore
  // Removed dynamic imports to avoid circular dependency issues
  const bulkDelete = (nodeIds: string[], permanent: boolean = false) => {
    // This function is now just a placeholder - CanvasView handles deletion directly
    console.log('Bulk delete:', nodeIds, 'permanent:', permanent)
  }

  const bulkUpdateStatus = (nodeIds: string[], status: Task['status']) => {
    // This function is now just a placeholder - CanvasView/BatchEditModal handle updates
    console.log('Bulk update status:', nodeIds, status)
  }

  const bulkUpdatePriority = (nodeIds: string[], priority: Task['priority']) => {
    // This function is now just a placeholder - CanvasView/BatchEditModal handle updates
    console.log('Bulk update priority:', nodeIds, priority)
  }

  const bulkUpdateProject = (nodeIds: string[], projectId: string) => {
    // This function is now just a placeholder - BatchEditModal handles updates
    console.log('Bulk update project:', nodeIds, projectId)
  }

  const bulkUpdateDueDate = (nodeIds: string[], dueDate: string) => {
    // This function is now just a placeholder - BatchEditModal handles updates
    console.log('Bulk update due date:', nodeIds, dueDate)
  }

  const bulkUpdateDuration = (nodeIds: string[], estimatedDuration: number) => {
    // This function is now just a placeholder - BatchEditModal handles updates
    console.log('Bulk update duration:', nodeIds, estimatedDuration)
  }

  const getTasksInSection = (section: CanvasSection, allTasks: Task[]) => {
    if (!section.filters) return allTasks

    return allTasks.filter(task => {
      // Priority filter
      if (section.filters!.priorities && task.priority && !section.filters!.priorities.includes(task.priority)) {
        return false
      }

      // Status filter
      if (section.filters!.statuses && !section.filters!.statuses.includes(task.status)) {
        return false
      }

      // Project filter
      if (section.filters!.projects && !section.filters!.projects.includes(task.projectId)) {
        return false
      }

      // Date range filter
      if (section.filters!.dateRange) {
        const taskDate = new Date(task.createdAt)
        if (section.filters!.dateRange.start && taskDate < section.filters!.dateRange.start) {
          return false
        }
        if (section.filters!.dateRange.end && taskDate > section.filters!.dateRange.end) {
          return false
        }
      }

      return true
    })
  }

  // Check if task matches section criteria (for auto-collect)
  const taskMatchesSection = (task: Task, section: CanvasSection): boolean => {
    // Handle smart groups (Today, Tomorrow, etc.) - these are custom sections with smart group names
    if (section.type === 'custom' && isSmartGroup(section.name)) {
      const smartGroupType = getSmartGroupType(section.name)
      if (!smartGroupType) return false

      // For smart groups, check if task has the corresponding due date
      const expectedDate = getSmartGroupDate(smartGroupType)
      if (!expectedDate) return false // "Later" group has no specific date

      return task.dueDate === expectedDate
    }

    // Smart sections match by propertyValue
    if (section.type === 'priority' && section.propertyValue) {
      return task.priority === section.propertyValue
    }
    if (section.type === 'status' && section.propertyValue) {
      return task.status === section.propertyValue
    }
    if (section.type === 'project' && section.propertyValue) {
      return task.projectId === section.propertyValue
    }

    // Custom sections match by filters
    if (section.filters) {
      if (section.filters.priorities && task.priority && !section.filters.priorities.includes(task.priority)) {
        return false
      }
      if (section.filters.statuses && !section.filters.statuses.includes(task.status)) {
        return false
      }
      if (section.filters.projects && !section.filters.projects.includes(task.projectId)) {
        return false
      }
      return true
    }

    return false
  }

  const toggleAutoCollect = (sectionId: string) => {
    const section = sections.value.find(s => s.id === sectionId)
    if (section) {
      section.autoCollect = !section.autoCollect
    }
  }

  // Auto-save sections to PouchDB via SaveQueueManager (Chief Architect conflict prevention)
  let sectionsSaveTimer: ReturnType<typeof setTimeout> | null = null
  watch(sections, (newSections) => {
    if (sectionsSaveTimer) clearTimeout(sectionsSaveTimer)
    sectionsSaveTimer = setTimeout(async () => {
      try {
        await db.save(DB_KEYS.CANVAS, newSections)
        console.log('📋 Canvas sections auto-saved via SaveQueueManager')
      } catch (error) {
        console.error('❌ Canvas auto-save failed:', error)
      }
    }, 1000)
  }, { deep: true, flush: 'post' })

  // Initialize sections (empty by default - user creates them)
  const initializeDefaultSections = () => {
    // Start with empty sections - users create their own
    if (sections.value.length === 0) {
      sections.value = []
    }
  }

  // Preset smart section creators
  const createPrioritySection = (priority: 'high' | 'medium' | 'low', position: { x: number; y: number }) => {
    const colors = { high: '#ef4444', medium: '#f59e0b', low: '#6366f1' }
    const names = { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' }

    return createSection({
      name: names[priority],
      type: 'priority',
      propertyValue: priority,
      position: { ...position, width: 300, height: 250 },
      color: colors[priority],
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })
  }

  const createStatusSection = (status: 'planned' | 'in_progress' | 'done' | 'backlog', position: { x: number; y: number }) => {
    const colors = { planned: '#6366f1', in_progress: '#f59e0b', done: '#10b981', backlog: '#64748b' }
    const names = { planned: 'Planned', in_progress: 'In Progress', done: 'Done', backlog: 'Backlog' }

    return createSection({
      name: names[status],
      type: 'status',
      propertyValue: status,
      position: { ...position, width: 300, height: 250 },
      color: colors[status],
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })
  }

  const createProjectSection = (projectId: string, projectName: string, color: string, position: { x: number; y: number }) => {
    return createSection({
      name: projectName,
      type: 'project',
      propertyValue: projectId,
      position: { ...position, width: 300, height: 250 },
      color: color,
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })
  }

  const createCustomGroup = (name: string, color: string, position: { x: number; y: number }, width: number = 300, height: number = 200) => {
    return createSection({
      name: name,
      type: 'custom',
      position: { x: position.x, y: position.y, width, height },
      color: color,
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })
  }

  // Display preference toggles
  const togglePriorityIndicator = () => {
    showPriorityIndicator.value = !showPriorityIndicator.value
  }

  const toggleStatusBadge = () => {
    showStatusBadge.value = !showStatusBadge.value
  }

  const toggleDurationBadge = () => {
    showDurationBadge.value = !showDurationBadge.value
  }

  const toggleScheduleBadge = () => {
    showScheduleBadge.value = !showScheduleBadge.value
  }

  // Load canvas state from IndexedDB
  // Magnetic zone utilities
  const isPointInSection = (x: number, y: number, section: CanvasSection, padding: number = 0): boolean => {
    const { x: sx, y: sy, width, height } = section.position
    return (
      x >= sx - padding &&
      x <= sx + width + padding &&
      y >= sy - padding &&
      y <= sy + height + padding
    )
  }

  const isTaskInSection = (task: Task, section: CanvasSection): boolean => {
    if (!task.canvasPosition) return false

    const taskWidth = 220
    const taskHeight = 100
    const taskCenterX = task.canvasPosition.x + taskWidth / 2
    const taskCenterY = task.canvasPosition.y + taskHeight / 2

    return isPointInSection(taskCenterX, taskCenterY, section)
  }

  // Check if task is logically associated with a section (matches criteria)
  const isTaskLogicallyInSection = (task: Task, section: CanvasSection): boolean => {
    return taskMatchesSection(task, section)
  }

  const getTasksInSectionBounds = (section: CanvasSection, allTasks: Task[]): Task[] => {
    // For smart sections (priority, status, project), include matching tasks that are ON CANVAS
    // FIXED: Only include tasks with isInInbox === false (explicitly on canvas)
    if (section.type === 'priority' || section.type === 'status' || section.type === 'project') {
      return allTasks.filter(task =>
        isTaskLogicallyInSection(task, section) &&
        task.isInInbox === false  // Only tasks explicitly on canvas
      )
    }

    // For smart groups (Today, Tomorrow, etc.), include matching tasks that are ON CANVAS
    // FIXED: Only include tasks with isInInbox === false (explicitly on canvas)
    if (section.type === 'custom' && isSmartGroup(section.name)) {
      return allTasks.filter(task =>
        isTaskLogicallyInSection(task, section) &&
        task.isInInbox === false  // Only tasks explicitly on canvas
      )
    }

    // For custom sections, include both geometrically contained and logically matching tasks
    return allTasks.filter(task => {
      const isInside = isTaskInSection(task, section)
      const matchesCriteria = isTaskLogicallyInSection(task, section)
      return isInside || matchesCriteria
    })
  }

  const findNearestSection = (x: number, y: number, maxDistance: number = 50): CanvasSection | null => {
    let nearestSection: CanvasSection | null = null
    let minDistance = maxDistance

    sections.value.forEach(section => {
      if (!section.isVisible || section.isCollapsed) return

      const { x: sx, y: sy, width, height } = section.position

      // Find closest point on section rectangle to the point
      const closestX = Math.max(sx, Math.min(x, sx + width))
      const closestY = Math.max(sy, Math.min(y, sy + height))

      // Calculate distance
      const distance = Math.sqrt(Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2))

      if (distance < minDistance) {
        minDistance = distance
        nearestSection = section
      }
    })

    return nearestSection
  }

  const getMagneticSnapPosition = (task: Task, section: CanvasSection): { x: number; y: number } => {
    if (!task.canvasPosition) return task.canvasPosition || { x: 0, y: 0 }

    const { x: sx, y: sy, width, height } = section.position
    const taskWidth = 220
    const taskHeight = 100

    // Calculate position inside section with some padding
    const padding = 20
    const headerHeight = 60

    // Simple grid-based positioning inside section
    const existingTasks = getTasksInSectionBounds(section, [] as Task[]) // Will be called from CanvasView with actual tasks
    const cols = Math.floor((width - padding * 2) / (taskWidth + 20))
    const rows = Math.floor((height - headerHeight - padding) / (taskHeight + 20))

    if (cols === 0 || rows === 0) {
      // Section too small, place at top-left with padding
      return { x: sx + padding, y: sy + headerHeight + padding }
    }

    // Find first empty grid position
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const testX = sx + padding + col * (taskWidth + 20)
        const testY = sy + headerHeight + padding + row * (taskHeight + 20)

        // Check if this position is occupied (simplified check)
        const isOccupied = existingTasks.some(existingTask => {
          if (!existingTask.canvasPosition) return false
          const existingX = existingTask.canvasPosition.x
          const existingY = existingTask.canvasPosition.y
          return Math.abs(existingX - testX) < taskWidth / 2 && Math.abs(existingY - testY) < taskHeight / 2
        })

        if (!isOccupied) {
          return { x: testX, y: testY }
        }
      }
    }

    // If no empty spot found, place at next available position
    return { x: sx + padding, y: sy + headerHeight + padding }
  }

  const getTaskCountInSection = (section: CanvasSection, allTasks: Task[]): number => {
    // Use the updated getTasksInSectionBounds which now includes logical association
    const associatedTasks = getTasksInSectionBounds(section, allTasks)
    return associatedTasks.length
  }

  // Load canvas state from IndexedDB
  const loadFromDatabase = async () => {
    try {
      // Wait for database to be ready before loading
      if (db.isLoading.value) {
        await new Promise<void>((resolve) => {
          const unwatch = watch(db.isLoading, (loading) => {
            if (!loading) {
              unwatch()
              resolve()
            }
          }, { immediate: true })
        })
      }

      if (!db.isReady.value) {
        console.warn('⚠️ Database not ready, skipping canvas load')
        return
      }

      const savedSections = await db.load<CanvasSection[]>(DB_KEYS.CANVAS)
      if (savedSections && savedSections.length > 0) {
        sections.value = savedSections
        console.log(`📂 Loaded ${sections.value.length} canvas sections from IndexedDB`)
      }
    } catch (error) {
      console.warn('⚠️ Failed to load canvas from database:', error)
    }
  }

  
  // Undo/Redo enabled actions - simplified to avoid circular dependencies
  const undoRedoEnabledActions = () => {
    // Create local references to ensure proper closure access
    const localUpdateSection = (sectionId: string, updates: Partial<CanvasSection>) => updateSection(sectionId, updates)
    const localToggleSectionCollapse = (sectionId: string) => toggleSectionCollapse(sectionId)
    const localToggleSectionVisibility = (sectionId: string) => toggleSectionVisibility(sectionId)
    const localSetViewport = (x: number, y: number, zoom: number) => setViewport(x, y, zoom)
    const localSetSelectedNodes = (nodeIds: string[]) => setSelectedNodes(nodeIds)
    const localToggleNodeSelection = (nodeId: string) => toggleNodeSelection(nodeId)
    const localClearSelection = () => clearSelection()
    const localToggleConnectMode = () => toggleConnectMode()
    const localStartConnection = (nodeId: string) => startConnection(nodeId)
    const localClearConnection = () => clearConnection()

    return {
      // Section actions with undo/redo
      createSectionWithUndo: async (section: Omit<CanvasSection, 'id'>) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.createSection(section)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return createSection(section)
        }
      },
      updateSectionWithUndo: async (sectionId: string, updates: Partial<CanvasSection>) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          if (actions && typeof actions.updateSection === 'function') {
            return await actions.updateSection(sectionId, updates)
          } else {
            return localUpdateSection(sectionId, updates)
          }
        } catch (error) {
          return localUpdateSection(sectionId, updates)
        }
      },
      deleteSectionWithUndo: async (sectionId: string) => {
        // Unified undo/redo doesn't support section deletion yet
        // Using direct deletion for now
        return deleteSection(sectionId)
      },
      toggleSectionVisibilityWithUndo: async (sectionId: string) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.toggleSectionVisibility(sectionId)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return localToggleSectionVisibility(sectionId)
        }
      },
      toggleSectionCollapseWithUndo: async (sectionId: string) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.toggleSectionCollapse(sectionId)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return localToggleSectionCollapse(sectionId)
        }
      },

      // Viewport actions with undo/redo
      setViewportWithUndo: async (x: number, y: number, zoom: number) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.setViewport(x, y, zoom)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return localSetViewport(x, y, zoom)
        }
      },

      // Selection actions with undo/redo
      selectNodesWithUndo: async (nodeIds: string[]) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.selectNodes(nodeIds)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return localSetSelectedNodes(nodeIds)
        }
      },
      toggleNodeSelectionWithUndo: async (nodeId: string) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.toggleNodeSelection(nodeId)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return localToggleNodeSelection(nodeId)
        }
      },
      clearSelectionWithUndo: async () => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.clearSelection()
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return localClearSelection()
        }
      },

      // Connection actions with undo/redo
      toggleConnectModeWithUndo: async () => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.toggleConnectMode()
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return localToggleConnectMode()
        }
      },
      startConnectionWithUndo: async (nodeId: string) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.startConnection(nodeId)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return localStartConnection(nodeId)
        }
      },
      clearConnectionWithUndo: async () => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.clearConnection()
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          return localClearConnection()
        }
      },

      // Task position actions with undo/redo
      updateTaskPositionWithUndo: async (taskId: string, position: { x: number; y: number }) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.updateTaskPosition(taskId, position)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          console.warn('updateTaskPosition not available without undo/redo system')
        }
      },

      // Bulk actions with undo/redo
      bulkUpdateTasksWithUndo: async (taskIds: string[], updates: Partial<any>) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.bulkUpdateTasks(taskIds, updates)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          console.warn('bulkUpdateTasks not available without undo/redo system')
        }
      },
      bulkDeleteTasksWithUndo: async (taskIds: string[]) => {
        try {
          const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
          const useUnifiedUndoRedo = await getUndoRedoComposable()
          const actions = useUnifiedUndoRedo()
          return actions.bulkDeleteTasks(taskIds)
        } catch (error) {
          console.warn('Undo/Redo system not available, using direct updates:', error)
          console.warn('bulkDeleteTasks not available without undo/redo system')
        }
      }
    }
  }

  return {
    // State
    viewport,
    selectedNodeIds,
    connectMode,
    connectingFrom,
    sections,
    activeSectionId,
    showSectionGuides,
    snapToSections,
    collapsedTaskPositions,
    nodes,
    edges,
    multiSelectMode,
    multiSelectActive,
    selectionRect,
    selectionMode,
    isSelecting,
    showPriorityIndicator,
    showStatusBadge,
    showDurationBadge,
    showScheduleBadge,
    zoomConfig,
    zoomHistory,

    // Original actions (without undo/redo - for internal use)
    setViewport,
    setViewportWithHistory,
    setSelectedNodes,
    toggleConnectMode,
    startConnection,
    clearConnection,
    createSection,
    updateSection,
    deleteSection,
    toggleSectionVisibility,
    toggleSectionCollapse,
    setActiveSection,
    getTasksInSection,
    taskMatchesSection,
    toggleAutoCollect,
    initializeDefaultSections,
    createPrioritySection,
    createStatusSection,
    createProjectSection,
    createCustomGroup,
    toggleMultiSelectMode,
    setSelectionMode,
    startSelection,
    updateSelection,
    endSelection,
    togglePriorityIndicator,
    toggleStatusBadge,
    toggleDurationBadge,
    toggleScheduleBadge,
    clearSelection,
    selectNodesInRect,
    toggleNodeSelection,
    selectAll,
    bulkDelete,
    bulkUpdateStatus,
    bulkUpdatePriority,
    bulkUpdateProject,
    bulkUpdateDueDate,
    bulkUpdateDuration,
    loadFromDatabase,

    // Zoom management functions
    updateZoomConfig,
    saveZoomToHistory,
    calculateContentBounds,
    calculateDynamicMinZoom,

    // Magnetic zone utilities
    isPointInSection,
    isTaskInSection,
    isTaskLogicallyInSection,
    getTasksInSectionBounds,
    findNearestSection,
    getMagneticSnapPosition,
    getTaskCountInSection,
    getCollapsedTaskCount,

    // Task synchronization
    syncTasksToCanvas,

    // External sync trigger (for undo/redo system)
    syncTrigger,
    requestSync,

    // Undo/Redo enabled actions
    ...undoRedoEnabledActions()
  }
})
