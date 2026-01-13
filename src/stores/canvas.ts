import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, watch, computed } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
// Force HMR update
import { type Task } from './tasks'
import { detectPowerKeyword } from '@/composables/useTaskSmartGroups'
import { isPointInRect } from '@/utils/canvas/positionCalculator'
import { isNodeCompletelyInside, type ContainerBounds } from '@/utils/canvas/spatialContainment'
import { getGroupAbsolutePosition } from '@/utils/canvas/coordinates'
import { assertNoDuplicateIds } from '@/utils/canvas/invariants'
import { CANVAS } from '@/constants/canvas'
import { type Node } from '@vue-flow/core'
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

/**
 * DIAGNOSTIC HELPER: Log group ID histogram to detect duplicates (AUTHORITATIVE)
 * Called from selectors/computeds to trace where duplicates enter the pipeline
 * Uses assertNoDuplicateIds for consistent detection across layers
 */
const logGroupIdHistogram = (label: string, groups: CanvasGroup[]) => {
  if (!import.meta.env.DEV) return

  const checkResult = assertNoDuplicateIds(groups, label)

  if (checkResult.hasDuplicates) {
    console.error('[GROUP-ID-HISTOGRAM] DUPLICATES', label, {
      duplicates: checkResult.duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
      totalCount: checkResult.totalCount,
      uniqueIdCount: checkResult.uniqueIdCount
    })
  } else if (groups.length > 0) {
    console.debug('[GROUP-ID-HISTOGRAM]', label, {
      uniqueIdCount: checkResult.uniqueIdCount,
      totalCount: checkResult.totalCount
    })
  }
}

// Task store import for safe sync functionality
let taskStore: any = null

/**
 * CYCLE CLEANUP: Break any parent cycles in groups on load
 *
 * This function detects and breaks cyclic parent relationships (A→B→A)
 * that could cause infinite recursion in descendant collection and counting.
 *
 * Called once when loading groups from Supabase to fix any historical cycles.
 */
function breakGroupCycles(groups: CanvasGroup[]): CanvasGroup[] {
  console.log('[GROUPS] breakGroupCycles called with', groups.length, 'groups')

  // Log all parent relationships for debugging
  console.log('[GROUPS] Parent relationships:', groups.map(g => ({
    id: g.id,
    name: g.name,
    parentGroupId: g.parentGroupId
  })))

  const byId = new Map(groups.map(g => [g.id, g]))
  let cyclesBroken = 0

  // Simple direct cycle detection: follow parent chain, detect if we return to start
  for (const g of groups) {
    if (!g.parentGroupId || g.parentGroupId === 'NONE') continue

    const visited = new Set<string>()
    let current: CanvasGroup | undefined = g
    let hasCycle = false

    // Follow parent chain until we find a cycle or reach the root
    while (current && current.parentGroupId && current.parentGroupId !== 'NONE') {
      if (visited.has(current.id)) {
        // We've seen this node before - cycle detected!
        hasCycle = true
        break
      }
      visited.add(current.id)
      current = byId.get(current.parentGroupId)
    }

    // Also check if current is back to g (the starting group)
    if (current && visited.has(current.id)) {
      hasCycle = true
    }

    if (hasCycle) {
      console.warn('[GROUPS] Breaking cycle by clearing parentGroupId', {
        groupId: g.id,
        groupName: g.name,
        oldParentGroupId: g.parentGroupId,
        visitedChain: Array.from(visited),
      })
      g.parentGroupId = null
      cyclesBroken++
    }
  }

  if (cyclesBroken > 0) {
    console.log(`[GROUPS] Broke ${cyclesBroken} parent cycle(s) on load`)
  } else {
    console.log('[GROUPS] No cycles detected in group parents')
  }

  return groups
}

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
  const isDragging = ref(false)
  // NOTE: Debug watch removed - isDragging transitions are now guarded by FSM
  const syncTrigger = ref(0)
  // Optimistic Locking Version Map
  const nodeVersionMap = ref<Map<string, number>>(new Map())

  // SAFETY: Filtered groups for display - excludes hidden groups
  const visibleGroups = computed(() => {
    const result = _rawGroups.value.filter(g => g.isVisible !== false)
    // Log histogram to detect duplicates at selector level
    logGroupIdHistogram('visibleGroups', result)
    return result
  })
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
        // Break any parent cycles before loading
        _rawGroups.value = breakGroupCycles(localGroups)
        return
      }

      // TASK-142 FIX: ALWAYS try Supabase first - it has the most up-to-date positions
      // Only fall back to localStorage if Supabase fails or returns empty
      const loadedGroups = await fetchGroups()

      // ================================================================
      // DUPLICATE DETECTION - Supabase Group Load Layer (AUTHORITATIVE)
      // ================================================================
      // This detects if Supabase itself is returning duplicate group IDs
      // A duplicate here means the bug is at the database level
      if (import.meta.env.DEV) {
        const checkResult = assertNoDuplicateIds(loadedGroups, 'Supabase groups load')

        if (checkResult.hasDuplicates) {
          console.error('[SUPABASE-GROUP-DUPLICATES] Database returned duplicate group IDs!', {
            duplicates: checkResult.duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
            totalCount: checkResult.totalCount,
            uniqueIdCount: checkResult.uniqueIdCount
          })
        }

        console.debug('[GROUP-LOAD-HISTOGRAM]', {
          fromSupabase: checkResult.totalCount,
          uniqueIds: checkResult.uniqueIdCount
        })
      }

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

      // Break any parent cycles before loading
      const cleanedGroups = breakGroupCycles(loadedGroups)
      _rawGroups.value = cleanedGroups

      // Persist any cycle fixes back to Supabase
      const groupsWithBrokenCycles = cleanedGroups.filter((g, i) =>
        g.parentGroupId !== loadedGroups[i]?.parentGroupId
      )
      if (groupsWithBrokenCycles.length > 0) {
        console.log('[GROUPS] Persisting cycle fixes to Supabase for', groupsWithBrokenCycles.length, 'groups')
        for (const g of groupsWithBrokenCycles) {
          saveGroup(g).catch(err =>
            console.error('[GROUPS] Failed to persist cycle fix for', g.id, err)
          )
        }
      }

      // Populate nodeVersionMap with loaded group versions for optimistic locking
      // Defensive: ensure nodeVersionMap.value is a valid Map before clearing
      if (!nodeVersionMap.value || !(nodeVersionMap.value instanceof Map)) {
        nodeVersionMap.value = new Map()
      }
      nodeVersionMap.value.clear()

      // Always initialize version entries (default to 0 if positionVersion is undefined)
      // This ensures syncNodePosition always has a starting version to work with
      loadedGroups.forEach(g => {
        nodeVersionMap.value.set(g.id, g.positionVersion ?? 0)
      })

      // Also populate from taskStore if available
      if (taskStore && taskStore.tasks) {
        taskStore.tasks.forEach((t: any) => {
          nodeVersionMap.value.set(t.id, t.positionVersion ?? 0)
        })
      }

      if (loadedGroups.length > 0) {
        console.log(`📦 [CANVAS] Loaded ${loadedGroups.length} groups, nodeVersionMap size: ${nodeVersionMap.value.size}`)
      }

      // NOTE: Authenticated users use Supabase as single source of truth
      // No localStorage fallback - empty means empty

    } catch (e) {
      console.error('❌ [SUPABASE] Failed to load canvas groups:', e)

      // TASK-130: Fallback to localStorage on Supabase failure
      const localGroups = loadGroupsFromLocalStorage()
      if (localGroups.length > 0) {
        // Break any parent cycles before loading
        _rawGroups.value = breakGroupCycles(localGroups)
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

    // CRITICAL: New groups are ALWAYS top-level (not auto-nested)
    // Nesting should only happen via explicit UX action, not containment detection
    const newGroup: CanvasGroup = {
      ...groupData,
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isVisible: true,
      isCollapsed: false,
      parentGroupId: null, // Explicitly top-level - never auto-nest new groups
      positionVersion: 1, // Start at version 1
      positionFormat: 'absolute' // Always absolute for new groups
    }
    _rawGroups.value.push(newGroup)
    await saveGroupToStorage(newGroup)
    return newGroup
  }

  const updateGroup = async (id: string, updates: Partial<CanvasGroup>) => {
    const index = _rawGroups.value.findIndex(g => g.id === id)
    if (index !== -1) {
      const group = _rawGroups.value[index]

      // DRIFT LOGGING: Track when parentGroupId or position is changed
      // This helps identify non-drag flows that mutate hierarchy/positions
      if ('parentGroupId' in updates && updates.parentGroupId !== group.parentGroupId) {
        console.log(`📍 [GROUP-PARENT-WRITE] Group ${id.slice(0, 8)}... (${group.name}) parentGroupId: "${group.parentGroupId ?? 'none'}" → "${updates.parentGroupId ?? 'none'}"`, {
          stack: new Error().stack?.split('\n').slice(2, 5).join(' <- ')
        })
      }
      if ('position' in updates && updates.position) {
        const oldPos = group.position
        const newPos = updates.position
        if (oldPos?.x !== newPos?.x || oldPos?.y !== newPos?.y) {
          console.log(`📍 [GROUP-POSITION-WRITE] Group ${id.slice(0, 8)}... (${group.name}) pos: (${oldPos?.x?.toFixed(0) ?? '?'},${oldPos?.y?.toFixed(0) ?? '?'}) → (${newPos?.x?.toFixed(0) ?? '?'},${newPos?.y?.toFixed(0) ?? '?'})`, {
            stack: new Error().stack?.split('\n').slice(2, 5).join(' <- ')
          })
        }
      }

      // Apply normalizations if name is changing
      if (updates.name) {
        applySmartGroupNormalizations(updates)
      }

      // TASK-240: Handle position versioning
      const currentVersion = group.positionVersion || 0
      const newVersion = updates.position ? currentVersion + 1 : currentVersion

      _rawGroups.value[index] = {
        ..._rawGroups.value[index],
        ...updates,
        positionVersion: newVersion,
        updatedAt: new Date().toISOString()
      }
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
      // Check if group has pending local changes (optimistic sync: REMOVED)

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

  // Visual Containment Count - counts tasks that are VISUALLY inside the group bounds
  const getTaskCountInGroupRecursive = (groupId: string, tasks: Task[], visited = new Set<string>()): number => {
    // Prevent infinite recursion in cyclic graphs
    if (visited.has(groupId)) {
      console.warn(`🔄 [CANVAS] Cycle detected in group hierarchy at ${groupId}`)
      return 0
    }
    visited.add(groupId)

    const group = _rawGroups.value.find(g => g.id === groupId)
    if (!group) return 0

    // 1. Get ABSOLUTE group position (handles nested groups correctly)
    const groupAbsolutePos = getGroupAbsolutePosition(groupId, _rawGroups.value)

    // 2. Count tasks visually inside this group (using CENTER-based spatial containment)
    const containerBounds: ContainerBounds = {
      position: groupAbsolutePos,
      width: group.position.width,
      height: group.position.height
    }

    let count = tasks.filter(t => {
      if (!t.canvasPosition || t._soft_deleted) return false
      const taskNode = { position: t.canvasPosition }
      const isInside = isNodeCompletelyInside(taskNode, containerBounds)
      return isInside
    }).length

    // 3. Recursive Children (in nested subgroups)
    const childGroups = _rawGroups.value.filter(g => g.parentGroupId === groupId)
    for (const child of childGroups) {
      count += getTaskCountInGroupRecursive(child.id, tasks, visited)
    }

    return count
  }

  const recalculateAllTaskCounts = (tasks: Task[]) => {
    _rawGroups.value.forEach(group => {
      group.taskCount = getTaskCountInGroupRecursive(group.id, tasks)
    })
  }

  /**
   * Reactive version counter - incremented when task parentIds change
   * Used to force recomputation of task counts in computed properties.
   */
  const taskParentVersion = ref(0)

  /**
   * Increment this to force task count recomputation.
   * Call this whenever a task's parentId changes.
   */
  const bumpTaskParentVersion = () => {
    taskParentVersion.value++
  }

  /**
   * Computed: Task counts derived from task.parentId relationship
   *
   * This is the SOURCE OF TRUTH for group task counts.
   * Use this instead of relying on cached taskCount field on groups.
   *
   * REACTIVITY: Depends on taskParentVersion ref to detect parentId changes.
   * Call bumpTaskParentVersion() after updating any task's parentId.
   *
   * @returns Map<groupId, taskCount> - reactive count of tasks per group
   */
  /**
   * Helper: Check if a task is considered "done" for counting purposes
   */
  const isTaskDone = (task: Task): boolean => {
    return task.status === 'done'
  }

  const taskCountByGroupId = computed(() => {
    const counts = new Map<string, number>()

    // Access version to create reactive dependency for parentId changes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _version = taskParentVersion.value

    // taskStore is loaded asynchronously - check if available
    if (!taskStore || !taskStore.tasks) {
      return counts
    }

    // FIX: Explicitly access .length to create reactive dependency on deletions/additions
    // Without this, Vue may not track array mutations (splice) and counts won't update on delete
    const tasks = taskStore.tasks
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _taskCount = tasks.length

    // Count tasks by their parentId (direct membership)
    // Only count non-done tasks (done tasks are excluded from header counts)
    for (const task of tasks) {
      if (task._soft_deleted) continue // Skip deleted tasks
      if (isTaskDone(task)) continue   // Skip done/completed tasks
      if (task.parentId) {
        counts.set(task.parentId, (counts.get(task.parentId) ?? 0) + 1)
      }
    }

    return counts
  })

  /**
   * Get task count for a specific group from the derived counts
   *
   * @param groupId - The group ID to get count for
   * @returns Number of tasks in this group (based on parentId)
   */
  const getTaskCountForGroup = (groupId: string): number => {
    return taskCountByGroupId.value.get(groupId) ?? 0
  }

  /**
   * Get all descendant group IDs for a given root group (depth-first)
   *
   * Returns rootGroupId PLUS all nested child group IDs recursively.
   * Used for aggregating task counts across nested group hierarchies.
   *
   * @param rootGroupId - The root group to start from
   * @param groups - All groups to search through
   * @returns Array of group IDs: [rootGroupId, ...allDescendantIds]
   */
  const getAllDescendantGroupIds = (rootGroupId: string, groups: CanvasGroup[]): string[] => {
    const result: string[] = [rootGroupId]
    const visited = new Set<string>([rootGroupId])

    // Recursive helper to collect descendants
    const collectDescendants = (parentId: string) => {
      const children = groups.filter(g => g.parentGroupId === parentId)
      for (const child of children) {
        if (!visited.has(child.id)) {
          visited.add(child.id)
          result.push(child.id)
          collectDescendants(child.id)
        }
      }
    }

    collectDescendants(rootGroupId)
    return result
  }

  /**
   * Computed: Aggregated task counts that include tasks in descendant groups
   *
   * For nested groups, a parent group's count = sum of:
   * - Tasks directly in that group (parentId === groupId)
   * - Tasks in ALL descendant groups (children, grandchildren, etc.)
   *
   * This is what should be displayed in group headers for accurate counts.
   *
   * REACTIVITY: Depends on taskParentVersion ref to detect parentId changes.
   * Call bumpTaskParentVersion() after updating any task's parentId.
   *
   * @returns Map<groupId, aggregatedCount>
   */
  const aggregatedTaskCountByGroupId = computed(() => {
    const aggregatedCounts = new Map<string, number>()
    const groups = _rawGroups.value

    // Access version to create reactive dependency for parentId changes
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _version = taskParentVersion.value

    // taskStore is loaded asynchronously - check if available
    if (!taskStore || !taskStore.tasks) {
      return aggregatedCounts
    }

    // FIX: Explicitly access .length to create reactive dependency on deletions/additions
    const tasks = taskStore.tasks
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _taskCount = tasks.length

    // Step 1: Pre-index tasks by parentId (direct membership)
    // Only count non-done tasks (done tasks are excluded from header counts)
    const directCountsByGroupId = new Map<string, number>()
    for (const task of tasks) {
      if (task._soft_deleted) continue // Skip deleted tasks
      if (isTaskDone(task)) continue   // Skip done/completed tasks
      if (task.parentId) {
        directCountsByGroupId.set(task.parentId, (directCountsByGroupId.get(task.parentId) ?? 0) + 1)
      }
    }

    // Step 2: For each group, sum counts from itself + all descendants
    for (const group of groups) {
      const descendantIds = getAllDescendantGroupIds(group.id, groups)
      let total = 0
      for (const gid of descendantIds) {
        total += directCountsByGroupId.get(gid) ?? 0
      }
      aggregatedCounts.set(group.id, total)
    }

    return aggregatedCounts
  })

  /**
   * Get aggregated task count for a specific group (includes descendants)
   *
   * @param groupId - The group ID to get aggregated count for
   * @returns Number of tasks in this group + all descendant groups
   */
  const getAggregatedTaskCountForGroup = (groupId: string): number => {
    return aggregatedTaskCountByGroupId.value.get(groupId) ?? 0
  }

  /**
   * DEBUG: Log group hierarchy and task count relationships
   * Call this to trace why nested group counts aren't aggregating correctly
   */
  const debugGroupHierarchy = (groupId: string) => {
    const group = _rawGroups.value.find(g => g.id === groupId)
    console.log('[DEBUG GROUP]', groupId, {
      name: group?.name,
      parentGroupId: group?.parentGroupId,
      exists: !!group
    })

    const children = _rawGroups.value.filter(g => g.parentGroupId === groupId)
    console.log('[DEBUG GROUP CHILDREN]', groupId, children.map(c => ({ id: c.id, name: c.name })))

    // Also log the descendant IDs and counts
    const descendantIds = getAllDescendantGroupIds(groupId, _rawGroups.value)
    console.log('[DEBUG DESCENDANTS]', groupId, descendantIds)

    const aggregatedCount = aggregatedTaskCountByGroupId.value.get(groupId) ?? 0
    console.log('[DEBUG AGGREGATED COUNT]', groupId, aggregatedCount)
  }

  /**
   * DEBUG: Log all aggregated counts at once
   */
  const debugAllAggregatedCounts = () => {
    console.log('[DEBUG COUNTS] All aggregated counts:', Array.from(aggregatedTaskCountByGroupId.value.entries()))
    console.log('[DEBUG GROUPS] All groups:', _rawGroups.value.map(g => ({
      id: g.id,
      name: g.name,
      parentGroupId: g.parentGroupId
    })))
  }

  const getTasksInSection = (groupId: string, tasks?: Task[]): Task[] => {
    // Determine source tasks: provided tasks > taskStore.tasks > empty
    const sourceTasks = tasks || (taskStore && taskStore.tasks ? taskStore.tasks : [])

    // SAFETY: Use _rawGroups to find any group including hidden ones
    const group = _rawGroups.value.find(g => g.id === groupId)
    if (!group) return []

    // Get ABSOLUTE group position (handles nested groups correctly)
    const groupAbsolutePos = getGroupAbsolutePosition(groupId, _rawGroups.value)

    // Direct tasks in this group (using CENTER-based spatial containment with ABSOLUTE bounds)
    const containerBounds: ContainerBounds = {
      position: groupAbsolutePos,
      width: group.position.width,
      height: group.position.height
    }
    return sourceTasks.filter((t: Task) => {
      if (t.canvasPosition) {
        return isNodeCompletelyInside({ position: t.canvasPosition }, containerBounds)
      }
      return false
    })
  }

  const taskMatchesSection = (task: Task, sectionId: string): boolean => {
    // SAFETY: Use _rawGroups to find any group including hidden ones
    const group = _rawGroups.value.find(g => g.id === sectionId)
    if (!group || !task.canvasPosition) return false

    // Get ABSOLUTE group position (handles nested groups correctly)
    const groupAbsolutePos = getGroupAbsolutePosition(sectionId, _rawGroups.value)

    // Use CENTER-based spatial containment with ABSOLUTE bounds
    const containerBounds: ContainerBounds = {
      position: groupAbsolutePos,
      width: group.position.width,
      height: group.position.height
    }
    return isNodeCompletelyInside({ position: task.canvasPosition }, containerBounds)
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
    }).catch((err) => {
      console.error('[ASYNC-ERROR] canvas.ts: Failed to import tasks store', err)
    })
  }

  // Auto-init
  initialize()

  // TASK-142 FIX: Watch for auth state changes to reload groups from Supabase
  // This fixes the race condition where canvas loads before auth is ready
  import('@/stores/auth').then(({ useAuthStore }) => {
    try {
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

              // Break any parent cycles before loading
              _rawGroups.value = breakGroupCycles(loadedGroups)

              // Populate nodeVersionMap with loaded group versions for optimistic locking
              // Defensive: ensure nodeVersionMap.value is a valid Map
              if (!nodeVersionMap.value || !(nodeVersionMap.value instanceof Map)) {
                nodeVersionMap.value = new Map()
              }

              // Always initialize version entries (default to 0 if positionVersion is undefined)
              loadedGroups.forEach(g => {
                nodeVersionMap.value.set(g.id, g.positionVersion ?? 0)
              })

              if (loadedGroups.length > 0) {
                console.log(`📦 [AUTH-WATCHER] Reloaded ${loadedGroups.length} groups, ${nodeVersionMap.value.size} version entries`)
              }
            } catch (e) {
              console.error('❌ [CANVAS] Failed to reload groups after auth:', e)
            }
          }
        },
        { immediate: false }
      )
    } catch (err) {
      console.error('[ASYNC-ERROR] canvas.ts: Failed to setup auth watcher', err)
    }
  }).catch((err) => {
    console.error('[ASYNC-ERROR] canvas.ts: Failed to import auth store', err)
  })

  // === DEV: Watch for duplicate groups in store (AUTHORITATIVE) ===
  // Uses assertNoDuplicateIds for consistent detection across layers
  if (import.meta.env.DEV) {
    watch(_rawGroups, (newGroups) => {
      const checkResult = assertNoDuplicateIds(newGroups, '_rawGroups store')

      if (checkResult.hasDuplicates) {
        // Get more details about the duplicate groups
        const duplicateIds = checkResult.duplicates.map(d => d.id)
        const duplicateGroups = newGroups
          .filter(g => duplicateIds.includes(g.id))
          .slice(0, 5)
          .map(g => ({ id: g.id.slice(0, 8), name: g.name?.slice(0, 20) }))

        console.error('[GROUP-STORE-DUPLICATE-DETECTED]', {
          duplicates: checkResult.duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
          totalCount: checkResult.totalCount,
          uniqueIdCount: checkResult.uniqueIdCount,
          duplicateGroups,
          snapshotSize: newGroups.length
        })
      }
    }, { deep: true }) // TASK-260: Changed to deep: true to catch mutations, not just array replacement
  }

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
  // =========================================================================
  // GEOMETRY WRITE POLICY - CONTROLLED SYNC TRIGGERING (TASK-240 Phase 2.5)
  // =========================================================================
  // requestSync requires a source to prevent automated sync loops.
  // ONLY user-action sources trigger actual sync:
  //   - 'user:drag-drop': After drag operations
  //   - 'user:create': After task/group creation
  //   - 'user:delete': After task/group deletion
  //   - 'user:resize': After group resize
  //   - 'user:manual': Explicit user action
  //
  // BLOCKED sources (do not trigger sync):
  //   - 'smart-group': Smart group metadata changes
  //   - 'watcher': Store watchers
  //   - 'reconcile': One-time reconciliation
  //   - 'auto': Automatic operations
  // =========================================================================
  const USER_ACTION_SOURCES = [
    'user:drag-drop', 'user:create', 'user:delete', 'user:undo', 'user:redo',
    'user:resize', 'user:connect', 'user:context-menu', 'user:manual'
  ] as const
  type SyncSource = typeof USER_ACTION_SOURCES[number] | 'smart-group' | 'watcher' | 'reconcile' | 'auto' | 'unknown'

  const requestSync = async (source: SyncSource = 'unknown') => {
    const isUserAction = USER_ACTION_SOURCES.includes(source as typeof USER_ACTION_SOURCES[number])
    if (isUserAction) {
      syncTrigger.value++
      console.log(`🔄 [CANVAS-STORE] Sync accepted from ${source} - syncTrigger:`, syncTrigger.value)
    } else {
      console.log(`⏭️ [CANVAS-STORE] Sync blocked from ${source} (not a user action)`)
    }
  }
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
    recalculateAllTaskCounts,
    taskCountByGroupId,      // Reactive computed: Map<groupId, count> derived from task.parentId
    getTaskCountForGroup,    // Helper: get count for a specific group (direct only)
    getAllDescendantGroupIds, // Helper: get rootId + all nested child group IDs
    aggregatedTaskCountByGroupId, // Reactive computed: Map<groupId, aggregatedCount> (includes descendants)
    getAggregatedTaskCountForGroup, // Helper: get aggregated count for a group (includes descendants)
    bumpTaskParentVersion,   // Call this when task.parentId changes to trigger count recomputation
    debugGroupHierarchy, // DEBUG: Log group hierarchy
    debugAllAggregatedCounts, // DEBUG: Log all aggregated counts
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
    isDragging,
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
    nodeVersionMap,
    syncTasksToCanvas,

    // Aliases - sections is same as groups (visibleGroups filtered)
    sections: visibleGroups,
    _rawSections: _rawGroups,
    createSection,
    updateSection,
    deleteSection,
  }
})

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCanvasStore, import.meta.hot))
}
