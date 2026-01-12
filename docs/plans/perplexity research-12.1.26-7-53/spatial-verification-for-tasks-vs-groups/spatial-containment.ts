/**
 * Spatial Containment Detection
 * 
 * Fixes the bug where tasks outside group bounds are treated as children
 * Only tasks PHYSICALLY INSIDE a group should be grouped together
 */

import type { DbNode, VueFlowNode } from './coordinates-with-size';
import { ref, computed, type Ref } from 'vue';

// ============================================================================
// CONTAINMENT DETECTION
// ============================================================================

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Get bounding box of a node
 */
export function getNodeBounds(node: DbNode): BoundingBox {
  return {
    minX: node.position.x,
    minY: node.position.y,
    maxX: node.position.x + node.width,
    maxY: node.position.y + node.height
  };
}

/**
 * Check if point is inside bounds
 */
export function isPointInBounds(point: { x: number; y: number }, bounds: BoundingBox): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

/**
 * Check if node is completely inside a group
 * (center point must be inside + some margin for safety)
 */
export function isNodeCompletelyInside(
  node: DbNode,
  container: DbNode,
  padding: number = 10
): boolean {
  // Get node center
  const nodeCenter = {
    x: node.position.x + node.width / 2,
    y: node.position.y + node.height / 2
  };

  // Get container bounds with padding
  const containerBounds = getNodeBounds(container);
  const paddedBounds = {
    minX: containerBounds.minX + padding,
    minY: containerBounds.minY + padding,
    maxX: containerBounds.maxX - padding,
    maxY: containerBounds.maxY - padding
  };

  // Node center must be inside padded container
  return isPointInBounds(nodeCenter, paddedBounds);
}

/**
 * Check if node overlaps with container
 * (even partially inside counts as overlapping)
 */
export function nodeOverlapsContainer(node: DbNode, container: DbNode): boolean {
  const nodeBounds = getNodeBounds(node);
  const containerBounds = getNodeBounds(container);

  // Check if rectangles overlap
  const noOverlap =
    nodeBounds.maxX < containerBounds.minX || // Node is to the left
    nodeBounds.minX > containerBounds.maxX || // Node is to the right
    nodeBounds.maxY < containerBounds.minY || // Node is above
    nodeBounds.minY > containerBounds.maxY;   // Node is below

  return !noOverlap;
}

/**
 * Find all groups that physically contain a node
 * Returns empty array if node is not in any group
 */
export function findContainingGroups(
  node: DbNode,
  allNodes: DbNode[]
): DbNode[] {
  const groups = allNodes.filter(n => n.type === 'group');
  
  return groups.filter(group => {
    // Don't check self
    if (node.id === group.id) return false;
    
    // Check if node is completely inside group
    return isNodeCompletelyInside(node, group);
  });
}

/**
 * Get the deepest (most nested) containing group
 * If node is in multiple groups, return the smallest one
 */
export function getDeepestContainingGroup(
  node: DbNode,
  allNodes: DbNode[]
): DbNode | null {
  const containingGroups = findContainingGroups(node, allNodes);
  
  if (containingGroups.length === 0) return null;
  
  // Return smallest group (by area)
  return containingGroups.reduce((smallest, current) => {
    const currentArea = current.width * current.height;
    const smallestArea = smallest.width * smallest.height;
    return currentArea < smallestArea ? current : smallest;
  });
}

/**
 * Auto-detect parent group based on spatial containment
 * This should run after any position update
 */
export function autoDetectParentGroup(
  node: DbNode,
  allDbNodes: DbNode[]
): string | null {
  // Don't auto-parent groups (they can be nested but rarely)
  if (node.type === 'group') return null;

  const containingGroup = getDeepestContainingGroup(node, allDbNodes);
  return containingGroup?.id || null;
}

/**
 * Validate parent-child relationships
 * Ensures parentGroupId matches actual spatial containment
 */
export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateContainment(
  node: DbNode,
  allDbNodes: DbNode[]
): ValidationResult {
  const issues: string[] = [];

  // If node has a parent, verify it's actually contained
  if (node.parentGroupId) {
    const parent = allDbNodes.find(n => n.id === node.parentGroupId);
    
    if (!parent) {
      issues.push(`Node references non-existent parent: ${node.parentGroupId}`);
    } else if (!isNodeCompletelyInside(node, parent)) {
      issues.push(
        `Node (${node.id}) claims parent (${parent.id}) but is not spatially contained`
      );
    }
  }

  // Check if node is inside a group but parentGroupId doesn't match
  const actualContainer = getDeepestContainingGroup(node, allDbNodes);
  if (actualContainer && node.parentGroupId !== actualContainer.id) {
    issues.push(
      `Node (${node.id}) is physically inside ${actualContainer.id} ` +
      `but parentGroupId is set to ${node.parentGroupId}`
    );
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

// ============================================================================
// CORRECTIONAL FUNCTIONS
// ============================================================================

/**
 * Fix incorrect parent assignments based on spatial containment
 * Returns array of nodes that were corrected
 */
export function fixContainmentIssues(
  allDbNodes: DbNode[]
): { nodeId: string; oldParent: string | null; newParent: string | null }[] {
  const corrections: { nodeId: string; oldParent: string | null; newParent: string | null }[] = [];

  for (const node of allDbNodes) {
    const validation = validateContainment(node, allDbNodes);
    
    if (!validation.valid) {
      const actualParent = autoDetectParentGroup(node, allDbNodes);
      const oldParent = node.parentGroupId;

      if (actualParent !== oldParent) {
        corrections.push({
          nodeId: node.id,
          oldParent: oldParent || null,
          newParent: actualParent
        });
      }
    }
  }

  return corrections;
}

// ============================================================================
// DRAG DETECTION: Should parent move with child?
// ============================================================================

/**
 * Determine if dragging a node should move its parent
 * Only if node stays inside parent AND parent is being dragged
 */
export function shouldNodeMoveWithParent(
  node: DbNode,
  parent: DbNode,
  nodeNewPosition: { x: number; y: number }
): boolean {
  // Create temporary node with new position to test containment
  const tempNode = { ...node, position: nodeNewPosition };
  
  // Node should move with parent if it stays contained
  return isNodeCompletelyInside(tempNode, parent);
}

/**
 * When parent is moved, calculate new positions for children
 * Only move children that are still contained
 */
export function recalculateChildPositions(
  parentOldPos: { x: number; y: number },
  parentNewPos: { x: number; y: number },
  allDbNodes: DbNode[]
): Map<string, { x: number; y: number }> {
  const delta = {
    x: parentNewPos.x - parentOldPos.x,
    y: parentNewPos.y - parentOldPos.y
  };

  const parentId = allDbNodes.find(
    n =>
      n.position.x === parentOldPos.x &&
      n.position.y === parentOldPos.y &&
      n.type === 'group'
  )?.id;

  if (!parentId) return new Map();

  const childrenToMove = new Map<string, { x: number; y: number }>();

  for (const node of allDbNodes) {
    if (node.parentGroupId === parentId) {
      childrenToMove.set(node.id, {
        x: node.position.x + delta.x,
        y: node.position.y + delta.y
      });
    }
  }

  return childrenToMove;
}

// ============================================================================
// COMPOSABLE: Spatial containment tracking
// ============================================================================

export function useSpatialContainment(
  dbNodes: Ref<DbNode[]>,
  nodeVersionMap: Ref<Map<string, number>>
) {
  const containmentErrors = ref<ValidationResult[]>([]);
  const correctionLog = ref<{ timestamp: string; changes: any[] }[]>([]);

  /**
   * Validate all nodes in the canvas
   */
  function validateAllNodes() {
    containmentErrors.value = [];

    for (const node of dbNodes.value) {
      const validation = validateContainment(node, dbNodes.value);
      if (!validation.valid) {
        containmentErrors.value.push(validation);
      }
    }

    return containmentErrors.value.length === 0;
  }

  /**
   * Auto-correct parent assignments based on spatial position
   */
  async function autoCorrectParents(supabaseClient: any) {
    const corrections = fixContainmentIssues(dbNodes.value);

    if (corrections.length === 0) {
      console.log('No containment issues found');
      return;
    }

    console.warn(`Found ${corrections.length} containment issues. Correcting...`);

    for (const correction of corrections) {
      const currentVersion = nodeVersionMap.value.get(correction.nodeId) || 1;

      const { error } = await supabaseClient
        .from('nodes')
        .update({
          parent_group_id: correction.newParent,
          version: currentVersion + 1
        })
        .eq('id', correction.nodeId)
        .eq('version', currentVersion);

      if (!error) {
        nodeVersionMap.value.set(correction.nodeId, currentVersion + 1);
        console.log(`✓ Fixed parent for ${correction.nodeId}`);
      } else {
        console.error(`✗ Failed to fix ${correction.nodeId}:`, error);
      }
    }

    correctionLog.value.push({
      timestamp: new Date().toISOString(),
      changes: corrections
    });
  }

  /**
   * Get all nodes that are visually inside a group
   * Ignores the parentGroupId field - uses spatial detection only
   */
  const getVisuallyContainedNodes = computed(() => {
    return (groupId: string) => {
      const group = dbNodes.value.find(n => n.id === groupId && n.type === 'group');
      if (!group) return [];

      return dbNodes.value.filter(node => {
        if (node.id === group.id) return false; // Exclude self
        return isNodeCompletelyInside(node, group);
      });
    };
  });

  /**
   * Get all nodes that claim to have a certain parent
   * Uses parentGroupId field only
   */
  const getClaimedChildren = computed(() => {
    return (groupId: string) => {
      return dbNodes.value.filter(n => n.parentGroupId === groupId);
    };
  });

  /**
   * Compare visual containment vs claimed parents
   * Shows what's wrong
   */
  const getContainmentMismatches = computed(() => {
    const mismatches: { nodeId: string; visualParent: string | null; claimedParent: string | null }[] =
      [];

    for (const node of dbNodes.value) {
      const visualParent = getDeepestContainingGroup(node, dbNodes.value)?.id || null;
      const claimedParent = node.parentGroupId || null;

      if (visualParent !== claimedParent) {
        mismatches.push({
          nodeId: node.id,
          visualParent,
          claimedParent
        });
      }
    }

    return mismatches;
  });

  return {
    containmentErrors: computed(() => containmentErrors.value),
    correctionLog: computed(() => correctionLog.value),
    validateAllNodes,
    autoCorrectParents,
    getVisuallyContainedNodes,
    getClaimedChildren,
    getContainmentMismatches
  };
}

// ============================================================================
// DEBUG & VISUALIZATION
// ============================================================================

/**
 * Get debug info about a node's containment
 */
export function getContainmentDebugInfo(
  nodeId: string,
  allDbNodes: DbNode[]
): {
  node: DbNode | undefined;
  claimedParent: DbNode | undefined;
  visualParent: DbNode | null;
  overlappingGroups: DbNode[];
  isValid: boolean;
  issues: string[];
} {
  const node = allDbNodes.find(n => n.id === nodeId);
  if (!node) return { node: undefined, claimedParent: undefined, visualParent: null, overlappingGroups: [], isValid: false, issues: ['Node not found'] };

  const claimedParent = node.parentGroupId
    ? allDbNodes.find(n => n.id === node.parentGroupId)
    : undefined;

  const visualParent = getDeepestContainingGroup(node, allDbNodes);
  const overlappingGroups = allDbNodes.filter(
    n => n.type === 'group' && nodeOverlapsContainer(node, n)
  );

  const validation = validateContainment(node, allDbNodes);

  return {
    node,
    claimedParent,
    visualParent,
    overlappingGroups,
    isValid: validation.valid,
    issues: validation.issues
  };
}

/**
 * Log containment state to console
 */
export function logContainmentDebug(allDbNodes: DbNode[]) {
  console.group('🔍 Spatial Containment Debug');

  for (const node of allDbNodes) {
    const info = getContainmentDebugInfo(node.id, allDbNodes);
    const status = info.isValid ? '✓' : '✗';

    console.log(`${status} ${node.id} (${node.type})`);
    console.log(`   Position: (${node.position.x}, ${node.position.y})`);
    console.log(`   Size: ${node.width}x${node.height}`);
    console.log(`   Claimed Parent: ${info.claimedParent?.id || 'none'}`);
    console.log(`   Visual Parent: ${info.visualParent?.id || 'none'}`);

    if (info.issues.length > 0) {
      console.error(`   Issues:`, info.issues);
    }
  }

  console.groupEnd();
}

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * Key functions:
 * 
 * DETECTION:
 * - getNodeBounds() - Get bounding box
 * - isNodeCompletelyInside() - Check if physically inside group
 * - findContainingGroups() - Find all containing groups
 * - getDeepestContainingGroup() - Find most nested containing group
 * 
 * VALIDATION:
 * - validateContainment() - Check parent matches spatial position
 * - fixContainmentIssues() - Auto-correct bad parents
 * 
 * CORRECTION:
 * - autoDetectParentGroup() - Determine correct parent from position
 * - autoCorrectParents() - Sync database with spatial reality
 * 
 * DEBUGGING:
 * - getContainmentDebugInfo() - Get status of one node
 * - logContainmentDebug() - Log all nodes' containment state
 * - useSpatialContainment() - Composable for tracking
 */