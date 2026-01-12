/**
 * Drag Handler Integration with Spatial Containment
 * 
 * Shows how to properly handle drags with spatial containment detection
 * Only groups tasks that are ACTUALLY inside the group bounds
 */

import {
  dbNodeToVueFlowNode,
  vueFlowNodeToDbPosition,
  type DbNode,
  type VueFlowNode
} from './coordinates-with-size';

import {
  isNodeCompletelyInside,
  getDeepestContainingGroup,
  useSpatialContainment
} from './spatial-containment';

import { useNodeStateMachine, NodeState } from './state-machine';
import { ref, type Ref } from 'vue';

// ============================================================================
// CORRECTED DRAG HANDLER WITH SPATIAL CONTAINMENT
// ============================================================================

/**
 * When user drags a node:
 * 1. Update position
 * 2. Detect which group it's ACTUALLY in (spatial)
 * 3. Update parentGroupId if changed
 * 4. Sync to database
 */
export async function handleNodeDragEndWithContainment(
  event: any,
  supabaseClient: any,
  dbNodes: Ref<DbNode[]>,
  nodeVersionMap: Ref<Map<string, number>>,
  nodeState: ReturnType<typeof useNodeStateMachine>
): Promise<void> {
  const vueFlowNode = event.node as VueFlowNode;
  const nodeId = vueFlowNode.id.replace('section-', '');

  if (!nodeState.canTransitionTo(NodeState.SYNCING)) {
    console.warn(`Cannot sync from state: ${nodeState.currentState.value}`);
    return;
  }

  nodeState.setState(NodeState.SYNCING, `Syncing node ${nodeId} after drag`);

  try {
    // 1. Convert Vue Flow position (relative) to absolute
    const { position: absolutePosition, width, height } = vueFlowNodeToDbPosition(
      vueFlowNode,
      dbNodes.value
    );

    // 2. Find what group this node is ACTUALLY in (spatial detection)
    const movedNode = { 
      ...dbNodes.value.find(n => n.id === nodeId)!,
      position: absolutePosition 
    };
    
    const actualContainingGroup = getDeepestContainingGroup(movedNode, dbNodes.value);
    const correctParentId = actualContainingGroup?.id || null;

    // 3. Get current state from database
    const dbNode = dbNodes.value.find(n => n.id === nodeId);
    const oldParentId = dbNode?.parentGroupId || null;
    const currentVersion = nodeVersionMap.value.get(nodeId);

    if (!currentVersion) {
      nodeState.setError(`No version found for node ${nodeId}`);
      return;
    }

    // 4. Sync to database
    const updatePayload: any = {
      position: absolutePosition,
      width,
      height,
      version: currentVersion + 1
    };

    // Only update parent if it changed
    if (correctParentId !== oldParentId) {
      console.log(
        `Node ${nodeId} moved from group ${oldParentId || 'none'} to ${correctParentId || 'none'}`
      );
      updatePayload.parent_group_id = correctParentId;
    }

    const { data, error } = await supabaseClient
      .from('nodes')
      .update(updatePayload)
      .eq('id', nodeId)
      .eq('version', currentVersion);

    if (error) {
      nodeState.setError(`Sync error: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      nodeState.setState(NodeState.CONFLICT, `Version conflict for ${nodeId}`);
      return;
    }

    // 5. Update local state
    nodeVersionMap.value.set(nodeId, currentVersion + 1);
    
    // Update the node in memory
    if (dbNode) {
      dbNode.position = absolutePosition;
      dbNode.width = width;
      dbNode.height = height;
      dbNode.parentGroupId = correctParentId;
      dbNode.version = currentVersion + 1;
    }

    nodeState.setState(NodeState.IDLE, `Synced node ${nodeId}`);
    console.debug(`✓ Synced ${nodeId}: parent=${correctParentId || 'none'}, pos=(${absolutePosition.x}, ${absolutePosition.y})`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    nodeState.setError(`Error during drag: ${message}`);
    console.error('Drag sync error:', err);
  }
}

// ============================================================================
// CANVAS LOAD: AUTO-FIX PARENT ASSIGNMENTS
// ============================================================================

/**
 * When loading the canvas, validate and fix parent assignments
 * based on spatial containment
 */
export async function loadCanvasAndValidateContainment(
  supabaseClient: any,
  dbNodes: Ref<DbNode[]>,
  nodeVersionMap: Ref<Map<string, number>>
): Promise<{ loadedCount: number; fixedCount: number }> {
  // Load all nodes
  const { data, error } = await supabaseClient.from('nodes').select('*');

  if (error) {
    console.error('Failed to load nodes:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.log('No nodes to load');
    return { loadedCount: 0, fixedCount: 0 };
  }

  dbNodes.value = data;

  // Initialize version map
  data.forEach((node: DbNode) => {
    nodeVersionMap.value.set(node.id, node.version || 1);
  });

  console.log(`✓ Loaded ${data.length} nodes`);

  // Use spatial containment composable to validate
  const { getContainmentMismatches } = useSpatialContainment(dbNodes, nodeVersionMap);
  const mismatches = getContainmentMismatches.value;

  if (mismatches.length === 0) {
    console.log('✓ All nodes have correct parent assignments');
    return { loadedCount: data.length, fixedCount: 0 };
  }

  console.warn(`⚠ Found ${mismatches.length} containment mismatches. Fixing...`);

  // Fix each mismatch
  let fixedCount = 0;
  for (const mismatch of mismatches) {
    const node = dbNodes.value.find(n => n.id === mismatch.nodeId);
    if (!node) continue;

    const currentVersion = nodeVersionMap.value.get(node.id) || 1;

    const { error: updateError } = await supabaseClient
      .from('nodes')
      .update({
        parent_group_id: mismatch.visualParent,
        version: currentVersion + 1
      })
      .eq('id', node.id)
      .eq('version', currentVersion);

    if (!updateError) {
      node.parentGroupId = mismatch.visualParent;
      node.version = currentVersion + 1;
      nodeVersionMap.value.set(node.id, currentVersion + 1);
      fixedCount++;
      console.log(`  ✓ Fixed ${node.id}: parent=${mismatch.visualParent || 'none'}`);
    } else {
      console.error(`  ✗ Failed to fix ${node.id}:`, updateError);
    }
  }

  console.log(`✓ Fixed ${fixedCount}/${mismatches.length} nodes`);
  return { loadedCount: data.length, fixedCount };
}

// ============================================================================
// VUE FLOW CONVERSION: With Spatial Verification
// ============================================================================

/**
 * Convert DB nodes to Vue Flow nodes
 * CRITICAL: Verify spatial containment before setting parentNode
 */
export function dbNodesToVueFlowNodesWithVerification(
  dbNodes: DbNode[]
): VueFlowNode[] {
  return dbNodes.map(dbNode => {
    // Get claimed parent from database
    let parent = dbNode.parentGroupId
      ? dbNodes.find(n => n.id === dbNode.parentGroupId)
      : null;

    // CRITICAL VALIDATION: Check if node is actually inside the claimed parent
    if (parent && !isNodeCompletelyInside(dbNode, parent)) {
      console.warn(
        `⚠️  Containment mismatch: Node "${dbNode.id}" claims parent ` +
        `"${parent.id}" but is NOT spatially contained. Removing parent.`
      );
      parent = null; // Don't set Vue Flow parentNode!
    }

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
        dbPosition: dbNode.position,
        parentVerified: parent !== null
      },
      position,
      parentNode: parent ? `section-${parent.id}` : undefined,
      width: dbNode.width,
      height: dbNode.height,
      draggable: true,
      style: {
        border: dbNode.type === 'group' ? '2px solid #4a90e2' : '1px solid #666',
        opacity: parent ? 1 : 1 // Could add visual indicator if parent mismatch
      }
    };
  });
}

// ============================================================================
// COMPOSABLE: Complete setup with containment
// ============================================================================

export function useCanvasWithContainment() {
  const dbNodes = ref<DbNode[]>([]);
  const nodeVersionMap = ref(new Map<string, number>());
  const nodeState = useNodeStateMachine();

  const { validateAllNodes, getContainmentMismatches } = useSpatialContainment(
    dbNodes,
    nodeVersionMap
  );

  /**
   * Setup canvas on mount
   */
  async function initializeCanvas(supabaseClient: any) {
    try {
      const { loadedCount, fixedCount } = await loadCanvasAndValidateContainment(
        supabaseClient,
        dbNodes,
        nodeVersionMap
      );

      if (fixedCount > 0) {
        console.log(`🔧 Auto-fixed ${fixedCount} parent assignments`);
      }

      return { success: true, loadedCount, fixedCount };
    } catch (err) {
      console.error('Failed to initialize canvas:', err);
      return { success: false, loadedCount: 0, fixedCount: 0 };
    }
  }

  /**
   * Validate current state (useful for debugging)
   */
  function validateCurrentState() {
    const mismatches = getContainmentMismatches.value;
    
    if (mismatches.length === 0) {
      console.log('✓ Canvas is spatially valid');
      return true;
    }

    console.warn(`⚠ ${mismatches.length} containment issues found:`);
    mismatches.forEach(m => {
      console.log(`  ${m.nodeId}: claims "${m.claimedParent}", actually in "${m.visualParent}"`);
    });

    return false;
  }

  return {
    dbNodes,
    nodeVersionMap,
    nodeState,
    initializeCanvas,
    validateCurrentState,
    getContainmentMismatches
  };
}

// ============================================================================
// DEBUGGING: Console helpers
// ============================================================================

/**
 * Quick debug in browser console
 */
export const DebugHelpers = {
  /**
   * Check status of one node
   * Usage: DebugHelpers.checkNode('task-1', allDbNodes)
   */
  checkNode: (nodeId: string, allDbNodes: DbNode[]) => {
    const node = allDbNodes.find(n => n.id === nodeId);
    if (!node) {
      console.log(`Node ${nodeId} not found`);
      return;
    }

    const claimedParent = node.parentGroupId
      ? allDbNodes.find(n => n.id === node.parentGroupId)
      : null;

    const actualParent = getDeepestContainingGroup(node, allDbNodes);

    console.group(`📍 Node "${nodeId}"`);
    console.log(`Position: (${node.position.x}, ${node.position.y})`);
    console.log(`Size: ${node.width}x${node.height}`);
    console.log(`Claimed Parent: ${claimedParent?.id || 'none'}`);
    console.log(`Actual Parent (spatial): ${actualParent?.id || 'none'}`);
    console.log(`Match: ${claimedParent?.id === actualParent?.id ? '✓' : '✗'}`);
    console.groupEnd();
  },

  /**
   * Check all nodes
   * Usage: DebugHelpers.checkAll(allDbNodes)
   */
  checkAll: (allDbNodes: DbNode[]) => {
    console.log(`Checking ${allDbNodes.length} nodes...`);
    allDbNodes.forEach(node => {
      const claimedParent = node.parentGroupId;
      const actualParent = getDeepestContainingGroup(node, allDbNodes)?.id || null;
      
      if (claimedParent !== actualParent) {
        console.warn(
          `✗ ${node.id}: claims "${claimedParent}", actually in "${actualParent}"`
        );
      }
    });
  }
};

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * Implementation guide:
 * 
 * 1. ON MOUNT:
 *    const canvas = useCanvasWithContainment();
 *    await canvas.initializeCanvas(supabaseClient);
 *    // Auto-fixes any parent mismatches
 * 
 * 2. ON DRAG END:
 *    await handleNodeDragEndWithContainment(
 *      event,
 *      supabaseClient,
 *      dbNodes,
 *      nodeVersionMap,
 *      nodeState
 *    );
 *    // Re-detects parent based on spatial position
 * 
 * 3. ON RENDER:
 *    const vueFlowNodes = dbNodesToVueFlowNodesWithVerification(dbNodes.value);
 *    // Only sets parentNode if spatial containment verified
 * 
 * 4. DEBUGGING:
 *    DebugHelpers.checkNode('task-1', dbNodes.value);
 *    DebugHelpers.checkAll(dbNodes.value);
 */