/**
 * Coordinate Conversion Utilities
 * 
 * ARCHITECTURE:
 * - Database always stores ABSOLUTE (world space) coordinates
 * - Vue Flow uses RELATIVE (parent space) coordinates for nested nodes
 * - Conversion happens ONLY at render time and drag end
 * - No coordinate conversion in watchers or background syncs
 */

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { Node, Edge } from '@vue-flow/core';

export interface DbNode {
  id: string;
  position: { x: number; y: number };
  parentGroupId?: string | null;
  width: number;
  height: number;
  version: number;
  updatedAt: string;
  [key: string]: any;
}

export interface NodePositionCache {
  [nodeId: string]: { x: number; y: number };
}

/**
 * Single source of truth for coordinate conversion
 * Call this ONCE when rendering Vue Flow nodes
 */
export function toRelativePosition(
  dbNode: DbNode,
  allDbNodes: DbNode[]
): { x: number; y: number } {
  // Root nodes stay in absolute coordinates
  if (!dbNode.parentGroupId) {
    return dbNode.position;
  }

  // Find parent's absolute position
  const parent = allDbNodes.find(n => n.id === dbNode.parentGroupId);
  if (!parent) {
    console.warn(`Parent ${dbNode.parentGroupId} not found for node ${dbNode.id}`);
    return dbNode.position;
  }

  // Convert absolute → relative
  return {
    x: dbNode.position.x - parent.position.x,
    y: dbNode.position.y - parent.position.y
  };
}

/**
 * Convert Vue Flow relative position back to absolute
 * Call this at drag end, NOT during drag
 */
export function toAbsolutePosition(
  vueFlowNode: Node,
  allDbNodes: DbNode[]
): { x: number; y: number } {
  // Root nodes already absolute
  if (!vueFlowNode.parentNode) {
    return vueFlowNode.position;
  }

  // Find parent's absolute position
  const parent = allDbNodes.find(
    n => n.id === vueFlowNode.parentNode || `section-${n.id}` === vueFlowNode.parentNode
  );
  if (!parent) {
    console.warn(`Parent ${vueFlowNode.parentNode} not found`);
    return vueFlowNode.position;
  }

  // Convert relative → absolute
  return {
    x: vueFlowNode.position.x + parent.position.x,
    y: vueFlowNode.position.y + parent.position.y
  };
}

/**
 * Batch convert all DB nodes to Vue Flow format
 * Use this once when loading nodes
 */
export function dbNodesToVueFlowNodes(dbNodes: DbNode[]): Node[] {
  return dbNodes.map(dbNode => {
    const position = toRelativePosition(dbNode, dbNodes);

    return {
      id: `section-${dbNode.id}`, // Normalize ID format
      data: {
        label: dbNode.label || dbNode.id,
        ...dbNode
      },
      position,
      parentNode: dbNode.parentGroupId ? `section-${dbNode.parentGroupId}` : undefined,
      expandParent: true,
      draggable: true,
      selectable: true,
      width: dbNode.width,
      height: dbNode.height,
      style: {
        border: dbNode.parentGroupId ? '2px solid #4a90e2' : '2px solid #666'
      }
    };
  });
}

/**
 * Composable for managing node sync with optimistic locking
 */
export function useNodeSync(
  dbNodes: Ref<DbNode[]>,
  nodeVersionMap: Ref<Map<string, number>>
) {
  const isSyncing = ref(false);
  const syncError = ref<string | null>(null);

  /**
   * Sync a single node position with conflict detection
   * This is the ONLY place coordinate conversion happens on update
   */
  async function syncNodePosition(
    supabaseClient: any,
    nodeId: string,
    vueFlowNode: Node,
    allDbNodes: DbNode[]
  ): Promise<boolean> {
    if (isSyncing.value) return false;

    isSyncing.value = true;
    syncError.value = null;

    try {
      // Convert Vue Flow relative position to absolute
      const absolutePosition = toAbsolutePosition(vueFlowNode, allDbNodes);
      const currentVersion = nodeVersionMap.value.get(nodeId) || 1;

      // Optimistic lock: only update if version matches
      const { data, error } = await supabaseClient
        .from('nodes')
        .update({
          position: absolutePosition,
          version: currentVersion + 1
        })
        .eq('id', nodeId)
        .eq('version', currentVersion) // ← Prevents blind overwrites
        .select('version');

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        // Version mismatch: another client updated this node
        syncError.value = `Position conflict for node ${nodeId}. Fetching latest...`;
        
        // Fetch latest version
        const { data: latest } = await supabaseClient
          .from('nodes')
          .select('version')
          .eq('id', nodeId)
          .single();

        if (latest) {
          nodeVersionMap.value.set(nodeId, latest.version);
        }

        return false; // Conflict detected
      }

      // Success: update local version map
      nodeVersionMap.value.set(nodeId, currentVersion + 1);
      return true;

    } catch (err: any) {
      syncError.value = err.message || 'Sync failed';
      return false;
    } finally {
      isSyncing.value = false;
    }
  }

  /**
   * Load nodes from database and update version map
   */
  async function loadNodes(supabaseClient: any) {
    try {
      const { data, error } = await supabaseClient
        .from('nodes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      dbNodes.value = data;

      // Initialize version map
      const newVersionMap = new Map<string, number>();
      data.forEach((node: DbNode) => {
        newVersionMap.set(node.id, node.version);
      });
      nodeVersionMap.value = newVersionMap;

    } catch (err: any) {
      syncError.value = err.message || 'Failed to load nodes';
    }
  }

  return {
    isSyncing: computed(() => isSyncing.value),
    syncError: computed(() => syncError.value),
    syncNodePosition,
    loadNodes
  };
}

/**
 * Helper: Validate coordinate conversion
 * Use in tests to ensure no data loss
 */
export function validateCoordinateConversion(
  dbNode: DbNode,
  vueFlowNode: Node,
  allDbNodes: DbNode[]
): boolean {
  // Convert db → vue flow → db
  const relative = toRelativePosition(dbNode, allDbNodes);
  const reconstructed = toAbsolutePosition(
    { ...vueFlowNode, position: relative },
    allDbNodes
  );

  const tolerance = 0.01; // floating point errors
  const xMatch = Math.abs(reconstructed.x - dbNode.position.x) < tolerance;
  const yMatch = Math.abs(reconstructed.y - dbNode.position.y) < tolerance;

  if (!xMatch || !yMatch) {
    console.error(
      `Coordinate conversion failed for ${dbNode.id}:`,
      { original: dbNode.position, reconstructed }
    );
  }

  return xMatch && yMatch;
}