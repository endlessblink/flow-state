/**
 * Node State Machine
 * 
 * Replaces 7+ boolean flags with a single state machine
 * Prevents impossible states like isDragging + isSync + isConverting
 */

import { ref, computed, type Ref } from 'vue';

/**
 * Valid states for a canvas node
 */
export enum NodeState {
  IDLE = 'idle',
  DRAGGING_LOCAL = 'dragging_local',
  SYNCING = 'syncing',
  CONFLICT = 'conflict',
  RESIZING = 'resizing',
  LOADING = 'loading',
  ERROR = 'error'
}

/**
 * Define valid state transitions
 * Prevents impossible states like DRAGGING → ERROR → DRAGGING
 */
const STATE_TRANSITIONS: Record<NodeState, NodeState[]> = {
  [NodeState.IDLE]: [
    NodeState.DRAGGING_LOCAL,
    NodeState.RESIZING,
    NodeState.LOADING,
    NodeState.SYNCING
  ],
  [NodeState.DRAGGING_LOCAL]: [
    NodeState.SYNCING,
    NodeState.IDLE
  ],
  [NodeState.SYNCING]: [
    NodeState.IDLE,
    NodeState.CONFLICT,
    NodeState.ERROR
  ],
  [NodeState.CONFLICT]: [
    NodeState.DRAGGING_LOCAL,
    NodeState.IDLE,
    NodeState.SYNCING
  ],
  [NodeState.RESIZING]: [
    NodeState.SYNCING,
    NodeState.IDLE,
    NodeState.ERROR
  ],
  [NodeState.LOADING]: [
    NodeState.IDLE,
    NodeState.ERROR
  ],
  [NodeState.ERROR]: [
    NodeState.IDLE,
    NodeState.SYNCING,
    NodeState.DRAGGING_LOCAL
  ]
};

/**
 * Composable for managing node state machine
 * Usage:
 *   const state = useNodeStateMachine();
 *   state.setState(NodeState.DRAGGING_LOCAL);
 *   if (state.canTransitionTo(NodeState.SYNCING)) { ... }
 */
export function useNodeStateMachine(initialState: NodeState = NodeState.IDLE) {
  const currentState: Ref<NodeState> = ref(initialState);
  const lastError: Ref<string | null> = ref(null);
  const stateHistory: Ref<{ state: NodeState; timestamp: number }[]> = ref([]);

  /**
   * Check if transition is valid
   */
  function canTransitionTo(targetState: NodeState): boolean {
    return STATE_TRANSITIONS[currentState.value].includes(targetState);
  }

  /**
   * Attempt state transition
   * Returns true if successful, false if invalid
   */
  function setState(targetState: NodeState, reason?: string): boolean {
    if (!canTransitionTo(targetState)) {
      console.warn(
        `Invalid state transition: ${currentState.value} → ${targetState}` +
        (reason ? ` (${reason})` : '')
      );
      return false;
    }

    const previousState = currentState.value;
    currentState.value = targetState;

    // Track state history for debugging
    stateHistory.value.push({
      state: targetState,
      timestamp: Date.now()
    });

    // Keep only last 50 state changes
    if (stateHistory.value.length > 50) {
      stateHistory.value = stateHistory.value.slice(-50);
    }

    console.debug(
      `State transition: ${previousState} → ${targetState}` +
      (reason ? ` (${reason})` : '')
    );

    return true;
  }

  /**
   * Move to error state with message
   */
  function setError(message: string): boolean {
    lastError.value = message;
    return setState(NodeState.ERROR, message);
  }

  /**
   * Get human-readable state label
   */
  function getStateLabel(state: NodeState = currentState.value): string {
    const labels: Record<NodeState, string> = {
      [NodeState.IDLE]: 'Idle',
      [NodeState.DRAGGING_LOCAL]: 'Dragging',
      [NodeState.SYNCING]: 'Syncing with server',
      [NodeState.CONFLICT]: 'Conflict detected',
      [NodeState.RESIZING]: 'Resizing',
      [NodeState.LOADING]: 'Loading',
      [NodeState.ERROR]: 'Error'
    };
    return labels[state] || 'Unknown';
  }

  /**
   * Get UI styling based on state
   */
  function getStateStyles(state: NodeState = currentState.value) {
    const styles: Record<NodeState, { opacity: number; pointerEvents: string }> = {
      [NodeState.IDLE]: { opacity: 1, pointerEvents: 'auto' },
      [NodeState.DRAGGING_LOCAL]: { opacity: 0.8, pointerEvents: 'none' },
      [NodeState.SYNCING]: { opacity: 0.6, pointerEvents: 'none' },
      [NodeState.CONFLICT]: { opacity: 0.7, pointerEvents: 'auto' },
      [NodeState.RESIZING]: { opacity: 0.8, pointerEvents: 'none' },
      [NodeState.LOADING]: { opacity: 0.6, pointerEvents: 'none' },
      [NodeState.ERROR]: { opacity: 0.9, pointerEvents: 'auto' }
    };
    return styles[state] || { opacity: 1, pointerEvents: 'auto' };
  }

  /**
   * Get visual indicator (color, icon, etc.)
   */
  function getStateIndicator(state: NodeState = currentState.value): {
    color: string;
    icon: string;
    animate: boolean;
  } {
    const indicators: Record<NodeState, any> = {
      [NodeState.IDLE]: {
        color: '#4a90e2',
        icon: '●',
        animate: false
      },
      [NodeState.DRAGGING_LOCAL]: {
        color: '#f39c12',
        icon: '⋮',
        animate: true
      },
      [NodeState.SYNCING]: {
        color: '#2ecc71',
        icon: '↻',
        animate: true
      },
      [NodeState.CONFLICT]: {
        color: '#e74c3c',
        icon: '⚠',
        animate: true
      },
      [NodeState.RESIZING]: {
        color: '#9b59b6',
        icon: '⤡',
        animate: true
      },
      [NodeState.LOADING]: {
        color: '#3498db',
        icon: '◆',
        animate: true
      },
      [NodeState.ERROR]: {
        color: '#c0392b',
        icon: '✕',
        animate: false
      }
    };
    return indicators[state] || indicators[NodeState.IDLE];
  }

  /**
   * Reset to idle (useful for cleanup)
   */
  function reset(): void {
    currentState.value = NodeState.IDLE;
    lastError.value = null;
  }

  /**
   * Get debug info
   */
  function getDebugInfo(): object {
    return {
      currentState: currentState.value,
      lastError: lastError.value,
      recentStateChanges: stateHistory.value.slice(-10).map(entry => ({
        state: entry.state,
        secondsAgo: Math.round((Date.now() - entry.timestamp) / 1000)
      })),
      validNextStates: STATE_TRANSITIONS[currentState.value]
    };
  }

  return {
    // State
    currentState: computed(() => currentState.value),
    lastError: computed(() => lastError.value),
    stateHistory: computed(() => stateHistory.value),

    // Methods
    setState,
    setError,
    canTransitionTo,
    reset,

    // UI Helpers
    getStateLabel,
    getStateStyles,
    getStateIndicator,

    // Debug
    getDebugInfo
  };
}

/**
 * Global state machine for managing multiple nodes
 * Usage:
 *   const nodeStates = useNodeStateManager();
 *   nodeStates.setNodeState('node-123', NodeState.DRAGGING_LOCAL);
 */
export function useNodeStateManager() {
  const nodeStates = new Map<string, ReturnType<typeof useNodeStateMachine>>();

  function getOrCreateNodeState(nodeId: string): ReturnType<typeof useNodeStateMachine> {
    if (!nodeStates.has(nodeId)) {
      nodeStates.set(nodeId, useNodeStateMachine());
    }
    return nodeStates.get(nodeId)!;
  }

  function setNodeState(nodeId: string, state: NodeState, reason?: string): boolean {
    return getOrCreateNodeState(nodeId).setState(state, reason);
  }

  function getNodeState(nodeId: string): NodeState {
    return getOrCreateNodeState(nodeId).currentState.value;
  }

  function canNodeTransitionTo(nodeId: string, state: NodeState): boolean {
    return getOrCreateNodeState(nodeId).canTransitionTo(state);
  }

  function resetNodeState(nodeId: string): void {
    getOrCreateNodeState(nodeId).reset();
  }

  function setNodeError(nodeId: string, message: string): boolean {
    return getOrCreateNodeState(nodeId).setError(message);
  }

  /**
   * Get all nodes in specific state
   */
  function getNodesInState(state: NodeState): string[] {
    const result: string[] = [];
    nodeStates.forEach((machine, nodeId) => {
      if (machine.currentState.value === state) {
        result.push(nodeId);
      }
    });
    return result;
  }

  /**
   * Cleanup state for node (e.g., after deletion)
   */
  function deleteNodeState(nodeId: string): void {
    nodeStates.delete(nodeId);
  }

  return {
    setNodeState,
    getNodeState,
    canNodeTransitionTo,
    resetNodeState,
    setNodeError,
    getNodesInState,
    deleteNodeState
  };
}