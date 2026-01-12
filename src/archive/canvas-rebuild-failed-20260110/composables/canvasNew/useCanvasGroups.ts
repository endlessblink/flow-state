/**
 * Canvas Groups Composable - Group loading and synchronization
 * 
 * TASK-184: Canvas Rebuild Layer 1
 * 
 * Responsibilities:
 * - Fetch groups from Supabase
 * - Convert groups to nodes
 * - Handle group position/dimension persistence
 * - Basic containment check logic
 */
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useCanvasNewStore } from '@/stores/canvasNew'
import type { CanvasNode } from './useCanvasCore'
import type { CanvasGroup } from '@/stores/canvas/types'

export function useCanvasGroups() {
  const canvasStore = useCanvasNewStore()
  const { fetchGroups, saveGroup } = useSupabaseDatabase()

  // ============================================
  // LOADING
  // ============================================

  async function loadGroups(): Promise<CanvasGroup[]> {
    canvasStore.setLoading(true)
    try {
      const groups = await fetchGroups()
      canvasStore.setGroups(groups)
      return groups
    } catch (err) {
      console.error('[canvasGroups] Load error:', err)
      return []
    } finally {
      canvasStore.setLoading(false)
    }
  }

  // ============================================
  // CONVERSION
  // ============================================

  function groupsToNodes(
    groupToNodeFn: (group: CanvasGroup, taskCount: number) => CanvasNode
  ): CanvasNode[] {
    return canvasStore.groups.map(group => {
      // Logic for calculating direct task count will go here in Layer 1.7
      return groupToNodeFn(group, 0)
    })
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  async function persistGroupPosition(
    groupId: string,
    position: { x: number; y: number }
  ): Promise<boolean> {
    const group = canvasStore.groups.find(g => g.id === groupId)
    if (!group) return false

    // Check if locked
    if (canvasStore.isGroupPositionLocked(groupId)) {
      console.log(`[canvasGroups] Persistent blocked (locked): ${groupId}`)
      return false
    }

    // Update store
    canvasStore.updateGroup(groupId, { position })

    // Save to Supabase
    try {
      await saveGroup({
        ...group,
        position
      })
      console.log(`[canvasGroups] Persisted group: ${groupId}`)
      return true
    } catch (err) {
      console.error('[canvasGroups] Save error:', err)
      return false
    }
  }

  // ============================================
  // CONTAINMENT (Layer 1.7+)
  // ============================================

  /**
   * Find a group containing the given point (Absolute Coordinates)
   */
  function findContainingGroup(point: { x: number; y: number }): CanvasGroup | null {
    // Search reversed (top-most group first)
    const sortedGroups = [...canvasStore.groups].reverse()

    for (const group of sortedGroups) {
      if (!group.position || !group.dimensions) continue

      const x = group.position.x
      const y = group.position.y
      const w = group.dimensions.width
      const h = group.dimensions.height

      if (point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h) {
        return group
      }
    }
    return null
  }

  return {
    loadGroups,
    groupsToNodes,
    persistGroupPosition,
    findContainingGroup
  }
}
