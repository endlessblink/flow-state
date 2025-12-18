import { defineStore } from 'pinia'
import { ref, watch, computed as _computed } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import type { Task } from './tasks'
import {
  isSmartGroup,
  getSmartGroupType,
  getSmartGroupDate,
  detectPowerKeyword,
  isPowerGroup,
  type SmartGroupType,
  type PowerKeywordResult
} from '@/composables/useTaskSmartGroups'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

// Task store import for safe sync functionality
let taskStore: any = null

export interface GroupFilter {
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
 * Canvas container for organizing tasks (unified as "Groups").
 *
 * All canvas containers are now called "Groups". Groups can have different types:
 * - `type: 'custom'`: Visual organization only (unless power mode is enabled)
 * - `type: 'priority'|'status'|'timeline'|'project'`: Smart automation with auto-assign
 *
 * **Power Groups**:
 * Any group can become a "power group" when its name contains special keywords
 * like "Today", "High Priority", etc. Power groups can:
 * 1. Auto-assign properties to dropped tasks (e.g., set dueDate to today)
 * 2. Collect matching tasks from inbox with a "Collect" button
 */
/**
 * Settings for auto-assigning properties when a task is dropped into a group
 */
export interface AssignOnDropSettings {
  priority?: 'high' | 'medium' | 'low' | null  // null = don't change
  status?: Task['status'] | null
  dueDate?: 'today' | 'tomorrow' | 'this_week' | 'this_weekend' | 'later' | string | null
  projectId?: string | null
}

/**
 * Settings for the collect/magnet feature - which tasks to match
 */
export interface CollectFilterSettings {
  matchPriority?: 'high' | 'medium' | 'low' | null
  matchStatus?: Task['status'] | null
  matchDueDate?: 'today' | 'tomorrow' | 'this_week' | 'overdue' | null
  matchProjectId?: string | null
}

export interface CanvasGroup {
  id: string
  name: string
  type: 'priority' | 'status' | 'timeline' | 'custom' | 'project'
  position: { x: number; y: number; width: number; height: number }
  color: string
  filters?: GroupFilter
  layout: 'vertical' | 'horizontal' | 'grid' | 'freeform'
  isVisible: boolean
  isCollapsed: boolean
  /** @deprecated Use assignOnDrop instead */
  propertyValue?: string | 'high' | 'medium' | 'low' | 'planned' | 'in_progress' | 'done' | 'backlog'
  autoCollect?: boolean // Auto-collect matching tasks from inbox
  collapsedHeight?: number // Store height when collapsed to restore on expand
  // Power group fields
  isPowerMode?: boolean // Whether power mode is enabled (auto-detected from name, can be toggled off)
  powerKeyword?: PowerKeywordResult | null // Detected power keyword info
  // NEW: Explicit property assignment settings (user-configurable via settings menu)
  assignOnDrop?: AssignOnDropSettings
  // NEW: Collect filter settings for magnet button
  collectFilter?: CollectFilterSettings
}

// Backward compatibility alias - keeping CanvasSection as alias for CanvasGroup
/** @deprecated Use CanvasGroup instead */
export type CanvasSection = CanvasGroup

export interface CanvasState {
  viewport: {
    x: number
    y: number
    zoom: number
  }
  selectedNodeIds: string[]
  connectMode: boolean
  connectingFrom: string | null
  groups: CanvasGroup[]
  activeGroupId: string | null
  showGroupGuides: boolean
  snapToGroups: boolean
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

  // Groups state (unified - no more "sections" vs "groups" distinction)
  const groups = ref<CanvasGroup[]>([])
  const activeGroupId = ref<string | null>(null)
  const showGroupGuides = ref(true)
  const snapToGroups = ref(true)

  // Backward compatibility aliases
  const sections = groups  // Alias for backward compatibility
  const activeSectionId = activeGroupId  // Alias for backward compatibility
  const showSectionGuides = showGroupGuides  // Alias for backward compatibility
  const snapToSections = snapToGroups  // Alias for backward compatibility

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

        // Set up reactive watcher with safety guards for task deletions
        // CRITICAL FIX: Pinia auto-unwraps refs, so taskStore.tasks IS the array, NOT a ref!
        watch(() => taskStore.tasks, (newTasks, oldTasks) => {
          if (newTasks && Array.isArray(newTasks)) {
            // If tasks were deleted, immediately remove them from canvas nodes
            if (oldTasks && Array.isArray(oldTasks) && newTasks.length < oldTasks.length) {
              const deletedTaskIds = oldTasks
                .filter(oldTask => !newTasks.some(newTask => newTask.id === oldTask.id))
                .map(deletedTask => deletedTask.id)

              if (deletedTaskIds.length > 0) {
                nodes.value = nodes.value.filter(node =>
                  !deletedTaskIds.includes(node.id) || node.type !== 'task'
                )
              }
            }

            syncTasksToCanvas(newTasks)
          }
        }, { deep: true, immediate: false, flush: 'sync' })

        // Initial sync if tasks are already available
        if (taskStore.tasks && Array.isArray(taskStore.tasks)) {
          syncTasksToCanvas(taskStore.tasks)
        }
      }).catch(() => {
        // Silent fail - canvas will work without task sync
      })
    } catch {
      // Silent fail - canvas will work without task sync
    }
  }

  // Initialize task sync after database is properly ready instead of using hard timeout
  const initializeWhenDatabaseReady = async () => {
    try {
      // Wait for database to be ready using proper check
      const maxWaitTime = 5000
      const checkInterval = 100
      let attempts = 0
      const maxAttempts = maxWaitTime / checkInterval

      while (!db.isReady?.value && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        attempts++
      }

      initializeTaskSync()
    } catch {
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

  // Group management actions (unified - everything is now a "group")
  const createGroup = (group: Omit<CanvasGroup, 'id'>) => {
    const newGroup: CanvasGroup = {
      ...group,
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }
    groups.value.push(newGroup)
    return newGroup
  }

  const updateGroup = (id: string, updates: Partial<CanvasGroup>) => {
    const group = groups.value.find(g => g.id === id)
    if (group) {
      Object.assign(group, updates)
    }
  }

  const deleteGroup = (id: string) => {
    if (import.meta.env.DEV) {
      (window as any).__lastDeletedGroup = { id, before: groups.value.map(g => g.id) }
    }
    const index = groups.value.findIndex(g => g.id === id)
    if (index > -1) {
      groups.value.splice(index, 1)
      if (import.meta.env.DEV) {
        (window as any).__lastDeletedGroup.after = groups.value.map(g => g.id)
      }
      if (activeGroupId.value === id) {
        activeGroupId.value = null
      }
    } else if (import.meta.env.DEV) {
      (window as any).__lastDeletedGroup.missed = true
    }
  }

  const toggleGroupVisibility = (id: string) => {
    const group = groups.value.find(g => g.id === id)
    if (group) {
      group.isVisible = !group.isVisible
    }
  }

  const toggleGroupCollapse = (id: string, allTasks: Task[] = []) => {
    const group = groups.value.find(g => g.id === id)
    if (!group) return

    // Get tasks that belong to this group (both geometrically and logically)
    const groupTasks = getTasksInGroupBounds(group, allTasks)

    if (group.isCollapsed) {
      // EXPAND: Restore group height and task positions
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
      if (group.collapsedHeight) {
        group.position.height = group.collapsedHeight
        group.collapsedHeight = undefined
        console.log(`📂 Restored group "${group.name}" height to ${group.position.height}px`)
      }

      group.isCollapsed = false
      console.log(`📂 Expanded group "${group.name}" and restored ${savedPositions?.length || 0} task positions`)
    } else {
      // COLLAPSE: Store task positions and group height before hiding
      const taskPositions: TaskPosition[] = groupTasks
        .filter(task => task.canvasPosition) // Only tasks with canvas positions
        .map(task => ({
          id: task.id,
          position: { ...task.canvasPosition! }, // Store absolute position
          relativePosition: {
            x: task.canvasPosition!.x - group.position.x,
            y: task.canvasPosition!.y - group.position.y
          }
        }))

      // Store current height before collapsing
      group.collapsedHeight = group.position.height
      collapsedTaskPositions.value.set(id, taskPositions)
      group.isCollapsed = true
      console.log(`📁 Collapsed group "${group.name}" (stored height: ${group.collapsedHeight}px) and stored ${taskPositions.length} task positions`)
    }
  }

  const setActiveGroup = (id: string | null) => {
    activeGroupId.value = id
  }

  // Backward compatibility aliases for methods
  const createSection = createGroup
  const updateSection = updateGroup
  const deleteSection = deleteGroup
  const toggleSectionVisibility = toggleGroupVisibility
  const toggleSectionCollapse = toggleGroupCollapse
  const setActiveSection = setActiveGroup

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

  const getTasksInGroup = (group: CanvasGroup, allTasks: Task[]) => {
    if (!group.filters) return allTasks

    return allTasks.filter(task => {
      // Priority filter
      if (group.filters!.priorities && task.priority && !group.filters!.priorities.includes(task.priority)) {
        return false
      }

      // Status filter
      if (group.filters!.statuses && !group.filters!.statuses.includes(task.status)) {
        return false
      }

      // Project filter
      if (group.filters!.projects && !group.filters!.projects.includes(task.projectId)) {
        return false
      }

      // Date range filter
      if (group.filters!.dateRange) {
        const taskDate = new Date(task.createdAt)
        if (group.filters!.dateRange.start && taskDate < group.filters!.dateRange.start) {
          return false
        }
        if (group.filters!.dateRange.end && taskDate > group.filters!.dateRange.end) {
          return false
        }
      }

      return true
    })
  }

  // Check if task matches group criteria (for auto-collect)
  const taskMatchesGroup = (task: Task, group: CanvasGroup): boolean => {
    // Handle smart groups (Today, Tomorrow, etc.) - these are custom groups with smart group names
    if (group.type === 'custom' && isSmartGroup(group.name)) {
      const smartGroupType = getSmartGroupType(group.name)
      if (!smartGroupType) return false

      // For smart groups, check if task has the corresponding due date
      const expectedDate = getSmartGroupDate(smartGroupType)
      if (!expectedDate) return false // "Later" group has no specific date

      // FIX Dec 5, 2025: "This Week" needs range check, not exact match
      // Week should include all tasks from today through end of week (Sunday)
      if (smartGroupType === 'this week') {
        if (!task.dueDate) return false
        const today = new Date()
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        // task.dueDate should be >= today AND <= Sunday (expectedDate)
        return task.dueDate >= todayStr && task.dueDate <= expectedDate
      }

      // For other smart groups (today, tomorrow, weekend), exact match is correct
      return task.dueDate === expectedDate
    }

    // Smart groups match by propertyValue
    if (group.type === 'priority' && group.propertyValue) {
      return task.priority === group.propertyValue
    }
    if (group.type === 'status' && group.propertyValue) {
      return task.status === group.propertyValue
    }
    if (group.type === 'project' && group.propertyValue) {
      return task.projectId === group.propertyValue
    }

    // Custom groups match by filters
    if (group.filters) {
      if (group.filters.priorities && task.priority && !group.filters.priorities.includes(task.priority)) {
        return false
      }
      if (group.filters.statuses && !group.filters.statuses.includes(task.status)) {
        return false
      }
      if (group.filters.projects && !group.filters.projects.includes(task.projectId)) {
        return false
      }
      return true
    }

    return false
  }

  const toggleAutoCollect = (groupId: string) => {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      group.autoCollect = !group.autoCollect
    }
  }

  // Backward compatibility aliases
  const getTasksInSection = getTasksInGroup
  const taskMatchesSection = taskMatchesGroup

  // ============================================
  // POWER GROUP FUNCTIONALITY
  // ============================================

  /**
   * Toggle power mode for a group
   * Power mode is auto-detected from name but can be manually disabled
   */
  const togglePowerMode = (groupId: string) => {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      // If power mode was undefined, detect from name first
      if (group.isPowerMode === undefined) {
        group.powerKeyword = detectPowerKeyword(group.name)
        group.isPowerMode = group.powerKeyword !== null
      }
      // Toggle
      group.isPowerMode = !group.isPowerMode
      console.log(`⚡ Power mode ${group.isPowerMode ? 'enabled' : 'disabled'} for group "${group.name}"`)
    }
  }

  /**
   * Update group's power keyword detection (call when name changes)
   */
  const updateGroupPowerKeyword = (groupId: string) => {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      const newKeyword = detectPowerKeyword(group.name)
      group.powerKeyword = newKeyword

      // Auto-enable power mode if keyword detected (unless explicitly disabled)
      if (newKeyword && group.isPowerMode !== false) {
        group.isPowerMode = true
        console.log(`⚡ Auto-enabled power mode for "${group.name}" (keyword: ${newKeyword.keyword})`)
      }
    }
  }

  /**
   * Check if a group has power mode enabled
   */
  const isGroupPowerEnabled = (group: CanvasGroup): boolean => {
    // If power mode is explicitly set, use that
    if (group.isPowerMode !== undefined) {
      return group.isPowerMode
    }
    // Otherwise, detect from name
    return isPowerGroup(group.name)
  }

  /**
   * Get the power keyword for a group
   */
  const getGroupPowerKeyword = (group: CanvasGroup): PowerKeywordResult | null => {
    if (group.powerKeyword !== undefined) {
      return group.powerKeyword
    }
    return detectPowerKeyword(group.name)
  }

  /**
   * Get matching tasks for a power group
   * Returns tasks that match the power keyword criteria
   */
  const getMatchingTasksForPowerGroup = (group: CanvasGroup, allTasks: Task[]): Task[] => {
    const powerKeyword = getGroupPowerKeyword(group)
    if (!powerKeyword) return []

    return allTasks.filter(task => {
      // Only consider inbox tasks for collection
      if (task.isInInbox === false) return false

      switch (powerKeyword.category) {
        case 'date': {
          const expectedDate = getSmartGroupDate(powerKeyword.value as SmartGroupType)
          if (!expectedDate) return false // "Later" has no date

          // For "this week", use range check
          if (powerKeyword.value === 'this week') {
            if (!task.dueDate) return false
            const today = new Date()
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            return task.dueDate >= todayStr && task.dueDate <= expectedDate
          }

          return task.dueDate === expectedDate
        }

        case 'priority':
          return task.priority === powerKeyword.value

        case 'status':
          return task.status === powerKeyword.value

        default:
          return false
      }
    })
  }

  /**
   * Get count of matching tasks for a power group (for badge display)
   */
  const getMatchingTaskCount = (groupId: string, allTasks: Task[]): number => {
    const group = groups.value.find(g => g.id === groupId)
    if (!group || !isGroupPowerEnabled(group)) return 0
    return getMatchingTasksForPowerGroup(group, allTasks).length
  }

  /**
   * Collect matching tasks into a power group
   * @param groupId - The group to collect tasks into
   * @param mode - 'move' to relocate tasks, 'highlight' to just mark them
   * @param allTasks - All available tasks
   * @param updateTaskFn - Function to update a task (from task store)
   * @returns The collected/highlighted task IDs
   */
  const collectMatchingTasks = async (
    groupId: string,
    mode: 'move' | 'highlight',
    allTasks: Task[],
    updateTaskFn: (taskId: string, updates: Partial<Task>) => Promise<void>
  ): Promise<string[]> => {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) {
      console.warn(`Group ${groupId} not found`)
      return []
    }

    const matchingTasks = getMatchingTasksForPowerGroup(group, allTasks)
    if (matchingTasks.length === 0) {
      console.log(`📋 No matching tasks found for power group "${group.name}"`)
      return []
    }

    console.log(`📋 Found ${matchingTasks.length} matching tasks for power group "${group.name}"`)

    const collectedIds: string[] = []

    if (mode === 'move') {
      // Move tasks to canvas and position them in the group
      const groupBounds = group.position
      const taskWidth = 220
      const taskHeight = 100
      const padding = 20
      const headerHeight = 60
      const cols = Math.max(1, Math.floor((groupBounds.width - padding * 2) / (taskWidth + 10)))

      for (let i = 0; i < matchingTasks.length; i++) {
        const task = matchingTasks[i]
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = groupBounds.x + padding + col * (taskWidth + 10)
        const y = groupBounds.y + headerHeight + padding + row * (taskHeight + 10)

        await updateTaskFn(task.id, {
          isInInbox: false,
          canvasPosition: { x, y }
        })

        collectedIds.push(task.id)
      }

      console.log(`✅ Moved ${collectedIds.length} tasks to power group "${group.name}"`)
    } else {
      // Highlight mode - just return the IDs for UI to highlight
      collectedIds.push(...matchingTasks.map(t => t.id))
      console.log(`🔦 Highlighted ${collectedIds.length} matching tasks for power group "${group.name}"`)
    }

    return collectedIds
  }

  /**
   * Apply power group properties to a task when dropped on the group
   * @param task - The task being dropped
   * @param group - The power group
   * @param overrideMode - How to handle existing properties
   * @returns The updates to apply to the task
   */
  const getPowerGroupUpdates = (
    task: Task,
    group: CanvasGroup,
    overrideMode: 'always' | 'only_empty' | 'ask' = 'always'
  ): Partial<Task> | 'ask' | null => {
    if (!isGroupPowerEnabled(group)) return null

    const powerKeyword = getGroupPowerKeyword(group)
    if (!powerKeyword) return null

    const updates: Partial<Task> = {}

    switch (powerKeyword.category) {
      case 'date': {
        const newDate = getSmartGroupDate(powerKeyword.value as SmartGroupType)
        if (newDate) {
          if (overrideMode === 'always') {
            updates.dueDate = newDate
          } else if (overrideMode === 'only_empty') {
            if (!task.dueDate) updates.dueDate = newDate
          } else if (overrideMode === 'ask' && task.dueDate && task.dueDate !== newDate) {
            return 'ask' // Signal that we need to ask user
          } else {
            updates.dueDate = newDate
          }
        }
        break
      }

      case 'priority': {
        const newPriority = powerKeyword.value as 'high' | 'medium' | 'low'
        if (overrideMode === 'always') {
          updates.priority = newPriority
        } else if (overrideMode === 'only_empty') {
          if (!task.priority) updates.priority = newPriority
        } else if (overrideMode === 'ask' && task.priority && task.priority !== newPriority) {
          return 'ask'
        } else {
          updates.priority = newPriority
        }
        break
      }

      case 'status': {
        const newStatus = powerKeyword.value as Task['status']
        if (overrideMode === 'always') {
          updates.status = newStatus
        } else if (overrideMode === 'only_empty') {
          // Status always has a value, so only_empty doesn't make sense here
          // Fall through to 'ask' behavior if different
          if (task.status !== newStatus && overrideMode === 'only_empty') {
            // Don't update - status is never "empty"
          }
        } else if (overrideMode === 'ask' && task.status !== newStatus) {
          return 'ask'
        } else {
          updates.status = newStatus
        }
        break
      }
    }

    return Object.keys(updates).length > 0 ? updates : null
  }

  // Backward compatibility aliases for power group methods
  const updateSectionPowerKeyword = updateGroupPowerKeyword
  const isSectionPowerGroup = isGroupPowerEnabled
  const getSectionPowerKeyword = getGroupPowerKeyword

  // Auto-save groups to IndexedDB via SaveQueueManager (Chief Architect conflict prevention)
  let groupsSaveTimer: ReturnType<typeof setTimeout> | null = null
  watch(groups, (newGroups) => {
    if (groupsSaveTimer) clearTimeout(groupsSaveTimer)
    groupsSaveTimer = setTimeout(async () => {
      try {
        await db.save(DB_KEYS.CANVAS, newGroups)
        console.log('📋 Canvas groups auto-saved via SaveQueueManager')
      } catch (error) {
        console.error('❌ Canvas auto-save failed:', error)
      }
    }, 1000)
  }, { deep: true, flush: 'post' })

  // Initialize groups (empty by default - user creates them)
  const initializeDefaultGroups = () => {
    // Start with empty groups - users create their own
    if (groups.value.length === 0) {
      groups.value = []
    }
  }

  // Preset smart group creators
  const createPriorityGroup = (priority: 'high' | 'medium' | 'low', position: { x: number; y: number }) => {
    const colors = { high: '#ef4444', medium: '#f59e0b', low: '#6366f1' }
    const names = { high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' }

    return createGroup({
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

  const createStatusGroup = (status: 'planned' | 'in_progress' | 'done' | 'backlog', position: { x: number; y: number }) => {
    const colors = { planned: '#6366f1', in_progress: '#f59e0b', done: '#10b981', backlog: '#64748b' }
    const names = { planned: 'Planned', in_progress: 'In Progress', done: 'Done', backlog: 'Backlog' }

    return createGroup({
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

  const createProjectGroup = (projectId: string, projectName: string, color: string, position: { x: number; y: number }) => {
    return createGroup({
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
    return createGroup({
      name: name,
      type: 'custom',
      position: { x: position.x, y: position.y, width, height },
      color: color,
      layout: 'grid',
      isVisible: true,
      isCollapsed: false
    })
  }

  // Backward compatibility aliases for preset creators
  const initializeDefaultSections = initializeDefaultGroups
  const createPrioritySection = createPriorityGroup
  const createStatusSection = createStatusGroup
  const createProjectSection = createProjectGroup

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
  const isPointInGroup = (x: number, y: number, group: CanvasGroup, padding: number = 0): boolean => {
    const { x: gx, y: gy, width, height } = group.position
    return (
      x >= gx - padding &&
      x <= gx + width + padding &&
      y >= gy - padding &&
      y <= gy + height + padding
    )
  }

  const isTaskInGroup = (task: Task, group: CanvasGroup): boolean => {
    if (!task.canvasPosition) return false

    const taskWidth = 220
    const taskHeight = 100
    const taskCenterX = task.canvasPosition.x + taskWidth / 2
    const taskCenterY = task.canvasPosition.y + taskHeight / 2

    return isPointInGroup(taskCenterX, taskCenterY, group)
  }

  // Check if task is logically associated with a group (matches criteria)
  const isTaskLogicallyInGroup = (task: Task, group: CanvasGroup): boolean => {
    return taskMatchesGroup(task, group)
  }

  const getTasksInGroupBounds = (group: CanvasGroup, allTasks: Task[]): Task[] => {
    // For smart groups (priority, status, project), include matching tasks that are ON CANVAS
    // FIXED: Only include tasks with isInInbox === false (explicitly on canvas)
    // FIXED Dec 5, 2025: Also check canvasPosition to match syncNodes() filter
    if (group.type === 'priority' || group.type === 'status' || group.type === 'project') {
      return allTasks.filter(task =>
        isTaskLogicallyInGroup(task, group) &&
        task.isInInbox === false &&  // Only tasks explicitly on canvas
        task.canvasPosition !== undefined  // Must have canvas position to be counted
      )
    }

    // For smart groups (Today, Tomorrow, etc.), include matching tasks that are ON CANVAS
    // FIXED: Only include tasks with isInInbox === false (explicitly on canvas)
    // FIXED Dec 5, 2025: Also check canvasPosition to match syncNodes() filter
    if (group.type === 'custom' && isSmartGroup(group.name)) {
      return allTasks.filter(task =>
        isTaskLogicallyInGroup(task, group) &&
        task.isInInbox === false &&  // Only tasks explicitly on canvas
        task.canvasPosition !== undefined  // Must have canvas position to be counted
      )
    }

    // For custom groups, include both geometrically contained and logically matching tasks
    return allTasks.filter(task => {
      const isInside = isTaskInGroup(task, group)
      const matchesCriteria = isTaskLogicallyInGroup(task, group)
      return isInside || matchesCriteria
    })
  }

  const findNearestGroup = (x: number, y: number, maxDistance: number = 50): CanvasGroup | null => {
    let nearestGroup: CanvasGroup | null = null
    let minDistance = maxDistance

    groups.value.forEach(group => {
      if (!group.isVisible || group.isCollapsed) return

      const { x: gx, y: gy, width, height } = group.position

      // Find closest point on group rectangle to the point
      const closestX = Math.max(gx, Math.min(x, gx + width))
      const closestY = Math.max(gy, Math.min(y, gy + height))

      // Calculate distance
      const distance = Math.sqrt(Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2))

      if (distance < minDistance) {
        minDistance = distance
        nearestGroup = group
      }
    })

    return nearestGroup
  }

  const getMagneticSnapPosition = (task: Task, group: CanvasGroup): { x: number; y: number } => {
    if (!task.canvasPosition) return task.canvasPosition || { x: 0, y: 0 }

    const { x: gx, y: gy, width, height } = group.position
    const taskWidth = 220
    const taskHeight = 100

    // Calculate position inside group with some padding
    const padding = 20
    const headerHeight = 60

    // Simple grid-based positioning inside group
    const existingTasks = getTasksInGroupBounds(group, [] as Task[]) // Will be called from CanvasView with actual tasks
    const cols = Math.floor((width - padding * 2) / (taskWidth + 20))
    const rows = Math.floor((height - headerHeight - padding) / (taskHeight + 20))

    if (cols === 0 || rows === 0) {
      // Group too small, place at top-left with padding
      return { x: gx + padding, y: gy + headerHeight + padding }
    }

    // Find first empty grid position
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const testX = gx + padding + col * (taskWidth + 20)
        const testY = gy + headerHeight + padding + row * (taskHeight + 20)

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
    return { x: gx + padding, y: gy + headerHeight + padding }
  }

  const getTaskCountInGroup = (group: CanvasGroup, allTasks: Task[]): number => {
    // Use the updated getTasksInGroupBounds which now includes logical association
    const associatedTasks = getTasksInGroupBounds(group, allTasks)
    return associatedTasks.length
  }

  // Backward compatibility aliases for magnetic zone utilities
  const isPointInSection = isPointInGroup
  const isTaskInSection = isTaskInGroup
  const isTaskLogicallyInSection = isTaskLogicallyInGroup
  const getTasksInSectionBounds = getTasksInGroupBounds
  const findNearestSection = findNearestGroup
  const getTaskCountInSection = getTaskCountInGroup

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

      const savedGroups = await db.load<CanvasGroup[]>(DB_KEYS.CANVAS)
      if (savedGroups && savedGroups.length > 0) {
        // Migrate old propertyValue to new assignOnDrop format
        const migratedGroups = savedGroups.map(group => {
          // Migrate old section- prefix IDs to group- prefix (backward compatibility)
          if (group.id && group.id.startsWith('section-')) {
            group.id = group.id.replace('section-', 'group-')
            console.log(`🔄 Migrated group ID from section- to group- prefix`)
          }

          // Skip if already has assignOnDrop settings
          if (group.assignOnDrop) return group

          // Migrate based on group type and propertyValue
          if (group.propertyValue) {
            const assignOnDrop: AssignOnDropSettings = {}

            if (group.type === 'priority') {
              assignOnDrop.priority = group.propertyValue as 'high' | 'medium' | 'low'
            } else if (group.type === 'status') {
              assignOnDrop.status = group.propertyValue as Task['status']
            } else if (group.type === 'project') {
              assignOnDrop.projectId = group.propertyValue
            } else if (group.type === 'timeline') {
              // Timeline groups use date keywords
              assignOnDrop.dueDate = group.propertyValue
            }

            if (Object.keys(assignOnDrop).length > 0) {
              group.assignOnDrop = assignOnDrop
              console.log(`🔄 Migrated group "${group.name}" to assignOnDrop format`)
            }
          }

          // Also migrate power keyword detection to assignOnDrop if power mode is enabled
          if (group.isPowerMode && group.powerKeyword && !group.assignOnDrop) {
            const { category, value } = group.powerKeyword
            const assignOnDrop: AssignOnDropSettings = {}

            if (category === 'date') {
              assignOnDrop.dueDate = value
            } else if (category === 'priority') {
              assignOnDrop.priority = value as 'high' | 'medium' | 'low'
            } else if (category === 'status') {
              assignOnDrop.status = value as Task['status']
            }

            if (Object.keys(assignOnDrop).length > 0) {
              group.assignOnDrop = assignOnDrop
              console.log(`🔄 Migrated power group "${group.name}" to assignOnDrop format`)
            }
          }

          return group
        })

        groups.value = migratedGroups
        console.log(`📂 Loaded ${groups.value.length} canvas groups from IndexedDB`)
      }
    } catch (error) {
      console.warn('⚠️ Failed to load canvas from database:', error)
    }
  }

  
  // Undo/Redo enabled actions - simplified to avoid circular dependencies
  const undoRedoEnabledActions = () => {
    // Create local references to ensure proper closure access
    const localUpdateGroup = (groupId: string, updates: Partial<CanvasGroup>) => updateGroup(groupId, updates)
    const localToggleGroupCollapse = (groupId: string) => toggleGroupCollapse(groupId)
    const localToggleGroupVisibility = (groupId: string) => toggleGroupVisibility(groupId)
    const localSetViewport = (x: number, y: number, zoom: number) => setViewport(x, y, zoom)
    const localSetSelectedNodes = (nodeIds: string[]) => setSelectedNodes(nodeIds)
    const localToggleNodeSelection = (nodeId: string) => toggleNodeSelection(nodeId)
    const localClearSelection = () => clearSelection()
    const localToggleConnectMode = () => toggleConnectMode()
    const localStartConnection = (nodeId: string) => startConnection(nodeId)
    const localClearConnection = () => clearConnection()

    // Group actions with undo/redo (new primary names)
    const createGroupWithUndo = async (group: Omit<CanvasGroup, 'id'>) => {
      try {
        const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
        const useUnifiedUndoRedo = await getUndoRedoComposable()
        const actions = useUnifiedUndoRedo()
        // Try new name first, fallback to old name for compatibility
        return actions.createGroup ? actions.createGroup(group) : actions.createSection(group)
      } catch (error) {
        console.warn('Undo/Redo system not available, using direct updates:', error)
        return createGroup(group)
      }
    }

    const updateGroupWithUndo = async (groupId: string, updates: Partial<CanvasGroup>) => {
      try {
        const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
        const useUnifiedUndoRedo = await getUndoRedoComposable()
        const actions = useUnifiedUndoRedo()
        const fn = actions.updateGroup || actions.updateSection
        if (fn && typeof fn === 'function') {
          return await fn(groupId, updates)
        } else {
          return localUpdateGroup(groupId, updates)
        }
      } catch (_error) {
        return localUpdateGroup(groupId, updates)
      }
    }

    const deleteGroupWithUndo = async (groupId: string) => {
      // Unified undo/redo doesn't support group deletion yet
      // Using direct deletion for now
      return deleteGroup(groupId)
    }

    const toggleGroupVisibilityWithUndo = async (groupId: string) => {
      try {
        const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
        const useUnifiedUndoRedo = await getUndoRedoComposable()
        const actions = useUnifiedUndoRedo()
        const fn = actions.toggleGroupVisibility || actions.toggleSectionVisibility
        return fn(groupId)
      } catch (error) {
        console.warn('Undo/Redo system not available, using direct updates:', error)
        return localToggleGroupVisibility(groupId)
      }
    }

    const toggleGroupCollapseWithUndo = async (groupId: string) => {
      try {
        const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
        const useUnifiedUndoRedo = await getUndoRedoComposable()
        const actions = useUnifiedUndoRedo()
        const fn = actions.toggleGroupCollapse || actions.toggleSectionCollapse
        return fn(groupId)
      } catch (error) {
        console.warn('Undo/Redo system not available, using direct updates:', error)
        return localToggleGroupCollapse(groupId)
      }
    }

    return {
      // Primary group actions with undo/redo
      createGroupWithUndo,
      updateGroupWithUndo,
      deleteGroupWithUndo,
      toggleGroupVisibilityWithUndo,
      toggleGroupCollapseWithUndo,

      // Backward compatibility aliases for section naming
      createSectionWithUndo: createGroupWithUndo,
      updateSectionWithUndo: updateGroupWithUndo,
      deleteSectionWithUndo: deleteGroupWithUndo,
      toggleSectionVisibilityWithUndo: toggleGroupVisibilityWithUndo,
      toggleSectionCollapseWithUndo: toggleGroupCollapseWithUndo,

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
    // State - Primary (new names)
    viewport,
    selectedNodeIds,
    connectMode,
    connectingFrom,
    groups,              // Primary state name
    activeGroupId,       // Primary state name
    showGroupGuides,     // Primary state name
    snapToGroups,        // Primary state name
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

    // State - Backward compatibility aliases
    sections,            // Alias for groups
    activeSectionId,     // Alias for activeGroupId
    showSectionGuides,   // Alias for showGroupGuides
    snapToSections,      // Alias for snapToGroups

    // Primary actions (new names - without undo/redo for internal use)
    setViewport,
    setViewportWithHistory,
    setSelectedNodes,
    toggleConnectMode,
    startConnection,
    clearConnection,
    createGroup,         // Primary method name
    updateGroup,         // Primary method name
    deleteGroup,         // Primary method name
    toggleGroupVisibility,   // Primary method name
    toggleGroupCollapse,     // Primary method name
    setActiveGroup,          // Primary method name
    getTasksInGroup,         // Primary method name
    taskMatchesGroup,        // Primary method name
    toggleAutoCollect,

    // Backward compatibility method aliases
    createSection,           // Alias for createGroup
    updateSection,           // Alias for updateGroup
    deleteSection,           // Alias for deleteGroup
    toggleSectionVisibility, // Alias for toggleGroupVisibility
    toggleSectionCollapse,   // Alias for toggleGroupCollapse
    setActiveSection,        // Alias for setActiveGroup
    getTasksInSection,       // Alias for getTasksInGroup
    taskMatchesSection,      // Alias for taskMatchesGroup

    // Power group functions (primary names)
    togglePowerMode,
    updateGroupPowerKeyword,     // Primary method name
    isGroupPowerEnabled,         // Primary method name
    getGroupPowerKeyword,        // Primary method name
    getMatchingTasksForPowerGroup,
    getMatchingTaskCount,
    collectMatchingTasks,
    getPowerGroupUpdates,

    // Power group backward compatibility aliases
    updateSectionPowerKeyword,   // Alias for updateGroupPowerKeyword
    isSectionPowerGroup,         // Alias for isGroupPowerEnabled
    getSectionPowerKeyword,      // Alias for getGroupPowerKeyword

    // Preset group creators (primary names)
    initializeDefaultGroups,     // Primary method name
    createPriorityGroup,         // Primary method name
    createStatusGroup,           // Primary method name
    createProjectGroup,          // Primary method name
    createCustomGroup,

    // Preset creator backward compatibility aliases
    initializeDefaultSections,   // Alias for initializeDefaultGroups
    createPrioritySection,       // Alias for createPriorityGroup
    createStatusSection,         // Alias for createStatusGroup
    createProjectSection,        // Alias for createProjectGroup

    // Multi-selection
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

    // Magnetic zone utilities (primary names)
    isPointInGroup,              // Primary method name
    isTaskInGroup,               // Primary method name
    isTaskLogicallyInGroup,      // Primary method name
    getTasksInGroupBounds,       // Primary method name
    findNearestGroup,            // Primary method name
    getMagneticSnapPosition,
    getTaskCountInGroup,         // Primary method name
    getCollapsedTaskCount,

    // Magnetic zone backward compatibility aliases
    isPointInSection,            // Alias for isPointInGroup
    isTaskInSection,             // Alias for isTaskInGroup
    isTaskLogicallyInSection,    // Alias for isTaskLogicallyInGroup
    getTasksInSectionBounds,     // Alias for getTasksInGroupBounds
    findNearestSection,          // Alias for findNearestGroup
    getTaskCountInSection,       // Alias for getTaskCountInGroup

    // Task synchronization
    syncTasksToCanvas,

    // External sync trigger (for undo/redo system)
    syncTrigger,
    requestSync,

    // Undo/Redo enabled actions (includes both new and backward compat names)
    ...undoRedoEnabledActions()
  }
})
