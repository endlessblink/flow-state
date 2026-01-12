/**
 * Coordinate Conversion with Size
 * 
 * Shows how to handle size when converting between absolute and relative
 */

// ============================================================================
// DATABASE NODE (What you store)
// ============================================================================

export interface DbNode {
  id: string;
  type: 'task' | 'group';
  
  // ABSOLUTE coordinates (world space)
  position: { x: number; y: number };
  
  // SIZE - Always explicit
  width: number;
  height: number;
  
  // Hierarchy
  parentGroupId?: string | null;
  
  // Sync tracking
  version: number;
  updatedAt: string;
}

// ============================================================================
// VUE FLOW NODE (What Vue Flow sees)
// ============================================================================

import type { Node } from '@vue-flow/core';

export interface VueFlowNode extends Node {
  position: { x: number; y: number };  // RELATIVE to parent
  width?: number;
  height?: number;
  parentNode?: string;  // Optional parent
  data?: {
    type: 'task' | 'group';
    dbPosition?: { x: number; y: number };  // Keep original for reference
  };
}

// ============================================================================
// CONVERSION: Database → Vue Flow (for rendering)
// ============================================================================

/**
 * Convert DB node to Vue Flow node
 * Handles size and absolute→relative conversion
 */
export function dbNodeToVueFlowNode(
  dbNode: DbNode,
  allDbNodes: DbNode[]
): VueFlowNode {
  // Get parent if exists
  const parent = dbNode.parentGroupId 
    ? allDbNodes.find(n => n.id === dbNode.parentGroupId)
    : null;

  // Convert position: absolute → relative
  const position = parent
    ? {
        x: dbNode.position.x - parent.position.x,
        y: dbNode.position.y - parent.position.y
      }
    : dbNode.position;

  return {
    id: `section-${dbNode.id}`,
    data: {
      type: dbNode.type,
      dbPosition: dbNode.position  // Keep absolute for reference
    },
    position,
    parentNode: parent ? `section-${parent.id}` : undefined,
    width: dbNode.width,
    height: dbNode.height,
    draggable: true,
    style: {
      border: dbNode.type === 'group' ? '2px solid #4a90e2' : '1px solid #666'
    }
  };
}

/**
 * Batch convert all DB nodes to Vue Flow format
 */
export function dbNodesToVueFlowNodes(dbNodes: DbNode[]): VueFlowNode[] {
  return dbNodes.map(dbNode => dbNodeToVueFlowNode(dbNode, dbNodes));
}

// ============================================================================
// CONVERSION: Vue Flow → Database (for syncing)
// ============================================================================

/**
 * Convert Vue Flow node back to absolute coordinates
 * Handles size and relative→absolute conversion
 */
export function vueFlowNodeToDbPosition(
  vueFlowNode: VueFlowNode,
  allDbNodes: DbNode[]
): { position: { x: number; y: number }; width: number; height: number } {
  // Root nodes are already absolute
  if (!vueFlowNode.parentNode) {
    return {
      position: vueFlowNode.position,
      width: vueFlowNode.width || 100,
      height: vueFlowNode.height || 100
    };
  }

  // Find parent's absolute position
  const parentId = vueFlowNode.parentNode.replace('section-', '');
  const parent = allDbNodes.find(n => n.id === parentId);
  
  if (!parent) {
    console.warn(`Parent ${parentId} not found`);
    return {
      position: vueFlowNode.position,
      width: vueFlowNode.width || 100,
      height: vueFlowNode.height || 100
    };
  }

  // Convert relative → absolute
  const absolutePosition = {
    x: vueFlowNode.position.x + parent.position.x,
    y: vueFlowNode.position.y + parent.position.y
  };

  return {
    position: absolutePosition,
    width: vueFlowNode.width || 100,
    height: vueFlowNode.height || 100
  };
}

// ============================================================================
// SYNCING: Database updates
// ============================================================================

/**
 * Sync node position AND size to database
 * Called at drag end or resize end
 */
export async function syncNodePositionAndSize(
  supabaseClient: any,
  vueFlowNode: VueFlowNode,
  allDbNodes: DbNode[],
  nodeVersionMap: Map<string, number>
): Promise<boolean> {
  const nodeId = vueFlowNode.id.replace('section-', '');
  const currentVersion = nodeVersionMap.get(nodeId);

  if (!currentVersion) {
    console.error(`No version found for node ${nodeId}`);
    return false;
  }

  // Convert to absolute coordinates and get size
  const { position: absolutePosition, width, height } = 
    vueFlowNodeToDbPosition(vueFlowNode, allDbNodes);

  // Sync with optimistic lock
  const { data, error } = await supabaseClient
    .from('nodes')
    .update({
      position: absolutePosition,
      width,
      height,
      version: currentVersion + 1
    })
    .eq('id', nodeId)
    .eq('version', currentVersion);  // ← Optimistic lock

  if (error) {
    console.error('Sync error:', error);
    return false;
  }

  if (!data || data.length === 0) {
    console.warn(`Version conflict for node ${nodeId}`);
    return false; // Conflict
  }

  // Update local version map
  nodeVersionMap.set(nodeId, currentVersion + 1);
  return true;
}

/**
 * Sync only size (for resize operations)
 */
export async function syncNodeSize(
  supabaseClient: any,
  nodeId: string,
  width: number,
  height: number,
  nodeVersionMap: Map<string, number>
): Promise<boolean> {
  const currentVersion = nodeVersionMap.get(nodeId);

  if (!currentVersion) {
    console.error(`No version found for node ${nodeId}`);
    return false;
  }

  const { data, error } = await supabaseClient
    .from('nodes')
    .update({
      width,
      height,
      version: currentVersion + 1
    })
    .eq('id', nodeId)
    .eq('version', currentVersion);

  if (error || !data || data.length === 0) {
    return false;
  }

  nodeVersionMap.set(nodeId, currentVersion + 1);
  return true;
}

// ============================================================================
// VALIDATION: Testing coordinate conversion
// ============================================================================

/**
 * Validate that coordinates convert correctly
 * Useful for tests and debugging
 */
export function validateCoordinateRoundtrip(
  dbNode: DbNode,
  vueFlowNode: VueFlowNode,
  allDbNodes: DbNode[]
): boolean {
  const tolerance = 0.01;

  // Convert DB → Vue Flow → DB
  const vueFlow = dbNodeToVueFlowNode(dbNode, allDbNodes);
  const backToDb = vueFlowNodeToDbPosition(vueFlow, allDbNodes);

  // Check position
  const posValid =
    Math.abs(backToDb.position.x - dbNode.position.x) < tolerance &&
    Math.abs(backToDb.position.y - dbNode.position.y) < tolerance;

  // Check size
  const sizeValid =
    backToDb.width === dbNode.width &&
    backToDb.height === dbNode.height;

  if (!posValid || !sizeValid) {
    console.error(
      `Coordinate conversion failed for ${dbNode.id}`,
      {
        original: { position: dbNode.position, width: dbNode.width, height: dbNode.height },
        roundtrip: backToDb
      }
    );
  }

  return posValid && sizeValid;
}

// ============================================================================
// EXAMPLE: Complete drag handler
// ============================================================================

export function createDragHandlers(
  supabaseClient: any,
  dbNodes: Ref<DbNode[]>,
  nodeVersionMap: Ref<Map<string, number>>,
  nodeState: ReturnType<typeof useNodeStateMachine>
) {
  return {
    onNodeDragStart: (event: any) => {
      const { node } = event;
      nodeState.setState(NodeState.DRAGGING_LOCAL);
      console.debug(`Started dragging node ${node.id}`);
    },

    onNodeDragStop: async (event: any) => {
      const { node } = event;

      if (!nodeState.canTransitionTo(NodeState.SYNCING)) {
        return;
      }

      nodeState.setState(NodeState.SYNCING);

      // Sync both position AND size
      const success = await syncNodePositionAndSize(
        supabaseClient,
        node,
        dbNodes.value,
        nodeVersionMap.value
      );

      if (success) {
        nodeState.setState(NodeState.IDLE);
        console.debug(`Synced node ${node.id}`);
      } else {
        nodeState.setState(NodeState.CONFLICT);
        console.warn(`Conflict syncing node ${node.id}`);
      }
    },

    onNodeResize: async (event: any) => {
      const { node } = event;

      if (!nodeState.canTransitionTo(NodeState.SYNCING)) {
        return;
      }

      nodeState.setState(NodeState.SYNCING);

      // Sync only size
      const success = await syncNodeSize(
        supabaseClient,
        node.id.replace('section-', ''),
        node.width,
        node.height,
        nodeVersionMap.value
      );

      if (success) {
        nodeState.setState(NodeState.IDLE);
        console.debug(`Synced size for node ${node.id}`);
      } else {
        nodeState.setState(NodeState.CONFLICT);
      }
    }
  };
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * The coordinate model:
 * 
 * DATABASE:
 * - Position: Always ABSOLUTE (world space)
 * - Size: Always explicit (width, height)
 * - Parent: Separate field (parentGroupId)
 * 
 * VUE FLOW (at render time):
 * - Position: Converted to RELATIVE (to parent)
 * - Size: Same as database
 * - ParentNode: Set if has parent
 * 
 * SYNCING (at drag/resize end):
 * - Position: Converted back to ABSOLUTE
 * - Size: Passed as-is
 * - Version: Incremented for conflict detection
 * 
 * KEY INSIGHT:
 * When parent moves, children don't need database updates!
 * Their absolute position stays the same, Vue Flow recalculates relative.
 */