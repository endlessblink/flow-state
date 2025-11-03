import { ref, computed, type Ref } from 'vue'
import type { Edge } from '@vue-flow/core'
import { useTaskStore } from '@/stores/tasks'

/**
 * Canvas Edges Composable
 * Handles edge (connection) management, creation, and context menu operations
 */
export function useCanvasEdges() {
  const taskStore = useTaskStore()

  // ============================================
  // EDGE STATE
  // ============================================

  const edges = ref<Edge[]>([])
  const isConnecting = ref(false)

  // Edge context menu state
  const showEdgeContextMenu = ref(false)
  const edgeContextMenuX = ref(0)
  const edgeContextMenuY = ref(0)
  const selectedEdge = ref<any>(null)

  // ============================================
  // STYLE HELPERS
  // ============================================

  /**
   * Glass morphism edge handles - Vertical pills for wide sections
   */
  const edgeHandleStyle = computed(() => ({
    width: '6px',
    height: '24px',
    borderRadius: '3px',
    background: 'rgba(255, 255, 255, 0.3)',
    border: '1.5px solid rgba(99, 102, 241, 0.6)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  }))

  // ============================================
  // EDGE SYNC
  // ============================================

  /**
   * Sync edges from task dependencies
   * Creates edges only for valid dependencies where both tasks exist on canvas
   */
  const syncEdges = () => {
    const allEdges: Edge[] = []
    const taskIds = new Set(taskStore.filteredTasks.map(t => t.id))

    taskStore.filteredTasks.forEach(task => {
      if (task.dependsOn && Array.isArray(task.dependsOn)) {
        // Filter out invalid dependencies (tasks that no longer exist)
        const validDependencies = task.dependsOn.filter(depId => taskIds.has(depId))

        // Update task if dependencies were cleaned up
        if (validDependencies.length !== task.dependsOn.length) {
          taskStore.updateTaskWithUndo(task.id, { dependsOn: validDependencies })
        }

        // Create edges only for valid dependencies where source and target both exist
        validDependencies.forEach(depId => {
          const sourceTask = taskStore.tasks.find(t => t.id === depId)
          const targetTask = taskStore.tasks.find(t => t.id === task.id)

          // Only create edge if both source and target tasks exist and are on canvas
          if (sourceTask && targetTask &&
              sourceTask.canvasPosition && targetTask.canvasPosition) {
            allEdges.push({
              id: `${depId}-${task.id}`,
              source: depId,
              target: task.id,
              type: task.connectionTypes?.[depId] || 'default',
              animated: false
            })
          }
        })
      }
    })

    edges.value = allEdges
  }

  // ============================================
  // CONNECTION HANDLERS
  // ============================================

  /**
   * Handle connection start - set connection state to prevent context menus
   */
  const handleConnectStart = (event: any, closeAllMenus: () => void) => {
    console.log('🔗 Connection started:', event)
    isConnecting.value = true

    // Clear any existing context menus
    closeAllMenus()
  }

  /**
   * Handle connection end - clear connection state
   */
  const handleConnectEnd = (event: any) => {
    console.log('🔗 Connection ended:', event)
    // Add a small delay to ensure all connection logic completes
    setTimeout(() => {
      isConnecting.value = false
    }, 100)
  }

  /**
   * Handle connection creation - creates task dependency
   */
  const handleConnect = (connection: any, closeAllMenus: () => void) => {
    console.log('🔗 Connection attempt:', connection)
    const { source, target } = connection

    // Clear any existing context menus first
    closeAllMenus()

    // Don't allow connections to/from sections
    if (source.startsWith('section-') || target.startsWith('section-')) {
      console.log('❌ Connection rejected: section involvement')
      return
    }

    // Don't allow self-connections
    if (source === target) {
      console.log('❌ Connection rejected: self-connection')
      return
    }

    // Only create connections if both source and target tasks exist and are on canvas
    const sourceTask = taskStore.tasks.find(t => t.id === source)
    const targetTask = taskStore.tasks.find(t => t.id === target)

    if (sourceTask && targetTask && sourceTask.canvasPosition && targetTask.canvasPosition) {
      const dependsOn = targetTask.dependsOn || []
      if (!dependsOn.includes(source)) {
        console.log('✅ Creating dependency:', source, '→', target)
        taskStore.updateTaskWithUndo(target, {
          dependsOn: [...dependsOn, source]
        })
        syncEdges() // Re-sync edges to show new connection
      } else {
        console.log('⚠️ Dependency already exists:', source, '→', target)
      }
    } else {
      console.log('❌ Connection rejected: missing tasks or canvas positions')
    }
  }

  // ============================================
  // EDGE CONTEXT MENU
  // ============================================

  /**
   * Handle edge context menu (right-click on edge)
   */
  const handleEdgeContextMenu = (event: { event: MouseEvent; edge: any }, closeOtherMenus: () => void) => {
    event.event.preventDefault()
    edgeContextMenuX.value = event.event.clientX
    edgeContextMenuY.value = event.event.clientY
    selectedEdge.value = event.edge
    showEdgeContextMenu.value = true
    closeOtherMenus()
  }

  /**
   * Close edge context menu
   */
  const closeEdgeContextMenu = () => {
    showEdgeContextMenu.value = false
    selectedEdge.value = null
  }

  /**
   * Disconnect edge (remove dependency)
   */
  const disconnectEdge = () => {
    if (!selectedEdge.value) return

    const { source, target } = selectedEdge.value
    const targetTask = taskStore.tasks.find(t => t.id === target)

    if (targetTask && targetTask.dependsOn) {
      const updatedDependsOn = targetTask.dependsOn.filter(id => id !== source)
      taskStore.updateTaskWithUndo(target, { dependsOn: updatedDependsOn })
      syncEdges()
    }

    closeEdgeContextMenu()
  }

  // ============================================
  // RETURN PUBLIC API
  // ============================================

  return {
    // State
    edges,
    isConnecting,

    // Edge context menu state
    showEdgeContextMenu,
    edgeContextMenuX,
    edgeContextMenuY,
    selectedEdge,

    // Style helpers
    edgeHandleStyle,

    // Edge sync
    syncEdges,

    // Connection handlers
    handleConnectStart,
    handleConnectEnd,
    handleConnect,

    // Edge context menu handlers
    handleEdgeContextMenu,
    closeEdgeContextMenu,
    disconnectEdge
  }
}
