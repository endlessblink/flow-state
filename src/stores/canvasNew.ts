/**
 * Canvas New Store - Fresh rebuild with clean architecture
 *
 * TASK-184: Canvas System Rebuild
 *
 * Principles:
 * - Pure state management, no sync logic
 * - Explicit function calls, no watchers
 * - Store absolute positions only
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Types
export interface CanvasGroupNew {
  id: string
  name: string
  type: 'priority' | 'status' | 'timeline' | 'custom' | 'project'
  position: { x: number; y: number }
  dimensions: { width: number; height: number }
  color: string
  isVisible: boolean
  isCollapsed: boolean
  parentGroupId?: string | null
}

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export const useCanvasNewStore = defineStore('canvasNew', () => {
  // ============================================
  // STATE
  // ============================================

  const groups = ref<CanvasGroupNew[]>([])
  const viewport = ref<CanvasViewport>({ x: 0, y: 0, zoom: 1 })
  const selectedIds = ref<string[]>([])
  const isLoading = ref(false)
  const isInitialized = ref(false)

  // ============================================
  // COMPUTED
  // ============================================

  const visibleGroups = computed(() =>
    groups.value.filter(g => g.isVisible)
  )

  const groupCount = computed(() => groups.value.length)

  // ============================================
  // ACTIONS
  // ============================================

  function setGroups(newGroups: CanvasGroupNew[]) {
    groups.value = newGroups
  }

  function addGroup(group: CanvasGroupNew) {
    groups.value.push(group)
  }

  function updateGroup(id: string, updates: Partial<CanvasGroupNew>) {
    const index = groups.value.findIndex(g => g.id === id)
    if (index !== -1) {
      groups.value[index] = { ...groups.value[index], ...updates }
    }
  }

  function removeGroup(id: string) {
    const index = groups.value.findIndex(g => g.id === id)
    if (index !== -1) {
      groups.value.splice(index, 1)
    }
  }

  function setViewport(newViewport: Partial<CanvasViewport>) {
    viewport.value = { ...viewport.value, ...newViewport }
  }

  function setSelectedIds(ids: string[]) {
    selectedIds.value = ids
  }

  function clearSelection() {
    selectedIds.value = []
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function setInitialized(initialized: boolean) {
    isInitialized.value = initialized
  }

  function reset() {
    groups.value = []
    viewport.value = { x: 0, y: 0, zoom: 1 }
    selectedIds.value = []
    isLoading.value = false
    isInitialized.value = false
  }

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    groups,
    viewport,
    selectedIds,
    isLoading,
    isInitialized,

    // Computed
    visibleGroups,
    groupCount,

    // Actions
    setGroups,
    addGroup,
    updateGroup,
    removeGroup,
    setViewport,
    setSelectedIds,
    clearSelection,
    setLoading,
    setInitialized,
    reset
  }
})
