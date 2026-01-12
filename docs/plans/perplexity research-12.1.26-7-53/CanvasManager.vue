/**
 * Canvas Task Manager Component
 * 
 * Integration example showing how to use:
 * - Coordinate conversion (coordinates.ts)
 * - State machine (state-machine.ts)
 * - Optimistic locking with Supabase
 * 
 * This replaces your 15+ composables with a cleaner architecture
 */

<template>
  <div class="canvas-container">
    <!-- Debug Panel (remove in production) -->
    <div v-if="DEBUG" class="debug-panel">
      <h3>State Machine Debug</h3>
      <p>Current State: {{ nodeState.getStateLabel() }}</p>
      <p>Syncing: {{ isSyncing }}</p>
      <p>Error: {{ syncError || 'None' }}</p>
      <pre>{{ JSON.stringify(nodeState.getDebugInfo(), null, 2) }}</pre>
    </div>

    <!-- Vue Flow Canvas -->
    <VueFlow
      :nodes="vueFlowNodes"
      :edges="vueFlowEdges"
      @node-drag-start="handleDragStart"
      @node-drag="handleDragMove"
      @node-drag-stop="handleDragEnd"
      @node-mouse-enter="handleNodeHover"
      @node-mouse-leave="handleNodeLeave"
    >
      <Background />
      <Controls />
    </VueFlow>

    <!-- Sync Conflict Notification -->
    <Transition name="fade">
      <div v-if="showConflictNotice" class="conflict-notice">
        <span>{{ conflictMessage }}</span>
        <button @click="handleConflictResolution">Retry</button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { VueFlow, Background, Controls, useVueFlow, type Node } from '@vue-flow/core';
import { createClient } from '@supabase/supabase-js';

// Import utilities
import {
  type DbNode,
  dbNodesToVueFlowNodes,
  toAbsolutePosition,
  toRelativePosition,
  useNodeSync,
  validateCoordinateConversion
} from '@/utils/coordinates';
import {
  useNodeStateMachine,
  NodeState,
  useNodeStateManager
} from '@/utils/state-machine';

// ============================================================================
// SETUP
// ============================================================================

const DEBUG = true; // Set to false in production

const supabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Data
const dbNodes = ref<DbNode[]>([]);
const nodeVersionMap = ref(new Map<string, number>());
const draggedNodeId = ref<string | null>(null);
const dragStartPosition = ref<{ x: number; y: number } | null>(null);

// State management
const nodeState = useNodeStateMachine();
const nodeStateManager = useNodeStateManager();
const { isSyncing, syncError, syncNodePosition, loadNodes } = useNodeSync(
  dbNodes,
  nodeVersionMap
);

// UI state
const showConflictNotice = ref(false);
const conflictMessage = ref('');

// Vue Flow integration
const { getNodes, setNodes } = useVueFlow();

// ============================================================================
// COMPUTED
// ============================================================================

const vueFlowNodes = computed(() => {
  return dbNodesToVueFlowNodes(dbNodes.value);
});

const vueFlowEdges = computed(() => {
  // Build edges from parent-child relationships
  return dbNodes.value
    .filter(node => node.parentGroupId)
    .map(node => ({
      id: `edge-${node.id}`,
      source: `section-${node.parentGroupId}`,
      target: `section-${node.id}`,
      hidden: true // Optional: hide visual edges
    }));
});

// ============================================================================
// LIFECYCLE
// ============================================================================

onMounted(async () => {
  await loadNodes(supabaseClient);
});

// Watch for external updates (WebSocket, polling, etc.)
// Only update if version changed (prevents unnecessary re-renders)
watch(
  () => dbNodes.value,
  (newNodes) => {
    // Validate coordinate conversions (debug only)
    if (DEBUG) {
      newNodes.forEach(dbNode => {
        const vueFlowNode = vueFlowNodes.value.find(
          n => n.id === `section-${dbNode.id}`
        );
        if (vueFlowNode) {
          validateCoordinateConversion(dbNode, vueFlowNode, newNodes);
        }
      });
    }
  },
  { deep: true }
);

// ============================================================================
// DRAG HANDLERS
// ============================================================================

/**
 * User starts dragging a node
 * Only update LOCAL state, don't sync yet
 */
function handleDragStart(event: any) {
  const { node } = event;
  const nodeId = node.id.replace('section-', '');

  // Update global state
  draggedNodeId.value = nodeId;
  dragStartPosition.value = { ...node.position };

  // Update state machine
  nodeState.setState(NodeState.DRAGGING_LOCAL, `User started dragging node ${nodeId}`);
  nodeStateManager.setNodeState(nodeId, NodeState.DRAGGING_LOCAL);

  console.debug(`[Drag Start] Node: ${nodeId}, Position: `, node.position);
}

/**
 * User is dragging a node
 * Vue Flow updates node.position in real-time (relative coordinates)
 * DON'T sync here - wait for drag end
 */
function handleDragMove(event: any) {
  // Optional: show visual feedback, but DON'T sync
  // Syncing on every pixel movement would cause race conditions
}

/**
 * User finished dragging - NOW we sync
 * Convert relative position to absolute and sync to database
 */
async function handleDragEnd(event: any) {
  const { node } = event;
  const nodeId = node.id.replace('section-', '');

  if (!nodeState.canTransitionTo(NodeState.SYNCING)) {
    console.warn('Cannot sync from current state:', nodeState.currentState.value);
    return;
  }

  // Update state machine
  nodeState.setState(NodeState.SYNCING, `Syncing node ${nodeId}`);
  nodeStateManager.setNodeState(nodeId, NodeState.SYNCING);

  // Sync to database
  const success = await syncNodePosition(
    supabaseClient,
    nodeId,
    node,
    dbNodes.value
  );

  if (success) {
    // Update state back to idle
    nodeState.setState(NodeState.IDLE, 'Sync succeeded');
    nodeStateManager.setNodeState(nodeId, NodeState.IDLE);

    console.debug(`[Drag End] Synced node ${nodeId}`);
  } else {
    // Conflict detected
    nodeState.setState(NodeState.CONFLICT, `Sync failed for ${nodeId}`);
    nodeStateManager.setNodeState(nodeId, NodeState.CONFLICT);

    showConflictNotice.value = true;
    conflictMessage.value = `Position conflict for node ${nodeId}. Another user may have moved it.`;

    console.warn(`[Conflict] ${conflictMessage.value}`);
  }

  // Clear drag state
  draggedNodeId.value = null;
  dragStartPosition.value = null;
}

// ============================================================================
// OTHER HANDLERS
// ============================================================================

function handleNodeHover(event: any) {
  // Optional: show node info, highlight connections, etc.
}

function handleNodeLeave(event: any) {
  // Optional: cleanup hover state
}

function handleConflictResolution() {
  showConflictNotice.value = false;
  nodeState.setState(NodeState.IDLE, 'User acknowledged conflict');
  // Optionally reload nodes from server
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

if (DEBUG) {
  // Make available in browser console for testing
  (window as any).__CANVAS_DEBUG = {
    dbNodes: () => dbNodes.value,
    vueFlowNodes: () => vueFlowNodes.value,
    nodeState: nodeState.getDebugInfo(),
    sync: {
      isSyncing: isSyncing.value,
      error: syncError.value
    },
    validateAllCoordinates: () => {
      let allValid = true;
      dbNodes.value.forEach(dbNode => {
        const vueFlowNode = vueFlowNodes.value.find(
          n => n.id === `section-${dbNode.id}`
        );
        if (vueFlowNode) {
          const valid = validateCoordinateConversion(dbNode, vueFlowNode, dbNodes.value);
          if (!valid) allValid = false;
        }
      });
      console.log(`Coordinate validation: ${allValid ? '✓ PASS' : '✗ FAIL'}`);
      return allValid;
    }
  };
}
</script>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
}

.debug-panel {
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.9);
  color: #0f0;
  padding: 15px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  max-width: 400px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
}

.debug-panel h3 {
  margin-top: 0;
  color: #0f0;
}

.debug-panel pre {
  background: rgba(255, 255, 255, 0.1);
  padding: 10px;
  border-radius: 2px;
  overflow-x: auto;
}

.conflict-notice {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #e74c3c;
  color: white;
  padding: 15px 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 999;
}

.conflict-notice button {
  background: white;
  color: #e74c3c;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
  font-weight: bold;
}

.conflict-notice button:hover {
  background: #f5f5f5;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>