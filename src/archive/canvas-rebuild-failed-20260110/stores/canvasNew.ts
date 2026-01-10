/**
 * Canvas New Store - Fresh rebuild with position locking
 * 
 * TASK-184: Canvas Rebuild
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CanvasGroup } from '@/stores/canvas/types'

export const useCanvasNewStore = defineStore('canvasNew', () => {
  const groups = ref<CanvasGroup[]>([])
  const isLoading = ref(false)
  const isInitialized = ref(false)

  // Position Locking
  const lockedGroupPositions = ref(new Map<string, number>()) // groupId -> timeout
  const lockedTaskPositions = ref(new Map<string, number>())  // taskId -> timeout
  const LOCK_TIMEOUT_MS = 7000

  // ============================================
  // ACTIONS
  // ============================================

  function setGroups(newGroups: CanvasGroup[]) {
    groups.value = newGroups
  }

  function updateGroup(id: string, updates: Partial<CanvasGroup>) {
    // Block position updates if locked
    if (updates.position && isGroupPositionLocked(id)) {
      return
    }
    const idx = groups.value.findIndex(g => g.id === id)
    if (idx !== -1) {
      groups.value[idx] = { ...groups.value[idx], ...updates }
    }
  }

  function setLoading(l: boolean) { isLoading.value = l }
  function setInitialized(i: boolean) { isInitialized.value = i }

  // ============================================
  // LOCKING LOGIC
  // ============================================

  function lockGroupPosition(id: string) {
    lockedGroupPositions.value.set(id, Date.now() + LOCK_TIMEOUT_MS)
  }

  function unlockGroupPosition(id: string) {
    lockedGroupPositions.value.delete(id)
  }

  function isGroupPositionLocked(id: string): boolean {
    const timeout = lockedGroupPositions.value.get(id)
    if (!timeout) return false
    if (Date.now() > timeout) {
      lockedGroupPositions.value.delete(id)
      return false
    }
    return true
  }

  function lockTaskPosition(id: string) {
    lockedTaskPositions.value.set(id, Date.now() + LOCK_TIMEOUT_MS)
  }

  function unlockTaskPosition(id: string) {
    lockedTaskPositions.value.delete(id)
  }

  function isTaskPositionLocked(id: string): boolean {
    const timeout = lockedTaskPositions.value.get(id)
    if (!timeout) return false
    if (Date.now() > timeout) {
      lockedTaskPositions.value.delete(id)
      return false
    }
    return true
  }

  return {
    groups,
    isLoading,
    isInitialized,
    groupCount: computed(() => groups.value.length),

    setGroups,
    updateGroup,
    setLoading,
    setInitialized,

    lockGroupPosition,
    unlockGroupPosition,
    isGroupPositionLocked,
    lockTaskPosition,
    unlockTaskPosition,
    isTaskPositionLocked
  }
})
