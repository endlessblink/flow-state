/**
 * useCanvasGroups - Group loading and management for canvas
 *
 * TASK-184: Canvas System Rebuild - Phase 2
 *
 * Responsibilities:
 * - Load groups from Supabase
 * - Convert groups to Vue Flow nodes
 * - CRUD operations for groups (Phase 6)
 *
 * Target: ~200 lines
 */
import { computed } from 'vue'
import { useCanvasNewStore, type CanvasGroupNew } from '@/stores/canvasNew'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabaseV2'
import type { Node } from '@vue-flow/core'

// Default dimensions for groups
const DEFAULT_GROUP_WIDTH = 300
const DEFAULT_GROUP_HEIGHT = 200

// Node type for Vue Flow
export const GROUP_NODE_TYPE = 'sectionNode'

export function useCanvasGroups() {
  const store = useCanvasNewStore()
  const { fetchGroups, saveGroup, deleteGroup } = useSupabaseDatabase()

  // ============================================
  // COMPUTED
  // ============================================

  /**
   * Convert store groups to Vue Flow nodes
   * Calculates nesting depth for proper z-index layering
   */
  const groupNodes = computed<Node[]>(() => {
    // Calculate depth for each group (for z-index)
    const depthMap = calculateGroupDepths(store.groups)
    return store.groups.map((group) => createGroupNode(group, depthMap.get(group.id) ?? 0))
  })

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Calculate nesting depth for each group
   * Root groups = 0, their children = 1, etc.
   */
  function calculateGroupDepths(groups: CanvasGroupNew[]): Map<string, number> {
    const depthMap = new Map<string, number>()
    const groupMap = new Map(groups.map(g => [g.id, g]))

    function getDepth(groupId: string, visited = new Set<string>()): number {
      // Prevent infinite recursion from circular references
      if (visited.has(groupId)) return 0
      visited.add(groupId)

      // Check cache
      if (depthMap.has(groupId)) return depthMap.get(groupId)!

      const group = groupMap.get(groupId)
      if (!group || !group.parentGroupId) {
        depthMap.set(groupId, 0)
        return 0
      }

      const parentDepth = getDepth(group.parentGroupId, visited)
      const depth = parentDepth + 1
      depthMap.set(groupId, depth)
      return depth
    }

    // Calculate depth for all groups
    groups.forEach(g => getDepth(g.id))
    return depthMap
  }

  /**
   * Create a Vue Flow node from a canvas group
   * @param group - The group data
   * @param depth - Nesting depth (0 = root, 1 = child of root, etc.)
   */
  function createGroupNode(group: CanvasGroupNew, depth: number = 0): Node {
    // Z-index strategy:
    // - DO NOT set z-index on groups - it creates stacking contexts that trap children
    // - Vue Flow handles render order via node array order (parents before children)
    // - Tasks use CSS with !important to always be above groups

    return {
      id: `section-${group.id}`,
      type: GROUP_NODE_TYPE,
      position: {
        x: group.position?.x ?? 0,
        y: group.position?.y ?? 0
      },
      // For nested groups, set parentNode
      parentNode: group.parentGroupId
        ? `section-${group.parentGroupId}`
        : undefined,
      // NO zIndex property - avoid stacking context issues
      data: {
        ...group,
        taskCount: 0, // Will be updated via computed
        depth // Include depth in data for debugging/styling
      },
      // Group nodes should be expandable to contain children
      expandParent: true,
      // Style for dimensions only - NO z-index
      style: {
        width: `${group.dimensions?.width ?? DEFAULT_GROUP_WIDTH}px`,
        height: `${group.dimensions?.height ?? DEFAULT_GROUP_HEIGHT}px`
      }
    }
  }

  /**
   * Convert Supabase group data to store format
   */
  function mapToStoreGroup(supabaseGroup: any): CanvasGroupNew {
    // Handle position - it may come as {x, y} or {x, y, width, height}
    const position = supabaseGroup.position || { x: 100, y: 100 }
    const dimensions = {
      width: position.width ?? DEFAULT_GROUP_WIDTH,
      height: position.height ?? DEFAULT_GROUP_HEIGHT
    }

    return {
      id: supabaseGroup.id,
      name: supabaseGroup.name || 'Unnamed Group',
      type: supabaseGroup.type || 'custom',
      position: {
        x: position.x ?? 100,
        y: position.y ?? 100
      },
      dimensions,
      color: supabaseGroup.color || '#6366f1',
      isVisible: supabaseGroup.isVisible !== false,
      isCollapsed: supabaseGroup.isCollapsed || false,
      parentGroupId: supabaseGroup.parentGroupId || null
    }
  }

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Load groups from Supabase and populate store
   */
  async function loadGroups(): Promise<void> {
    console.log('[useCanvasGroups] Loading groups from Supabase...')
    store.setLoading(true)

    try {
      const supabaseGroups = await fetchGroups()
      console.log('[useCanvasGroups] Fetched groups:', supabaseGroups.length)

      // Convert to store format
      const storeGroups = supabaseGroups
        .filter((g: any) => g.isVisible !== false)
        .map(mapToStoreGroup)

      // Sort so parent groups come before children (for Vue Flow)
      const sortedGroups = sortGroupsByHierarchy(storeGroups)

      store.setGroups(sortedGroups)
      console.log('[useCanvasGroups] Loaded groups into store:', sortedGroups.length)
    } catch (error) {
      console.error('[useCanvasGroups] Failed to load groups:', error)
    } finally {
      store.setLoading(false)
    }
  }

  /**
   * Sort groups so parents come before children
   * This is important for Vue Flow to correctly set up parent-child relationships
   */
  function sortGroupsByHierarchy(groups: CanvasGroupNew[]): CanvasGroupNew[] {
    const sorted: CanvasGroupNew[] = []
    const remaining = [...groups]

    // First, add all root groups (no parent)
    const roots = remaining.filter((g) => !g.parentGroupId)
    sorted.push(...roots)

    // Remove roots from remaining
    roots.forEach((root) => {
      const idx = remaining.findIndex((g) => g.id === root.id)
      if (idx !== -1) remaining.splice(idx, 1)
    })

    // Then add children level by level
    while (remaining.length > 0) {
      const addedIds = new Set(sorted.map((g) => g.id))
      const toAdd = remaining.filter((g) =>
        g.parentGroupId && addedIds.has(g.parentGroupId)
      )

      if (toAdd.length === 0) {
        // Orphan groups - add them as roots
        sorted.push(...remaining)
        break
      }

      sorted.push(...toAdd)
      toAdd.forEach((added) => {
        const idx = remaining.findIndex((g) => g.id === added.id)
        if (idx !== -1) remaining.splice(idx, 1)
      })
    }

    return sorted
  }

  /**
   * Update a group's position in the store
   */
  function updateGroupPosition(
    groupId: string,
    position: { x: number; y: number }
  ): void {
    store.updateGroup(groupId, { position })
  }

  /**
   * Update a group's dimensions in the store
   */
  function updateGroupDimensions(
    groupId: string,
    dimensions: { width: number; height: number }
  ): void {
    store.updateGroup(groupId, { dimensions })
  }

  /**
   * Persist a group to Supabase
   */
  async function persistGroup(groupId: string): Promise<void> {
    const group = store.groups.find((g) => g.id === groupId)
    if (!group) {
      console.warn('[useCanvasGroups] Group not found:', groupId)
      return
    }

    // Convert to Supabase format
    const supabaseGroup = {
      id: group.id,
      name: group.name,
      type: group.type,
      color: group.color,
      position: {
        x: group.position.x,
        y: group.position.y,
        width: group.dimensions.width,
        height: group.dimensions.height
      },
      isVisible: group.isVisible,
      isCollapsed: group.isCollapsed,
      parentGroupId: group.parentGroupId
    }

    try {
      await saveGroup(supabaseGroup)
      console.log('[useCanvasGroups] Persisted group:', groupId)
    } catch (error) {
      console.error('[useCanvasGroups] Failed to persist group:', error)
    }
  }

  // ============================================
  // RETURN
  // ============================================

  return {
    // Computed
    groupNodes,

    // Actions
    loadGroups,
    updateGroupPosition,
    updateGroupDimensions,
    persistGroup,

    // Helpers (exported for testing)
    createGroupNode,
    mapToStoreGroup,
    sortGroupsByHierarchy
  }
}
