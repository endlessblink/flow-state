import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import { breakGroupCycles, resetAllGroupsToRoot } from '@/utils/canvas/storeHelpers'
import { assertNoDuplicateIds } from '@/utils/canvas/invariants'
import { CANVAS } from '@/constants/canvas'
import { type Node, type Edge } from '@vue-flow/core'
import { getGroupAbsolutePosition } from '@/utils/canvas/coordinates'
import { isNodeCompletelyInside } from '@/utils/canvas/spatialContainment'

// Modular store logic
import { useCanvasGroups } from './canvas/canvasGroups'
import { useCanvasViewport } from './canvas/canvasViewport'
import { useCanvasPersistence } from './canvas/canvasPersistence'
export * from './canvas/types'

export const useCanvasStore = defineStore('canvas', () => {
  // 1. Task Store Reference (Async Bridge)
  const taskStoreRef = ref<{ tasks: Task[] } | null>(null)
  if (typeof window !== 'undefined') {
    import('@/stores/tasks').then(m => { taskStoreRef.value = m.useTaskStore() as unknown as { tasks: Task[] } })
  }

  // BUG-1084 v5: Flag to indicate that loadFromDatabase has completed at least once
  // Used by useCanvasOrchestrator to wait for store initialization before syncing
  const _hasInitializedOnce = ref(false)

  // 2. Persistence Layer
  const {
    fetchGroups,
    saveGroup,
    deleteGroupRemote,
    saveGroupsToLocalStorage,
    loadGroupsFromLocalStorage
  } = useCanvasPersistence()

  const saveGroupToStorage = async (group: CanvasGroup) => {
    saveGroupsToLocalStorage(groupsModule._rawGroups.value)
    try {
      await saveGroup(group)
    } catch (_e) {
      if (import.meta.env.DEV) console.debug('[CANVAS:SAVE] Supabase skipped/failed - localStorage backup saved')
    }
  }

  // 3. Viewport Layer
  const {
    viewport,
    zoomConfig,
    setViewport,
    loadSavedViewport
  } = useCanvasViewport()

  // 4. Groups Layer
  const groupsModule = useCanvasGroups(
    { saveGroupToStorage, saveGroupsToLocalStorage, deleteGroupRemote },
    taskStoreRef
  )

  // 5. Shared Canvas State
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])
  const isDragging = ref(false)
  const nodeVersionMap = ref<Map<string, number>>(new Map())
  const showGroupGuides = ref(true)
  const snapToGroups = ref(true)
  const selectedNodeIds = ref<string[]>([])
  const skipNextSelectionChange = ref(false)
  const allowBulkDeselect = ref(false)
  const connectMode = ref(false)
  const connectingFrom = ref<string | null>(null)

  // UI state
  const multiSelectMode = ref(false)
  const selectionMode = ref('normal')
  const selectionRect = ref<{ x: number, y: number, width: number, height: number } | null>(null)
  const isSelecting = ref(false)
  const showPriorityIndicator = ref(true)
  const showStatusBadge = ref(true)
  const showDurationBadge = ref(true)
  const showScheduleBadge = ref(true)

  // 6. Action Orchestration (Loading)
  const loadFromDatabase = async () => {
    try {
      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()

      if (!authStore.isAuthenticated) {
        const localGroups = loadGroupsFromLocalStorage()
        groupsModule.setGroups(breakGroupCycles(localGroups))
        return
      }

      const loadedGroups = await fetchGroups()

      if (import.meta.env.DEV) {
        assertNoDuplicateIds(loadedGroups, 'Supabase groups load')
      }

      // Integrity checks
      loadedGroups.forEach((g: CanvasGroup) => {
        if (!g.position || !Number.isFinite(g.position.x) || !Number.isFinite(g.position.y)) {
          console.warn(`[CANVAS:INTEGRITY] Auto-repairing position for group ${g.name}`)
          g.position = { x: 0, y: 0, width: g.position?.width || 600, height: g.position?.height || 400 }
        }
      })

      // BUG-169 Safety
      if (loadedGroups.length === 0 && groupsModule._rawGroups.value.length > 0) {
        const sessionStart = (window as unknown as Record<string, unknown>).FlowStateSessionStart as number || 0
        if (Date.now() - sessionStart < 10000) {
          console.warn('[CANVAS:LOAD] BLOCKED empty overwrite')
          return
        }
      }

      const cleanedGroups = breakGroupCycles(loadedGroups)
      groupsModule.setGroups(cleanedGroups)

      // Persist fixes
      cleanedGroups.forEach((g: CanvasGroup, i: number) => {
        if (g.parentGroupId !== loadedGroups[i]?.parentGroupId) {
          saveGroup(g)
        }
      })

      // Versions - defensive: ensure nodeVersionMap is a Map (can get corrupted during hot reload)
      if (!(nodeVersionMap.value instanceof Map)) {
        nodeVersionMap.value = new Map()
      }
      nodeVersionMap.value.clear()
      loadedGroups.forEach((g: CanvasGroup) => nodeVersionMap.value.set(g.id, g.positionVersion ?? 0))
      if (taskStoreRef.value?.tasks) {
        taskStoreRef.value.tasks.forEach((t: Task) => nodeVersionMap.value.set(t.id, t.positionVersion ?? 0))
      }

    } catch (e) {
      console.error('[CANVAS:LOAD] Failed to load canvas groups:', e)
      const localGroups = loadGroupsFromLocalStorage()
      if (localGroups.length > 0) groupsModule.setGroups(breakGroupCycles(localGroups))
    } finally {
      // BUG-1084 v5: Mark initialization complete (even on error)
      _hasInitializedOnce.value = true
    }
  }

  // 7. Initialize
  // BUG-1045 FIX: REMOVED auto-init on store creation
  // The canvas store was initializing BEFORE auth was ready, causing it to load
  // empty data or from localStorage (guest mode) instead of Supabase.
  // Initialization now happens ONLY from useAppInitialization.ts AFTER auth.
  // Same pattern as BUG-339 fix in tasks.ts.
  //
  // REMOVED CODE:
  // const initialize = async () => {
  //   await loadFromDatabase()
  //   import('@/stores/auth').then(({ useAuthStore }) => {
  //     const authStore = useAuthStore()
  //     watch(() => [authStore.isInitialized, authStore.isAuthenticated], async ([isInit, isAuth], [_wasInit, wasAuth]) => {
  //       if (isInit && isAuth && !wasAuth) {
  //         await loadFromDatabase()
  //       }
  //     })
  //   })
  // }
  // if (typeof window !== 'undefined') {
  //   initialize()
  // }

  // 8. Visual Logic
  const syncTasksToCanvas = (tasks: Task[]) => {
    try {
      const onCanvasTasks = tasks.filter(t => !t.isInInbox && t.canvasPosition)
      const existingTaskNodes = new Map(nodes.value.filter(n => n.type === 'taskNode' || n.type === 'task').map(n => [n.id, n]))

      const updatedTaskNodes = onCanvasTasks.map(t => {
        const existingNode = existingTaskNodes.get(t.id)
        if (existingNode) {
          const oldTask = existingNode.data?.task
          const posUnchanged = existingNode.position.x === t.canvasPosition?.x && existingNode.position.y === t.canvasPosition?.y
          const dataUnchanged = oldTask &&
            oldTask.status === t.status &&
            oldTask.priority === t.priority &&
            oldTask.title === t.title &&
            oldTask.updatedAt === t.updatedAt &&
            oldTask.progress === t.progress &&
            oldTask.dueDate === t.dueDate &&
            oldTask.estimatedDuration === t.estimatedDuration

          if (posUnchanged && dataUnchanged) {
            existingTaskNodes.delete(t.id)
            return existingNode
          }
        }
        existingTaskNodes.delete(t.id)
        return {
          id: t.id,
          type: 'taskNode',
          position: { ...t.canvasPosition } as { x: number; y: number },
          data: { task: t },
          draggable: true,
          connectable: true,
          selectable: true,
          zIndex: 10
        }
      })

      const otherNodes = nodes.value.filter(n => n.type !== 'task' && n.type !== 'taskNode')
      nodes.value = [...otherNodes, ...updatedTaskNodes] as Node[]
    } catch (e) {
      console.error('[CANVAS:SYNC] Sync tasks to canvas failed:', e)
    }
  }

  const calculateContentBounds = (tasks: Task[]) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let hasContent = false

    tasks.forEach(t => {
      if (t.canvasPosition && !t.isInInbox) {
        hasContent = true
        minX = Math.min(minX, t.canvasPosition.x)
        minY = Math.min(minY, t.canvasPosition.y)
        maxX = Math.max(maxX, t.canvasPosition.x + CANVAS.DEFAULT_TASK_WIDTH)
        maxY = Math.max(maxY, t.canvasPosition.y + CANVAS.DEFAULT_TASK_HEIGHT)
      }
    })

    groupsModule.visibleGroups.value.forEach((g: CanvasGroup) => {
      if (g.position) {
        hasContent = true
        const w = g.position.width || CANVAS.DEFAULT_GROUP_WIDTH
        const h = g.position.height || CANVAS.DEFAULT_GROUP_HEIGHT
        minX = Math.min(minX, g.position.x)
        minY = Math.min(minY, g.position.y)
        maxX = Math.max(maxX, g.position.x + w)
        maxY = Math.max(maxY, g.position.y + h)
      }
    })

    if (!hasContent || minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  // 9. Selection / UI Actions
  const setSelectedNodes = (ids: string[]) => { selectedNodeIds.value = ids }
  const clearSelection = () => { selectedNodeIds.value = [] }
  const toggleNodeSelection = (id: string) => {
    skipNextSelectionChange.value = true
    const index = selectedNodeIds.value.indexOf(id)
    if (index === -1) selectedNodeIds.value.push(id)
    else selectedNodeIds.value.splice(index, 1)
  }

  const toggleMultiSelectMode = () => { multiSelectMode.value = !multiSelectMode.value }
  const setSelectionMode = (mode: string) => { selectionMode.value = mode }
  const startSelection = (x: number, y: number) => { isSelecting.value = true; selectionRect.value = { x, y, width: 0, height: 0 } }
  const updateSelection = (x: number, y: number) => {
    if (selectionRect.value) {
      selectionRect.value.width = x - selectionRect.value.x
      selectionRect.value.height = y - selectionRect.value.y
    }
  }
  const endSelection = () => { isSelecting.value = false; selectionRect.value = null }
  const selectNodesInRect = (rect: { x: number, y: number, width: number, height: number }) => {
    const boxLeft = Math.min(rect.x, rect.x + rect.width)
    const boxTop = Math.min(rect.y, rect.y + rect.height)
    const boxRight = Math.max(rect.x, rect.x + rect.width)
    const boxBottom = Math.max(rect.y, rect.y + rect.height)

    const selectedIds = nodes.value.filter(n => {
      const x = Number(n.position.x)
      const y = Number(n.position.y)
      return x >= boxLeft && x <= boxRight && y >= boxTop && y <= boxBottom
    }).map(n => n.id)
    setSelectedNodes(selectedIds)
  }

  const requestSync = async (source: string = 'unknown') => {
    const USER_ACTION_SOURCES = ['user:drag-drop', 'user:create', 'user:delete', 'user:undo', 'user:redo', 'user:resize', 'user:connect', 'user:context-menu', 'user:manual']
    if (USER_ACTION_SOURCES.includes(source)) {
      groupsModule.syncTrigger.value++
      console.log(`[CANVAS] Sync triggered by ${source}`)
    }
  }

  return {
    // State
    viewport, zoomConfig,
    groups: groupsModule.visibleGroups,
    _rawGroups: groupsModule._rawGroups,
    activeGroupId: groupsModule.activeGroupId,
    showGroupGuides, snapToGroups, nodes, edges, selectedNodeIds,
    skipNextSelectionChange, allowBulkDeselect, connectMode, connectingFrom,
    multiSelectMode, selectionMode, selectionRect, isSelecting,
    showPriorityIndicator, showStatusBadge, showDurationBadge, showScheduleBadge,
    activeSectionId: groupsModule.activeSectionId, syncTrigger: groupsModule.syncTrigger,
    nodeVersionMap, isDragging,
    // BUG-1084 v5: Initialization flag for orchestrator
    _hasInitializedOnce,

    // Actions
    loadFromDatabase,
    createGroup: groupsModule.createGroup,
    updateGroup: groupsModule.updateGroup,
    deleteGroup: groupsModule.deleteGroup,
    setGroups: groupsModule.setGroups,
    patchGroups: groupsModule.patchGroups,
    updateGroupFromSync: groupsModule.updateGroupFromSync,
    removeGroupFromSync: groupsModule.removeGroupFromSync,
    setViewport, loadSavedViewport,
    taskCountByGroupId: groupsModule.taskCountByGroupId,
    getTaskCountForGroup: (id: string) => groupsModule.taskCountByGroupId.value.get(id) ?? 0,
    aggregatedTaskCountByGroupId: groupsModule.aggregatedTaskCountByGroupId,
    getAggregatedTaskCountForGroup: (id: string) => groupsModule.aggregatedTaskCountByGroupId.value.get(id) ?? 0,
    bumpTaskParentVersion: groupsModule.bumpTaskParentVersion,
    calculateContentBounds, setSelectedNodes, clearSelection, toggleNodeSelection,
    getTasksInSection: groupsModule.getTasksInSection,
    taskMatchesSection: (task: Task, sectionId: string) => {
      const g = groupsModule._rawGroups.value.find(gr => gr.id === sectionId)
      if (!g) return false
      if (g.type !== 'custom') {
        const propValue = (g.propertyValue || '').toLowerCase()
        if (g.type === 'priority') return (task.priority || '').toLowerCase() === propValue
        if (g.type === 'status') return (task.status || '').toLowerCase() === propValue
        if (g.type === 'project') return task.projectId === g.propertyValue
        return false
      }
      if (!task.canvasPosition) return false
      const groupAbsolutePos = getGroupAbsolutePosition(sectionId, groupsModule._rawGroups.value)
      return isNodeCompletelyInside({ position: task.canvasPosition }, { position: groupAbsolutePos, width: g.position.width, height: g.position.height })
    },
    syncTasksToCanvas, requestSync, setSelectionMode, startSelection, updateSelection, endSelection, selectNodesInRect,
    toggleMultiSelectMode,
    togglePriorityIndicator: () => { showPriorityIndicator.value = !showPriorityIndicator.value },
    toggleStatusBadge: () => { showStatusBadge.value = !showStatusBadge.value },
    toggleDurationBadge: () => { showDurationBadge.value = !showDurationBadge.value },
    toggleScheduleBadge: () => { showScheduleBadge.value = !showScheduleBadge.value },
    setActiveSection: (id: string | null) => { groupsModule.activeSectionId.value = id },
    toggleConnectMode: () => { connectMode.value = !connectMode.value },
    startConnection: (id: string) => { connectingFrom.value = id; connectMode.value = true },
    clearConnection: () => { connectingFrom.value = null; connectMode.value = false },
    togglePowerMode: async (id: string, active?: boolean) => {
      const g = groupsModule._rawGroups.value.find(gr => gr.id === id)
      await groupsModule.updateGroup(id, { isPowerMode: active ?? !(g?.isPowerMode) })
    },
    toggleSectionVisibility: (id: string) => {
      const g = groupsModule._rawGroups.value.find(gr => gr.id === id)
      if (g) groupsModule.updateGroup(id, { isVisible: !g.isVisible })
    },
    toggleSectionCollapse: (id: string) => {
      const g = groupsModule._rawGroups.value.find(gr => gr.id === id)
      if (g) groupsModule.updateGroup(id, { isCollapsed: !g.isCollapsed })
    },
    // Compatibility aliases
    sections: groupsModule.sections,
    _rawSections: groupsModule._rawGroups,
    createSection: groupsModule.createGroup,
    updateSection: groupsModule.updateGroup,
    deleteSection: groupsModule.deleteGroup,
    updateSectionWithUndo: groupsModule.updateGroup,
    recalculateAllTaskCounts: (_tasks?: Task[]) => { groupsModule.bumpTaskParentVersion() },
    getMatchingTaskCount: (groupId: string, tasks?: Task[]) => {
      const sourceTasks = tasks || (taskStoreRef.value?.tasks || [])
      return sourceTasks.filter((t: Task) => {
        const g = groupsModule._rawGroups.value.find(gr => gr.id === groupId)
        if (!g) return false
        if (g.type !== 'custom') {
          const propValue = (g.propertyValue || '').toLowerCase()
          if (g.type === 'priority') return (t.priority || '').toLowerCase() === propValue
          if (g.type === 'status') return (t.status || '').toLowerCase() === propValue
          if (g.type === 'project') return t.projectId === g.propertyValue
          return false
        }
        if (!t.canvasPosition) return false
        const groupAbsolutePos = getGroupAbsolutePosition(groupId, groupsModule._rawGroups.value)
        return isNodeCompletelyInside({ position: t.canvasPosition }, { position: groupAbsolutePos, width: g.position.width, height: g.position.height })
      }).length
    },
    // Clear all canvas data (used on sign-out to reset to guest mode)
    clearAll: () => {
      groupsModule._rawGroups.value = []
      nodes.value = []
      edges.value = []
    },
    // Emergency fix: Reset all groups to root level (clears parent relationships)
    // Call this from browser console: useCanvasStore().resetGroupsToRoot()
    resetGroupsToRoot: async () => {
      const groups = groupsModule._rawGroups.value
      resetAllGroupsToRoot(groups)
      // Trigger reactivity and save
      groupsModule._rawGroups.value = [...groups]
      // Save each group to persist the fix
      for (const g of groups) {
        await saveGroupToStorage(g)
      }
      // Trigger sync
      groupsModule.syncTrigger.value++
      console.log('[CANVAS] All groups reset to root level. Refresh the page to see changes.')
    }
  }
})
