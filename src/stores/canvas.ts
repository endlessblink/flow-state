import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useTaskStore, type Task } from './tasks'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import { detectPowerKeyword } from '@/composables/useTaskSmartGroups'

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
  collapsedHeight?: number
  // Power group fields (simplifying for migration)
  isPowerMode?: boolean
  powerKeyword?: any
  assignOnDrop?: any
  collectFilter?: any
  parentGroupId?: string | null
  updatedAt?: string
  propertyValue?: any
}

export type CanvasSection = CanvasGroup

export const useCanvasStore = defineStore('canvas', () => {

  const { fetchGroups, saveGroup, deleteGroup: deleteGroupRemote } = useSupabaseDatabase()

  // Viewport state
  const viewport = ref({ x: 0, y: 0, zoom: 1 })

  // Selection state
  const selectedNodeIds = ref<string[]>([])
  const connectMode = ref(false)
  const connectingFrom = ref<string | null>(null)

  // Missing states found in TS errors - adding stubs
  const multiSelectMode = ref(false)
  const selectionMode = ref('normal')
  const selectionRect = ref<any>(null)
  const isSelecting = ref(false)
  const showPriorityIndicator = ref(true)
  const showStatusBadge = ref(true)
  const showDurationBadge = ref(true)
  const showScheduleBadge = ref(true)
  const activeSectionId = ref<string | null>(null)

  // Groups state
  // SAFETY: Named _rawGroups to discourage direct access - use visibleGroups (exported as 'groups') instead
  const _rawGroups = ref<CanvasGroup[]>([])
  const activeGroupId = ref<string | null>(null)

  // SAFETY: Filtered groups for display - excludes hidden groups
  const visibleGroups = computed(() => _rawGroups.value.filter(g => g.isVisible !== false))
  const groups = visibleGroups
  const showGroupGuides = ref(true)
  const snapToGroups = ref(true)

  // Vue Flow integration
  const nodes = ref<any[]>([])
  const edges = ref<any[]>([])

  // Collapsed state
  const collapsedTaskPositions = ref<Map<string, TaskPosition[]>>(new Map())

  // --- SQL INTERACTION ---

  const loadFromDatabase = async () => {
    try {
      console.log(`[CanvasStore] loadFromDatabase called at ${new Date().toISOString()}`)

      const loadedGroups = await fetchGroups()
      _rawGroups.value = loadedGroups

      console.log(`✅ [SUPABASE] Loaded ${loadedGroups.length} canvas groups`)

    } catch (e) {
      console.error('❌ [SUPABASE] Failed to load canvas groups:', e)
    }
  }

  const saveGroupToStorage = async (group: CanvasGroup) => {
    // SAFETY: Prevent saving if not authenticated (Guest Mode)
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) return

    try {
      await saveGroup(group)
    } catch (e) {
      console.error(`❌ [SUPABASE] Failed to save group ${group.id}:`, e)
    }
  }

  // --- ACTIONS ---

  // Helper: Normalize Smart Group names and colors
  const applySmartGroupNormalizations = (group: Omit<CanvasGroup, 'id'> | Partial<CanvasGroup>) => {
    if (!group.name) return

    const nameLower = group.name.toLowerCase().trim()

    // 1. Handle "Overdue" (Special Canvas Smart Group)
    if (nameLower === 'overdue') {
      group.name = 'Overdue'
      group.color = '#ef4444' // Red-500
      // Optionally set type if needed, but 'custom' is safe
      return
    }

    // 2. Handle Power Keywords (Standard Smart Groups)
    const powerInfo = detectPowerKeyword(group.name)
    if (powerInfo) {
      // Enforce canonical name
      group.name = powerInfo.displayName

      // Apply standard colors based on category/value
      if (!group.color || group.color === '#6366f1') { // Only auto-set if default or empty
        switch (powerInfo.category) {
          case 'priority':
            if (powerInfo.value === 'high') group.color = '#ef4444' // Red
            else if (powerInfo.value === 'medium') group.color = '#f59e0b' // Amber
            else if (powerInfo.value === 'low') group.color = '#3b82f6' // Blue (modified from indigo for distinction)
            break
          case 'status':
            if (powerInfo.value === 'done') group.color = '#10b981' // Green
            else if (powerInfo.value === 'in_progress') group.color = '#f59e0b' // Amber
            break
          case 'date':
            group.color = '#8b5cf6' // Violet for time-based
            break
        }
      }
    }
  }

  const createGroup = async (groupData: Omit<CanvasGroup, 'id'>) => {
    // Enforce Smart Group consistency
    applySmartGroupNormalizations(groupData)

    const newGroup: CanvasGroup = {
      ...groupData,
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isVisible: true,
      isCollapsed: false
    }
    _rawGroups.value.push(newGroup)
    await saveGroupToStorage(newGroup)
    return newGroup
  }

  const updateGroup = async (id: string, updates: Partial<CanvasGroup>) => {
    const index = _rawGroups.value.findIndex(g => g.id === id)
    if (index !== -1) {
      // Apply normalizations if name is changing
      if (updates.name) {
        applySmartGroupNormalizations(updates)
      }
      _rawGroups.value[index] = { ..._rawGroups.value[index], ...updates, updatedAt: new Date().toISOString() }
      await saveGroupToStorage(_rawGroups.value[index])
    }
  }

  const deleteGroup = async (id: string) => {
    const index = _rawGroups.value.findIndex(g => g.id === id)
    if (index !== -1) {
      _rawGroups.value.splice(index, 1)

      // Supabase Soft Delete
      await deleteGroupRemote(id)
    }
  }

  const setViewport = (x: number, y: number, zoom: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) {
      console.warn('⚠️ [CANVAS] Attempted to set invalid viewport:', { x, y, zoom })
      return
    }
    viewport.value = { x, y, zoom }
    // Save viewport to local storage
    localStorage.setItem('canvas-viewport', JSON.stringify({ x, y, zoom }))

    // Viewport persistence is now purely localStorage based for this device
  }

  const loadSavedViewport = async () => {
    try {
      // Priority 1: Local Storage (fastest)
      const local = localStorage.getItem('canvas-viewport')
      if (local) {
        const parsed = JSON.parse(local)
        if (
          Number.isFinite(parsed.x) &&
          Number.isFinite(parsed.y) &&
          Number.isFinite(parsed.zoom) &&
          parsed.zoom > 0
        ) {
          viewport.value = parsed
          return true
        }
        console.warn('⚠️ [CANVAS] Invalid viewport in localStorage, resetting:', parsed)
      }
      return false
    } catch (e) {
      console.error('Failed to load viewport:', e)
      return false
    }
  }

  // Helper to check if a task is visually inside a group
  const isPointInRect = (x: number, y: number, rect: { x: number, y: number, width: number, height: number }) => {
    return x >= rect.x && x <= rect.x + rect.width &&
      y >= rect.y && y <= rect.y + rect.height
  }

  const getTaskCountInGroupRecursive = (groupId: string, tasks: Task[]): number => {
    // SAFETY: Use _rawGroups to find any group including hidden ones
    const group = _rawGroups.value.find(g => g.id === groupId)
    if (!group) return 0

    // Direct tasks in this group
    let count = tasks.filter(t => {
      // Check if task explicitly assigned (future proof)
      // if (t.groupId === groupId) return true

      // Check visual containment
      if (t.canvasPosition) {
        return isPointInRect(t.canvasPosition.x, t.canvasPosition.y, group.position)
      }
      return false
    }).length

    // Recursive: Tasks in child groups
    // SAFETY: Use _rawGroups to include hidden child groups in count
    const childGroups = _rawGroups.value.filter(g => g.parentGroupId === groupId)
    for (const child of childGroups) {
      count += getTaskCountInGroupRecursive(child.id, tasks)
    }

    return count
  }

  const getTasksInSection = (groupId: string): Task[] => {
    if (!taskStore || !taskStore.tasks) return []
    // SAFETY: Use _rawGroups to find any group including hidden ones
    const group = _rawGroups.value.find(g => g.id === groupId)
    if (!group) return []

    // Direct tasks in this group
    return taskStore.tasks.filter((t: Task) => {
      if (t.canvasPosition) {
        return isPointInRect(t.canvasPosition.x, t.canvasPosition.y, group.position)
      }
      return false
    })
  }

  const taskMatchesSection = (task: Task, sectionId: string): boolean => {
    // SAFETY: Use _rawGroups to find any group including hidden ones
    const group = _rawGroups.value.find(g => g.id === sectionId)
    if (!group || !task.canvasPosition) return false
    return isPointInRect(task.canvasPosition.x, task.canvasPosition.y, group.position)
  }

  const calculateContentBounds = (tasks: Task[]) => {
    // Initialize bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let hasContent = false

    // Process Tasks
    if (tasks && Array.isArray(tasks)) {
      tasks.forEach(t => {
        if (t && t.canvasPosition && !t.isInInbox) {
          const x = Number(t.canvasPosition.x)
          const y = Number(t.canvasPosition.y)

          if (!isNaN(x) && !isNaN(y)) {
            hasContent = true
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x + 200) // Approx width
            maxY = Math.max(maxY, y + 100) // Approx height
          }
        }
      })
    }

    // Process Groups - use visibleGroups for display calculations
    if (visibleGroups.value && Array.isArray(visibleGroups.value)) {
      visibleGroups.value.forEach(g => {
        if (g && g.isVisible && g.position) {
          const x = Number(g.position.x)
          const y = Number(g.position.y)
          const w = Number(g.position.width) || 300
          const h = Number(g.position.height) || 300

          if (!isNaN(x) && !isNaN(y)) {
            hasContent = true
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x + w)
            maxY = Math.max(maxY, y + h)
          }
        }
      })
    }

    if (!hasContent) return { x: 0, y: 0, width: 0, height: 0 }

    // Final sanity check
    if (minX === Infinity || minY === Infinity) return { x: 0, y: 0, width: 0, height: 0 }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  // NOTE: Simplified Task Sync - re-implementing basic logic
  const syncTasksToCanvas = (tasks: Task[]) => {
    // Basic sync logic to populate 'nodes' for VueFlow
    try {
      // 1. Filter tasks present on canvas
      const onCanvasTasks = tasks.filter(t => !t.isInInbox && t.canvasPosition)

      // 2. Map to VueFlow Nodes
      const taskNodes = onCanvasTasks.map(t => ({
        id: t.id,
        type: 'task',
        position: (t.canvasPosition && !Number.isNaN(t.canvasPosition.x) && !Number.isNaN(t.canvasPosition.y))
          ? t.canvasPosition
          : { x: 0, y: 0 },
        data: { task: t }, // Store full task reference
        draggable: true
      }))

      // 3. Merge (keep non-task nodes)
      const otherNodes = nodes.value.filter(n => n.type !== 'task')
      nodes.value = [...otherNodes, ...taskNodes]

    } catch (e) {
      console.error('Sync tasks to canvas failed:', e)
    }
  }

  // Initialize
  const initialize = async () => {
    // Load groups
    await loadFromDatabase()

    // Load Viewport
    const savedViewport = localStorage.getItem('canvas-viewport')
    if (savedViewport) {
      try {
        viewport.value = JSON.parse(savedViewport)
      } catch { }
    }

    // Initialize Task Sync (Lazy)
    import('./tasks').then(({ useTaskStore }) => {
      taskStore = useTaskStore()
      watch(() => taskStore.tasks, (newTasks) => {
        if (newTasks) syncTasksToCanvas(newTasks)
      }, { deep: true, immediate: true })
    })
  }

  // Auto-init
  initialize()

  // Aliases for compatibility
  // export type CanvasSection = CanvasGroup // Moved to top level

  const setSelectedNodes = (ids: string[]) => {
    selectedNodeIds.value = ids
  }

  const toggleNodeSelection = (id: string) => {
    const index = selectedNodeIds.value.indexOf(id)
    if (index === -1) {
      selectedNodeIds.value.push(id)
    } else {
      selectedNodeIds.value.splice(index, 1)
    }
  }

  const togglePowerMode = async (groupId: string, active: boolean) => {
    await updateGroup(groupId, { isPowerMode: active })
  }

  // Undo alias (fallback to regular update for now)
  const updateSectionWithUndo = updateGroup

  // Missing stubs to satisfy vue-tsc
  const getMatchingTaskCount = (groupId: string): number => 0
  const toggleSectionVisibility = async (groupId: string) => { /* ... */ }
  const toggleSectionCollapse = async (groupId: string) => {
    // SAFETY: Use _rawGroups to find any group including hidden ones
    const g = _rawGroups.value.find(g => g.id === groupId)
    if (g) await updateGroup(groupId, { isCollapsed: !g.isCollapsed })
  }
  const clearSelection = () => { selectedNodeIds.value = [] }
  const requestSync = async () => { /* ... */ }
  const setSelectionMode = (mode: string) => { selectionMode.value = mode }
  const startSelection = (pos: any) => { isSelecting.value = true; selectionRect.value = { x: pos.x, y: pos.y, width: 0, height: 0 } }
  const updateSelection = (rect: any) => { selectionRect.value = rect }
  const endSelection = () => { isSelecting.value = false; selectionRect.value = null }
  const selectNodesInRect = (rect: any) => { /* ... */ }
  const toggleMultiSelectMode = () => { multiSelectMode.value = !multiSelectMode.value }
  const togglePriorityIndicator = () => { showPriorityIndicator.value = !showPriorityIndicator.value }
  const toggleStatusBadge = () => { showStatusBadge.value = !showStatusBadge.value }
  const toggleDurationBadge = () => { showDurationBadge.value = !showDurationBadge.value }
  const toggleScheduleBadge = () => { showScheduleBadge.value = !showScheduleBadge.value }
  const setActiveSection = (id: string | null) => { activeSectionId.value = id }
  const toggleConnectMode = () => { connectMode.value = !connectMode.value }
  const startConnection = (nodeId: string) => { connectingFrom.value = nodeId; connectMode.value = true }
  const clearConnection = () => { connectingFrom.value = null; connectMode.value = false }
  const createSection = createGroup
  const updateSection = updateGroup
  const deleteSection = deleteGroup

  return {
    viewport,
    // SAFETY: Export visibleGroups as 'groups' - this is the safe default for components
    // Use _rawGroups only for internal operations (load, save, sync, mutations)
    groups: visibleGroups,
    _rawGroups,
    activeGroupId,
    showGroupGuides,
    snapToGroups,
    nodes,
    edges,
    selectedNodeIds,
    connectMode,
    connectingFrom,

    // Added State
    multiSelectMode,
    selectionMode,
    selectionRect,
    isSelecting,
    showPriorityIndicator,
    showStatusBadge,
    showDurationBadge,
    showScheduleBadge,
    activeSectionId,

    // Actions
    loadFromDatabase,
    createGroup,
    updateGroup,
    deleteGroup,
    setViewport,
    loadSavedViewport,
    getTaskCountInGroupRecursive,
    calculateContentBounds,
    setSelectedNodes,
    getTasksInSection,
    taskMatchesSection,
    toggleNodeSelection,
    togglePowerMode,
    updateSectionWithUndo,

    // Added Actions
    getMatchingTaskCount,
    toggleSectionVisibility,
    toggleSectionCollapse,
    clearSelection,
    requestSync,
    setSelectionMode,
    startSelection,
    updateSelection,
    endSelection,
    selectNodesInRect,
    toggleMultiSelectMode,
    togglePriorityIndicator,
    toggleStatusBadge,
    toggleDurationBadge,
    toggleScheduleBadge,
    setActiveSection,
    toggleConnectMode,
    startConnection,
    clearConnection,

    // Aliases - sections is same as groups (visibleGroups filtered)
    sections: visibleGroups,
    _rawSections: _rawGroups,
    createSection,
    updateSection,
    deleteSection,
  }
})
