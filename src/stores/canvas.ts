import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabaseV2'
// Force HMR update
import { type Task } from './tasks'
import { detectPowerKeyword } from '@/composables/useTaskSmartGroups'
// TASK-CUSTOM: Import optimistic sync for patchGroupschecks
import { useCanvasOptimisticSync } from '@/composables/canvas/useCanvasOptimisticSync'
import { getAbsoluteNodePosition, getGroupAbsolutePosition, isPointInRect } from '@/utils/canvas/positionCalculator'
import type {
  GroupFilter,
  TaskPosition,
  AssignOnDropSettings,
  CollectFilterSettings,
  CanvasGroup,
  CanvasSection
} from './canvas/types'

// Re-export types for consumers
export type {
  GroupFilter,
  TaskPosition,
  AssignOnDropSettings,
  CollectFilterSettings,
  CanvasGroup,
  CanvasSection
}

// Task store import for safe sync functionality
let taskStore: any = null

export const useCanvasStore = defineStore('canvas', () => {

  const { fetchGroups, saveGroup, deleteGroup: deleteGroupRemote } = useSupabaseDatabase()

  // TASK-155 FIX: Initialize viewport with defaults - DON'T load from localStorage synchronously
  // Viewport is loaded asynchronously from Supabase after auth is ready via loadSavedViewport()
  // This prevents stale localStorage viewport from showing before Supabase data is loaded
  const getDefaultViewport = () => ({ x: 0, y: 0, zoom: 1 })

  const viewport = ref(getDefaultViewport())
  const zoomConfig = ref({ minZoom: 0.1, maxZoom: 4.0 })

  // Selection state
  const selectedNodeIds = ref<string[]>([])
  const skipNextSelectionChange = ref(false) // Flag to prevent Vue Flow overriding manual Ctrl+click
  const connectMode = ref(false)
  const connectingFrom = ref<string | null>(null)

  // Missing states found in TS errors - adding stubs (Restored for compatibility)
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
  const syncTrigger = ref(0)

  // SAFETY: Filtered groups for display - excludes hidden groups
  const visibleGroups = computed(() => _rawGroups.value.filter(g => g.isVisible !== false))
  const showGroupGuides = ref(true)
  const snapToGroups = ref(true)

  // Vue Flow integration
  const nodes = ref<any[]>([])
  const edges = ref<any[]>([])

  // --- SQL INTERACTION ---

  // TASK-130: LocalStorage key for Guest Mode group persistence
  const GUEST_GROUPS_KEY = 'pomoflow-guest-groups'

  // TASK-130: Save groups to localStorage for Guest Mode
  const saveGroupsToLocalStorage = () => {
    try {
      localStorage.setItem(GUEST_GROUPS_KEY, JSON.stringify(_rawGroups.value))
    } catch (e) {
      console.error('❌ [GUEST-MODE] Failed to save groups to localStorage:', e)
    }
  }

  // TASK-130: Load groups from localStorage for Guest Mode
  const loadGroupsFromLocalStorage = (): CanvasGroup[] => {
    try {
      const stored = localStorage.getItem(GUEST_GROUPS_KEY)
      if (stored) {
        const groups = JSON.parse(stored) as CanvasGroup[]
        return groups
      }
    } catch (e) {
      console.error('❌ [GUEST-MODE] Failed to load groups from localStorage:', e)
    }
    return []
  }

  const loadFromDatabase = async () => {
    try {

      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()

      // Guest mode: load from localStorage (persists across refreshes)
      if (!authStore.isAuthenticated) {
        const localGroups = loadGroupsFromLocalStorage()
        _rawGroups.value = localGroups
        return
      }

      // TASK-142 FIX: ALWAYS try Supabase first - it has the most up-to-date positions
      // Only fall back to localStorage if Supabase fails or returns empty
      const loadedGroups = await fetchGroups()

      // TASK-142: Position integrity validation - detect invalid positions early
      const invalidGroups = loadedGroups.filter(g =>
        !g.position ||
        !Number.isFinite(g.position.x) ||
        !Number.isFinite(g.position.y) ||
        !Number.isFinite(g.position.width) ||
        !Number.isFinite(g.position.height)
      )
      if (invalidGroups.length > 0) {
        console.error(`❌ [INTEGRITY] ${invalidGroups.length} groups have invalid positions:`,
          invalidGroups.map(g => `${g.name}: ${JSON.stringify(g.position)}`))

        // Auto-repair invalid positions
        loadedGroups.forEach(g => {
          if (!g.position || !Number.isFinite(g.position.x) || !Number.isFinite(g.position.y)) {
            console.warn(`🛠️ [INTEGRITY] Auto-repairing position for group ${g.name}`)
            g.position = { x: 0, y: 0, width: g.position?.width || 600, height: g.position?.height || 400 }
          }
        })
      }

      // TASK-150 FIX: When authenticated, Supabase is the source of truth
      // Don't fall back to localStorage which may have stale/deleted groups

      // BUG-169 FIX: Safety guard - don't overwrite existing groups with empty array
      // during the first 10 seconds of the session (prevents auth race conditions)
      if (loadedGroups.length === 0 && _rawGroups.value.length > 0) {
        const sessionStart = typeof window !== 'undefined' ? (window as any).PomoFlowSessionStart || 0 : 0
        const timeSinceSessionStart = Date.now() - sessionStart

        if (timeSinceSessionStart < 10000) {
          console.warn(`🛡️ [GROUP-LOAD] BLOCKED empty overwrite - ${_rawGroups.value.length} existing groups would be lost (session ${timeSinceSessionStart}ms old)`)
          return
        }

        console.warn(`⚠️ [GROUP-LOAD] Supabase returned 0 groups but ${_rawGroups.value.length} exist locally - proceeding with empty (session ${timeSinceSessionStart}ms old)`)
      }

      _rawGroups.value = loadedGroups

      if (loadedGroups.length > 0) {

        // TASK-142 DEBUG: Log positions of loaded groups
        loadedGroups.forEach(g => {
        })
      } else {
      }

      // NOTE: Authenticated users use Supabase as single source of truth
      // No localStorage fallback - empty means empty

    } catch (e) {
      console.error('❌ [SUPABASE] Failed to load canvas groups:', e)

      // TASK-130: Fallback to localStorage on Supabase failure
      const localGroups = loadGroupsFromLocalStorage()
      if (localGroups.length > 0) {
        _rawGroups.value = localGroups
      }
    }
  }

  const saveGroupToStorage = async (group: CanvasGroup) => {

    // Always save to localStorage for persistence across refreshes
    saveGroupsToLocalStorage()

    try {
      await saveGroup(group)
    } catch (e) {
      // Supabase failed or skipped (guest mode) - localStorage backup is still saved
      console.debug(`⏭️ [GROUP-SAVE] Supabase skipped/failed - localStorage backup saved`)
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

      // Save to localStorage for guest mode persistence
      saveGroupsToLocalStorage()

      // Supabase Soft Delete
      await deleteGroupRemote(id)
    }
  }

  const setGroups = (newGroups: CanvasGroup[]) => {
    // TASK-131: Deprecation warning
    if (import.meta.env.DEV) {
      console.warn('⚠️ setGroups() is deprecated. Use patchGroups() to respect position locks.')
    }

    // Guard against empty overwrite (common bug pattern)
    if (newGroups.length === 0 && _rawGroups.value.length > 0) {
      console.error('❌ [CANVAS] Refusing to overwrite existing groups with empty array')
      return
    }

    _rawGroups.value = [...newGroups]
    saveGroupsToLocalStorage()
  }

  /**
   * TASK-131/198: Safe group update API that respects optimistic sync.
   * Use this instead of setGroups() to prevent position resets.
   *
   * @param updates - Map of group ID to partial updates
   * @returns Result object with patched, skipped (locked), and not found IDs
   */
  type PatchableGroupKeys = Exclude<keyof CanvasGroup, 'id'>
  type GroupPatch = Partial<Pick<CanvasGroup, PatchableGroupKeys>>

  interface PatchGroupsResult {
    readonly patched: string[]
    readonly skippedLocked: string[]
    readonly notFound: string[]
  }

  const patchGroups = (updates: Map<string, GroupPatch>): PatchGroupsResult => {
    const result: PatchGroupsResult = {
      patched: [],
      skippedLocked: [],
      notFound: []
    }

    for (const [groupId, changes] of updates) {
      // Check if group has pending local changes (optimistic sync)
      const { getPendingPosition } = useCanvasOptimisticSync()
      const pendingPos = getPendingPosition(groupId)
      if (pendingPos && (changes.position !== undefined)) {
        result.skippedLocked.push(groupId)
        continue
      }

      const group = _rawGroups.value.find(g => g.id === groupId)
      if (!group) {
        result.notFound.push(groupId)
        continue
      }

      // Apply the patch
      Object.assign(group, changes, { updatedAt: new Date().toISOString() })
      result.patched.push(groupId)
    }

    if (result.patched.length > 0) {
      saveGroupsToLocalStorage()
    }

    return result
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

  // TASK-155 FIX: Load viewport from Supabase first, fallback to localStorage for guests
  const loadSavedViewport = async () => {
    try {
      // Priority 1: Supabase user_settings (source of truth for authenticated users)
      const { fetchUserSettings } = useSupabaseDatabase()
      const settings = await fetchUserSettings()
      const savedViewport = settings?.canvas_viewport as { x: number; y: number; zoom: number } | undefined

      if (savedViewport && typeof savedViewport.x === 'number' && Number.isFinite(savedViewport.zoom) && savedViewport.zoom > 0) {
        viewport.value = savedViewport
        return true
      }

      // Priority 2: Local Storage (fallback for guests or if Supabase returns nothing)
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
        console.warn('⚠️ [CANVAS] Invalid viewport in localStorage, using defaults')
      }
      return false
    } catch (e) {
      console.error('Failed to load viewport:', e)
      return false
    }
  }

  // Helper to check if a task is visually inside a group
  // REPLACED by imported isPointInRect

  const getTaskCountInGroupRecursive = (groupId: string, tasks: Task[]): number => {
    // SAFETY: Use _rawGroups to find any group including hidden ones
    const group = _rawGroups.value.find(g => g.id === groupId)
    if (!group) return 0

    // Helper: Calculate absolute position recursively from store data
    // REPLACED by imported getGroupAbsolutePosition
    const getGroupAbsolutePositionHelper = (group: CanvasGroup): { x: number, y: number } => {
      return getGroupAbsolutePosition(group.id, _rawGroups.value)
    }

    // BUG-184c FIX: Get child groups FIRST so we can exclude their tasks from direct count
    // SAFETY: Use _rawGroups to include hidden child groups
    const childGroups = _rawGroups.value.filter(g => g.parentGroupId === groupId)

    // Pre-calculate child group rects for exclusion check
    const childGroupRects = childGroups.map(child => {
      const childAbsPos = getGroupAbsolutePositionHelper(child)
      return {
        x: childAbsPos.x,
        y: childAbsPos.y,
        width: child.position?.width ?? 300,
        height: child.position?.height ?? 200
      }
    })

    // Calculate this group's absolute rect
    const absPos = getGroupAbsolutePositionHelper(group)
    const groupRect = {
      x: absPos.x,
      y: absPos.y,
      width: group.position?.width ?? 300,
      height: group.position?.height ?? 200
    }

    // Direct tasks in this group (EXCLUDING those in child groups)
    let count = tasks.filter(t => {
      if (!t.canvasPosition) return false

      // Get Task Center (Absolute)
      const w = 220
      const h = 100
      const taskCenterX = t.canvasPosition.x + (w / 2)
      const taskCenterY = t.canvasPosition.y + (h / 2)

      // Check if task is in this group's bounds
      if (!isPointInRect(taskCenterX, taskCenterY, groupRect)) return false

      // BUG-184c FIX: Exclude tasks that are in any child group
      // This prevents double-counting: once by parent, once by recursive child call
      const isInChildGroup = childGroupRects.some(childRect =>
        isPointInRect(taskCenterX, taskCenterY, childRect)
      )

      return !isInChildGroup  // Only count if NOT in a child group
    }).length

    // Recursive: Tasks in child groups
    for (const child of childGroups) {
      count += getTaskCountInGroupRecursive(child.id, tasks)
    }

    return count
  }

  const getTasksInSection = (groupId: string, tasks?: Task[]): Task[] => {
    // Determine source tasks: provided tasks > taskStore.tasks > empty
    const sourceTasks = tasks || (taskStore && taskStore.tasks ? taskStore.tasks : [])

    // SAFETY: Use _rawGroups to find any group including hidden ones
    const group = _rawGroups.value.find(g => g.id === groupId)
    if (!group) return []

    // Direct tasks in this group
    return sourceTasks.filter((t: Task) => {
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

  // NOTE: Optimized Task Sync - matching logic from useCanvasSync
  const syncTasksToCanvas = (tasks: Task[]) => {
    try {
      // 1. Filter tasks present on canvas
      const onCanvasTasks = tasks.filter(t => !t.isInInbox && t.canvasPosition)

      // 2. Identify existing nodes to preserve references (crucial for performance)
      const existingTaskNodes = new Map(
        nodes.value
          .filter(n => n.type === 'taskNode' || n.type === 'task')
          .map(n => [n.id, n])
      )

      // 3. Map to VueFlow Nodes using diff/patch strategy
      const updatedTaskNodes = onCanvasTasks.map(t => {
        const existingNode = existingTaskNodes.get(t.id)

        // BUG-022 FIX: Comprehensive field comparison to detect all relevant changes
        if (existingNode) {
          const oldTask = existingNode.data?.task
          const positionUnchanged =
            existingNode.position.x === t.canvasPosition?.x &&
            existingNode.position.y === t.canvasPosition?.y

          // Check ALL fields that affect visual display (matches useCanvasSync.ts pattern)
          const dataUnchanged = oldTask &&
            oldTask.status === t.status &&
            oldTask.priority === t.priority &&
            oldTask.title === t.title &&
            oldTask.updatedAt === t.updatedAt &&
            oldTask.progress === t.progress &&
            oldTask.dueDate === t.dueDate &&
            oldTask.estimatedDuration === t.estimatedDuration

          if (positionUnchanged && dataUnchanged) {
            existingTaskNodes.delete(t.id) // Remove from deletion set
            return existingNode
          }
        }

        // Create new node object but try to preserve internal object shape for V8
        const newNode = {
          id: t.id,
          type: 'taskNode', // Use the optimized component
          position: (t.canvasPosition && !Number.isNaN(t.canvasPosition.x) && !Number.isNaN(t.canvasPosition.y))
            ? { ...t.canvasPosition }
            : { x: 0, y: 0 },
          data: { task: t }, // Store full task reference
          draggable: true,
          connectable: true,
          selectable: true,
          zIndex: 10
        }

        if (existingNode) existingTaskNodes.delete(t.id)
        return newNode
      })

      // 4. Merge: Keep non-task nodes + updated task nodes
      // Filter out task nodes that were NOT in the new list (implicitly handled by rebuilding list)
      const otherNodes = nodes.value.filter(n => n.type !== 'task' && n.type !== 'taskNode')

      // Update store value - Vue will only diff changed object references
      nodes.value = [...otherNodes, ...updatedTaskNodes]

    } catch (e) {
      console.error('Sync tasks to canvas failed:', e)
    }
  }

  // Initialize
  const initialize = async () => {
    // Load groups (removed duplicate call)
    await loadFromDatabase()

    // Viewport is now loaded synchronously during store creation
    // No need to load it here again

    // TASK-131 FIX: DISABLED - This competing watcher caused position resets
    // The deep:true watcher fired on ANY task property change and overwrote locked positions.
    // useCanvasSync.ts in CanvasView.vue handles all sync with proper position locking.
    // Keeping taskStore reference for other operations.
    import('./tasks').then(({ useTaskStore }) => {
      taskStore = useTaskStore()
      // REMOVED: watch(() => taskStore.tasks, ...) - competed with useCanvasSync.ts
      // This was the root cause of BUG-020 regression where task positions reset
    })
  }

  // Auto-init
  initialize()

  // TASK-142 FIX: Watch for auth state changes to reload groups from Supabase
  // This fixes the race condition where canvas loads before auth is ready
  import('@/stores/auth').then(({ useAuthStore }) => {
    const authStore = useAuthStore()

    // Watch for auth becoming ready
    watch(
      () => [authStore.isInitialized, authStore.isAuthenticated],
      async ([isInitialized, isAuthenticated], [, wasAuthenticated]) => {
        // Only reload when:
        // 1. Auth just became initialized (first load)
        // 2. AND user is authenticated
        // 3. AND groups were loaded from Guest Mode (localStorage)
        if (isInitialized && isAuthenticated && !wasAuthenticated) {

          // Force reload from Supabase (not localStorage)
          try {
            const loadedGroups = await fetchGroups()

            // BUG-169 FIX: Safety guard - don't overwrite existing groups with empty array
            // during the first 10 seconds of the session (prevents auth race conditions)
            if (loadedGroups.length === 0 && _rawGroups.value.length > 0) {
              const sessionStart = typeof window !== 'undefined' ? (window as any).PomoFlowSessionStart || 0 : 0
              const timeSinceSessionStart = Date.now() - sessionStart

              if (timeSinceSessionStart < 10000) {
                console.warn(`🛡️ [AUTH-WATCHER] BLOCKED empty overwrite - ${_rawGroups.value.length} existing groups would be lost (session ${timeSinceSessionStart}ms old)`)
                return
              }

              console.warn(`⚠️ [AUTH-WATCHER] Supabase returned 0 groups but ${_rawGroups.value.length} exist locally - proceeding with empty`)
            }

            _rawGroups.value = loadedGroups
            if (loadedGroups.length > 0) {
            } else {
            }
          } catch (e) {
            console.error('❌ [CANVAS] Failed to reload groups after auth:', e)
          }
        }
      },
      { immediate: false }
    )
  })

  // Aliases for compatibility
  // export type CanvasSection = CanvasGroup // Moved to top level

  const setSelectedNodes = (ids: string[]) => {
    selectedNodeIds.value = ids
  }

  const toggleNodeSelection = (id: string) => {
    // Set flag to prevent Vue Flow's @selection-change from overriding this manual toggle
    skipNextSelectionChange.value = true

    const index = selectedNodeIds.value.indexOf(id)
    if (index === -1) {
      selectedNodeIds.value.push(id)
    } else {
      selectedNodeIds.value.splice(index, 1)
    }
  }

  // Undo alias (fallback to regular update for now)
  const updateSectionWithUndo = updateGroup

  // Missing stubs to satisfy vue-tsc
  const getMatchingTaskCount = (_groupId: string, _tasks?: any[]): number => 0
  const toggleSectionVisibility = async (_groupId: string) => { /* ... */ }
  const toggleSectionCollapse = async (groupId: string) => {
    // SAFETY: Use _rawGroups to find any group including hidden ones
    const g = _rawGroups.value.find(g => g.id === groupId)
    if (g) await updateGroup(groupId, { isCollapsed: !g.isCollapsed })
  }
  const clearSelection = () => { selectedNodeIds.value = [] }
  const requestSync = async () => { /* ... */ }
  // Restored Selection methods
  const setSelectionMode = (mode: string) => { selectionMode.value = mode }
  const startSelection = (x: number, y: number) => { isSelecting.value = true; selectionRect.value = { x, y, width: 0, height: 0 } }
  const updateSelection = (x: number, y: number) => {
    if (selectionRect.value) {
      selectionRect.value.width = x - selectionRect.value.x
      selectionRect.value.height = y - selectionRect.value.y
    }
  }
  const endSelection = () => { isSelecting.value = false; selectionRect.value = null }
  const selectNodesInRect = (_rect: any) => { /* ... */ }
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
    zoomConfig,
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
    skipNextSelectionChange, // Flag to prevent Vue Flow overriding manual Ctrl+click
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
    setGroups,
    patchGroups,
    setViewport,
    loadSavedViewport,
    getTaskCountInGroupRecursive,
    calculateContentBounds,
    setSelectedNodes,
    getTasksInSection,
    taskMatchesSection,
    toggleNodeSelection,
    togglePowerMode: async (groupId: string, active?: boolean) => {
      const g = _rawGroups.value.find(g => g.id === groupId)
      const newState = active !== undefined ? active : !(g?.isPowerMode)
      await updateGroup(groupId, { isPowerMode: newState })
    },
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
    syncTrigger,
    syncTasksToCanvas,

    // Aliases - sections is same as groups (visibleGroups filtered)
    sections: visibleGroups,
    _rawSections: _rawGroups,
    createSection,
    updateSection,
    deleteSection,
  }
})
