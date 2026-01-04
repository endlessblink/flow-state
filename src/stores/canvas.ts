import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import PowerSyncService from '@/services/database/PowerSyncDatabase' // Import Service directly
import type { Task } from './tasks'
import { toSqlGroup, fromSqlGroup } from '@/utils/groupMapper'
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

  // Viewport state
  const viewport = ref({ x: 0, y: 0, zoom: 1 })

  // Selection state
  const selectedNodeIds = ref<string[]>([])
  const connectMode = ref(false)
  const connectingFrom = ref<string | null>(null)

  // Groups state
  const groups = ref<CanvasGroup[]>([])
  const activeGroupId = ref<string | null>(null)
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
      const db = await PowerSyncService.getInstance()
      console.log(`[CanvasStore] loadFromDatabase called at ${new Date().toISOString()} (silent: false)`)

      const result = await db.getAll('SELECT * FROM groups WHERE is_deleted = 0')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loadedGroups = result.map(row => fromSqlGroup(row as any))
      groups.value = loadedGroups

      console.log(`✅ [SQL] Loaded ${loadedGroups.length} canvas groups`)

    } catch (e) {
      console.error('❌ [SQL] Failed to load canvas groups:', e)
    }
  }

  const saveGroupToStorage = async (group: CanvasGroup) => {
    try {
      const db = await PowerSyncService.getInstance()
      const sqlGroup = toSqlGroup(group)

      await db.execute(`
        INSERT OR REPLACE INTO groups (
            id, name, type, color, position_json, filters_json, layout,
            is_visible, is_collapsed, collapsed_height, parent_group_id,
            is_power_mode, power_keyword_json, assign_on_drop_json, collect_filter_json,
            auto_collect, is_pinned, property_value,
            created_at, updated_at, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sqlGroup.id, sqlGroup.name, sqlGroup.type, sqlGroup.color, sqlGroup.position_json, sqlGroup.filters_json, sqlGroup.layout,
        sqlGroup.is_visible, sqlGroup.is_collapsed, sqlGroup.collapsed_height, sqlGroup.parent_group_id,
        sqlGroup.is_power_mode, sqlGroup.power_keyword_json, sqlGroup.assign_on_drop_json, sqlGroup.collect_filter_json,
        sqlGroup.auto_collect, sqlGroup.is_pinned, sqlGroup.property_value,
        sqlGroup.created_at, sqlGroup.updated_at, sqlGroup.is_deleted
      ])
      // console.debug(`✅ [SQL] Saved group ${group.name}`)

      // PouchDB dual-sync removed during decommissioning
    } catch (e) {
      console.error(`❌ [SQL] Failed to save group ${group.id}:`, e)
    }
  }

  // --- ACTIONS ---

  const createGroup = async (groupData: Omit<CanvasGroup, 'id'>) => {
    const newGroup: CanvasGroup = {
      ...groupData,
      id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isVisible: true,
      isCollapsed: false
    }
    groups.value.push(newGroup)
    await saveGroupToStorage(newGroup)
    return newGroup
  }

  const updateGroup = async (id: string, updates: Partial<CanvasGroup>) => {
    const index = groups.value.findIndex(g => g.id === id)
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], ...updates, updatedAt: new Date().toISOString() }
      await saveGroupToStorage(groups.value[index])
    }
  }

  const deleteGroup = async (id: string) => {
    const index = groups.value.findIndex(g => g.id === id)
    if (index !== -1) {
      groups.value.splice(index, 1)

      // SQL Soft Delete
      try {
        const db = await PowerSyncService.getInstance()
        await db.execute('UPDATE groups SET is_deleted = 1 WHERE id = ?', [id])
      } catch (e) {
        console.error('❌ [SQL] Failed to delete group:', e)
      }
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

    // Also save to DB for persistence across devices (fire and forget)
    // PowerSyncService.getInstance().then(db => {
    //   db.execute('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)', 
    //     ['canvas_viewport', JSON.stringify({ x, y, zoom })]
    //   ).catch(console.error)
    // })
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
    const group = groups.value.find(g => g.id === groupId)
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
    const childGroups = groups.value.filter(g => g.parentGroupId === groupId)
    for (const child of childGroups) {
      count += getTaskCountInGroupRecursive(child.id, tasks)
    }

    return count
  }

  const getTasksInSection = (groupId: string): Task[] => {
    if (!taskStore || !taskStore.tasks) return []
    const group = groups.value.find(g => g.id === groupId)
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
    const group = groups.value.find(g => g.id === sectionId)
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

    // Process Groups
    if (groups.value && Array.isArray(groups.value)) {
      groups.value.forEach(g => {
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

  return {
    viewport,
    groups,
    activeGroupId,
    showGroupGuides,
    snapToGroups,
    nodes,
    edges,
    selectedNodeIds,
    connectMode,
    connectingFrom,

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

    // Aliases for compatibility
    sections: groups,
    createSection: createGroup,
    updateSection: updateGroup,
    deleteSection: deleteGroup,
    updateSectionWithUndo
  }
})
