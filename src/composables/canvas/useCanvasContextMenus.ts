import { ref, computed } from 'vue'

/**
 * Canvas Context Menu State Management Composable
 *
 * Extracted from CanvasView.vue to centralize all context menu state
 * and provide a clean interface for context menu operations.
 *
 * This composable manages:
 * - Canvas Context Menu (canvas background right-click)
 * - Edge Context Menu (connection/edge right-click)
 * - Node Context Menu (node/section right-click)
 * - All context menu position tracking
 * - Context menu visibility state
 */

export interface ContextMenuPosition {
  x: number
  y: number
}

export interface ContextMenuData {
  node?: any
  edge?: any
  task?: any
  section?: any
}

export function useCanvasContextMenus() {
  // Canvas Context Menu state
  const showCanvasContextMenu = ref(false)
  const canvasContextMenuX = ref(0)
  const canvasContextMenuY = ref(0)

  // Edge Context Menu state
  const showEdgeContextMenu = ref(false)
  const edgeContextMenuX = ref(0)
  const edgeContextMenuY = ref(0)

  // Node Context Menu state
  const showNodeContextMenu = ref(false)
  const nodeContextMenuX = ref(0)
  const nodeContextMenuY = ref(0)

  // Context menu data
  const selectedNode = ref<any>(null)
  const selectedEdge = ref<any>(null)
  const selectedTask = ref<any>(null)
  const selectedSection = ref<any>(null)

  // Canvas Context Menu methods
  const openCanvasContextMenu = (x: number, y: number, data?: ContextMenuData) => {
    canvasContextMenuX.value = x
    canvasContextMenuY.value = y
    selectedTask.value = data?.task || null
    selectedSection.value = data?.section || null
    showCanvasContextMenu.value = true
  }

  const closeCanvasContextMenu = () => {
    showCanvasContextMenu.value = false
  }

  // Edge Context Menu methods
  const openEdgeContextMenu = (x: number, y: number, edge?: any) => {
    edgeContextMenuX.value = x
    edgeContextMenuY.value = y
    selectedEdge.value = edge || null
    showEdgeContextMenu.value = true
    closeCanvasContextMenu()
    closeNodeContextMenu()
  }

  const closeEdgeContextMenu = () => {
    showEdgeContextMenu.value = false
    selectedEdge.value = null
  }

  // Node Context Menu methods
  const openNodeContextMenu = (x: number, y: number, node?: any) => {
    nodeContextMenuX.value = x
    nodeContextMenuY.value = y
    selectedNode.value = node || null
    showNodeContextMenu.value = true
    closeCanvasContextMenu()
    closeEdgeContextMenu()
  }

  const closeNodeContextMenu = () => {
    showNodeContextMenu.value = false
    selectedNode.value = null
  }

  // Close all context menus
  const closeAllContextMenus = () => {
    closeCanvasContextMenu()
    closeEdgeContextMenu()
    closeNodeContextMenu()
  }

  // Canvas coordinates calculation helper
  const getCanvasCoordinates = (screenX: number, screenY: number, viewport: any, rect: DOMRect) => {
    const canvasX = (screenX - rect.left - viewport.x) / viewport.zoom
    const canvasY = (screenY - rect.top - viewport.y) / viewport.zoom

    return { x: canvasX, y: canvasY }
  }

  // Context menu visibility checks
  const hasOpenContextMenu = computed(() => {
    return showCanvasContextMenu.value ||
           showEdgeContextMenu.value ||
           showNodeContextMenu.value
  })

  const openContextMenuCount = computed(() => {
    let count = 0
    if (showCanvasContextMenu.value) count++
    if (showEdgeContextMenu.value) count++
    if (showNodeContextMenu.value) count++
    return count
  })

  return {
    // State
    showCanvasContextMenu,
    canvasContextMenuX,
    canvasContextMenuY,
    showEdgeContextMenu,
    edgeContextMenuX,
    edgeContextMenuY,
    showNodeContextMenu,
    nodeContextMenuX,
    nodeContextMenuY,
    selectedNode,
    selectedEdge,
    selectedTask,
    selectedSection,

    // Computed
    hasOpenContextMenu,
    openContextMenuCount,

    // Canvas Context Menu methods
    openCanvasContextMenu,
    closeCanvasContextMenu,

    // Edge Context Menu methods
    openEdgeContextMenu,
    closeEdgeContextMenu,

    // Node Context Menu methods
    openNodeContextMenu,
    closeNodeContextMenu,

    // Utility methods
    closeAllContextMenus,
    getCanvasCoordinates
  }
}