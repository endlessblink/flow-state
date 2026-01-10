/**
 * Canvas Core Composable - Vue Flow initialization
 *
 * TASK-184: Canvas System Rebuild - Phase 1 & 2
 *
 * Responsibilities:
 * - Initialize Vue Flow instance
 * - Register node types
 * - Configure default options
 * - Handle basic Vue Flow events
 * - Sync nodes from store to Vue Flow
 */
import { ref, markRaw, computed, nextTick, type Ref } from 'vue'
import { useVueFlow, type Node, type Edge, type NodeChange, type EdgeChange } from '@vue-flow/core'
import GroupNodeNew from '@/components/canvasNew/GroupNodeNew.vue'
import TaskNodeNew from '@/components/canvasNew/TaskNodeNew.vue'

export interface UseCanvasCoreOptions {
  flowId?: string
}

export function useCanvasCore(options: UseCanvasCoreOptions = {}) {
  const { flowId = 'canvas-new' } = options

  // ============================================
  // VUE FLOW INSTANCE
  // ============================================

  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNodes,
    removeNodes,
    findNode,
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    onConnect,
    project,
    fitView,
    zoomIn,
    zoomOut,
    setViewport,
    getViewport
  } = useVueFlow({ id: flowId })

  // ============================================
  // NODE TYPES
  // ============================================

  // Register custom node components
  const nodeTypes = markRaw({
    sectionNode: GroupNodeNew,  // Phase 2: Group/section nodes
    taskNode: TaskNodeNew,      // Phase 3: Task nodes
  })

  // ============================================
  // DEFAULT OPTIONS
  // ============================================

  const defaultEdgeOptions = {
    type: 'smoothstep',
    animated: false
  }

  const flowOptions = {
    fitViewOnInit: false,
    zoomOnScroll: true,
    panOnScroll: false,
    panOnDrag: true,
    selectionOnDrag: false,
    snapToGrid: true,
    snapGrid: [10, 10] as [number, number],
    minZoom: 0.1,
    maxZoom: 4,
    defaultEdgeOptions
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  // Will be implemented in later phases
  function handleNodeDragStop(event: { node: Node }) {
    console.log('[CanvasNew] Node drag stop:', event.node.id)
    // Phase 4: Save position to store
  }

  function handleNodesChange(changes: NodeChange[]) {
    // Let Vue Flow handle the changes
    // Only log for debugging in Phase 1
    if (changes.some(c => c.type === 'position')) {
      console.log('[CanvasNew] Position changes:', changes.length)
    }
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    // Let Vue Flow handle the changes
    console.log('[CanvasNew] Edge changes:', changes.length)
  }

  function handleConnect(params: any) {
    console.log('[CanvasNew] Connect:', params)
    // Phase 6: Handle edge creation
  }

  // ============================================
  // UTILITIES
  // ============================================

  function screenToCanvas(screenX: number, screenY: number, containerRect: DOMRect) {
    return project({
      x: screenX - containerRect.left,
      y: screenY - containerRect.top
    })
  }

  function clearCanvas() {
    setNodes([])
    setEdges([])
  }

  // ============================================
  // SYNC - Phase 2
  // ============================================

  /**
   * Sync nodes from external sources (groups, tasks) to Vue Flow
   * Uses setNodes() + double nextTick as per BUG-152 fix
   */
  async function syncNodes(groupNodes: Node[], taskNodes: Node[] = []): Promise<void> {
    // Combine group and task nodes
    // Groups must come first so parent-child relationships work
    const allNodes = [...groupNodes, ...taskNodes]

    console.log('[CanvasCore] Syncing nodes:', {
      groups: groupNodes.length,
      tasks: taskNodes.length,
      total: allNodes.length
    })

    // Use setNodes() - triggers Vue Flow's proper initialization
    setNodes(allNodes)

    // CRITICAL: Double nextTick for parent-child discovery
    // First tick: Vue detects change, updates DOM
    // Second tick: Vue Flow processes parent-child relationships
    await nextTick()
    await nextTick()

    console.log('[CanvasCore] Nodes synced successfully')
  }

  // ============================================
  // RETURN
  // ============================================

  return {
    // Vue Flow state
    nodes,
    edges,

    // Vue Flow actions
    setNodes,
    setEdges,
    addNodes,
    removeNodes,
    findNode,
    project,
    fitView,
    zoomIn,
    zoomOut,
    setViewport,
    getViewport,

    // Configuration
    nodeTypes,
    defaultEdgeOptions,
    flowOptions,

    // Event handlers
    handleNodeDragStop,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,

    // Utilities
    screenToCanvas,
    clearCanvas,

    // Sync
    syncNodes
  }
}
