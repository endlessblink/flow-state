import { ref, type Ref } from 'vue'
import { useVueFlow, type Node, type Viewport } from '@vue-flow/core'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

/**
 * Canvas Context Menus Composable
 * Handles all context menu interactions (canvas, node, edge)
 * and alignment/distribution operations
 */
export function useCanvasContextMenus(
  nodes: Ref<Node[]>,
  isConnecting: Ref<boolean>,
  syncNodes: () => void,
  syncEdges: () => void
) {
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()
  const { fitView: vueFlowFitView, viewport } = useVueFlow()

  // ============================================
  // CANVAS CONTEXT MENU STATE
  // ============================================

  const showCanvasContextMenu = ref(false)
  const canvasContextMenuX = ref(0)
  const canvasContextMenuY = ref(0)
  const canvasContextSection = ref<any>(null)

  // Quick task create state
  const isQuickTaskCreateOpen = ref(false)
  const quickTaskPosition = ref({ x: 0, y: 0 })

  // ============================================
  // NODE CONTEXT MENU STATE
  // ============================================

  const showNodeContextMenu = ref(false)
  const nodeContextMenuX = ref(0)
  const nodeContextMenuY = ref(0)
  const selectedNode = ref<any>(null)

  // ============================================
  // EDGE CONTEXT MENU STATE
  // ============================================

  const showEdgeContextMenu = ref(false)
  const edgeContextMenuX = ref(0)
  const edgeContextMenuY = ref(0)
  const selectedEdge = ref<any>(null)

  // ============================================
  // GROUP MODAL STATE
  // ============================================

  const isGroupModalOpen = ref(false)
  const selectedGroup = ref<any>(null)
  const groupModalPosition = ref({ x: 100, y: 100 })

  // ============================================
  // GROUP EDIT MODAL STATE
  // ============================================

  const isGroupEditModalOpen = ref(false)
  const selectedSectionForEdit = ref<any>(null)

  // ============================================
  // CANVAS CONTEXT MENU HANDLERS
  // ============================================

  const handlePaneContextMenu = (event: MouseEvent) => {
    if (isConnecting.value) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    console.log('🎯 Right-click detected!', event.clientX, event.clientY)
    event.preventDefault()
    canvasContextMenuX.value = event.clientX
    canvasContextMenuY.value = event.clientY
    showCanvasContextMenu.value = true
    console.log('📋 Context menu should be visible:', showCanvasContextMenu.value)
  }

  const handleCanvasRightClick = (event: MouseEvent) => {
    if (isConnecting.value) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const target = event.target as HTMLElement

    // Don't show menu if clicking on a task or section node
    if (target.closest('.task-node') || target.closest('[data-id^="section-"]')) {
      return
    }

    canvasContextMenuX.value = event.clientX
    canvasContextMenuY.value = event.clientY
    showCanvasContextMenu.value = true
    console.log('🎯 Canvas right-click at:', event.clientX, event.clientY)
  }

  const closeCanvasContextMenu = () => {
    console.log('🔧 CanvasView: Closing context menu, resetting canvasContextSection')
    showCanvasContextMenu.value = false
    canvasContextSection.value = null
  }

  const centerOnSelectedTasks = () => {
    const selectedNodes = nodes.value.filter(n => canvasStore.selectedNodeIds.includes(n.id))
    if (selectedNodes.length === 0) return

    vueFlowFitView({
      nodes: selectedNodes,
      padding: 0.3,
      duration: 300
    })

    closeCanvasContextMenu()
  }

  const fitAllTasks = () => {
    vueFlowFitView({ padding: 0.2, duration: 300 })
    closeCanvasContextMenu()
  }

  const selectAllTasks = () => {
    const taskNodeIds = nodes.value
      .filter(n => n.type === 'taskNode')
      .map(n => n.id)
    canvasStore.setSelectedNodes(taskNodeIds)
    closeCanvasContextMenu()
  }

  const clearSelection = () => {
    canvasStore.setSelectedNodes([])
    closeCanvasContextMenu()
  }

  const createTaskHere = () => {
    const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
    if (!vueFlowElement) return

    const rect = vueFlowElement.getBoundingClientRect()
    const canvasX = (canvasContextMenuX.value - rect.left - viewport.value.x) / viewport.value.zoom
    const canvasY = (canvasContextMenuY.value - rect.top - viewport.value.y) / viewport.value.zoom

    console.log('🎯 Opening task creation at:', {
      screenCoords: { x: canvasContextMenuX.value, y: canvasContextMenuY.value },
      viewport: { x: viewport.value.x, y: viewport.value.y, zoom: viewport.value.zoom },
      canvasCoords: { x: canvasX, y: canvasY }
    })

    quickTaskPosition.value = { x: canvasX, y: canvasY }
    closeCanvasContextMenu()
    isQuickTaskCreateOpen.value = true
  }

  const createGroup = () => {
    console.log('🔧 CanvasView: createGroup function called!')

    const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
    if (!vueFlowElement) {
      console.error('🔧 CanvasView: VueFlow element not found!')
      return
    }

    const rect = vueFlowElement.getBoundingClientRect()
    const canvasX = (canvasContextMenuX.value - rect.left - viewport.value.x) / viewport.value.zoom
    const canvasY = (canvasContextMenuY.value - rect.top - viewport.value.y) / viewport.value.zoom

    console.log('🎯 Creating group at:', {
      screenCoords: { x: canvasContextMenuX.value, y: canvasContextMenuY.value },
      viewport: { x: viewport.value.x, y: viewport.value.y, zoom: viewport.value.zoom },
      canvasCoords: { x: canvasX, y: canvasY }
    })

    groupModalPosition.value = { x: canvasX, y: canvasY }
    selectedGroup.value = null
    closeCanvasContextMenu()
    isGroupModalOpen.value = true
    console.log('🔧 CanvasView: isGroupModalOpen is now:', isGroupModalOpen.value)
  }

  // ============================================
  // ALIGNMENT HANDLERS
  // ============================================

  const alignLeft = () => {
    const selectedNodes = nodes.value.filter(n =>
      canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
    )
    if (selectedNodes.length < 2) return

    const minX = Math.min(...selectedNodes.map(n => n.position.x))

    selectedNodes.forEach(node => {
      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: minX, y: node.position.y }
      })
    })

    closeCanvasContextMenu()
  }

  const alignRight = () => {
    const selectedNodes = nodes.value.filter(n =>
      canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
    )
    if (selectedNodes.length < 2) return

    const maxX = Math.max(...selectedNodes.map(n => n.position.x))

    selectedNodes.forEach(node => {
      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: maxX, y: node.position.y }
      })
    })

    closeCanvasContextMenu()
  }

  const alignTop = () => {
    const selectedNodes = nodes.value.filter(n =>
      canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
    )
    if (selectedNodes.length < 2) return

    const minY = Math.min(...selectedNodes.map(n => n.position.y))

    selectedNodes.forEach(node => {
      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: node.position.x, y: minY }
      })
    })

    closeCanvasContextMenu()
  }

  const alignBottom = () => {
    const selectedNodes = nodes.value.filter(n =>
      canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
    )
    if (selectedNodes.length < 2) return

    const maxY = Math.max(...selectedNodes.map(n => n.position.y))

    selectedNodes.forEach(node => {
      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: node.position.x, y: maxY }
      })
    })

    closeCanvasContextMenu()
  }

  const alignCenterHorizontal = () => {
    const selectedNodes = nodes.value.filter(n =>
      canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
    )
    if (selectedNodes.length < 2) return

    const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length

    selectedNodes.forEach(node => {
      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: avgX, y: node.position.y }
      })
    })

    closeCanvasContextMenu()
  }

  const alignCenterVertical = () => {
    const selectedNodes = nodes.value.filter(n =>
      canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
    )
    if (selectedNodes.length < 2) return

    const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length

    selectedNodes.forEach(node => {
      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: node.position.x, y: avgY }
      })
    })

    closeCanvasContextMenu()
  }

  // ============================================
  // DISTRIBUTION HANDLERS
  // ============================================

  const distributeHorizontal = () => {
    const selectedNodes = nodes.value.filter(n =>
      canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
    )
    if (selectedNodes.length < 3) return

    const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x)
    const minX = sorted[0].position.x
    const maxX = sorted[sorted.length - 1].position.x
    const spacing = (maxX - minX) / (sorted.length - 1)

    sorted.forEach((node, index) => {
      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: minX + (spacing * index), y: node.position.y }
      })
    })

    closeCanvasContextMenu()
  }

  const distributeVertical = () => {
    const selectedNodes = nodes.value.filter(n =>
      canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
    )
    if (selectedNodes.length < 3) return

    const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y)
    const minY = sorted[0].position.y
    const maxY = sorted[sorted.length - 1].position.y
    const spacing = (maxY - minY) / (sorted.length - 1)

    sorted.forEach((node, index) => {
      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: node.position.x, y: minY + (spacing * index) }
      })
    })

    closeCanvasContextMenu()
  }

  // ============================================
  // GROUP MODAL HANDLERS
  // ============================================

  const closeGroupModal = () => {
    isGroupModalOpen.value = false
    selectedGroup.value = null
    groupModalPosition.value = { x: 100, y: 100 }
  }

  const handleGroupCreated = (group: any) => {
    console.log('Group created:', group)
    syncNodes()
  }

  const handleGroupUpdated = (group: any) => {
    console.log('Group updated:', group)
    syncNodes()
  }

  const editGroup = (section: any) => {
    console.log('Editing group:', section)
    selectedSectionForEdit.value = section
    isGroupEditModalOpen.value = true
    closeCanvasContextMenu()
  }

  const deleteGroup = (section: any) => {
    console.log('Deleting group:', section)
    if (!section) return

    const confirmMessage = `Delete "${section.name}" group? This will remove the group and all its settings.`
    if (confirm(confirmMessage)) {
      canvasStore.deleteSectionWithUndo(section.id)
      syncNodes()
    }
    closeCanvasContextMenu()
  }

  const closeGroupEditModal = () => {
    isGroupEditModalOpen.value = false
    selectedSectionForEdit.value = null
  }

  const handleGroupEditSave = (updatedSection: any) => {
    console.log('Saving group edit:', updatedSection)
    if (!updatedSection) return

    canvasStore.updateSectionWithUndo(updatedSection.id, updatedSection)
    syncNodes()
    closeGroupEditModal()
  }

  // ============================================
  // NODE CONTEXT MENU HANDLERS
  // ============================================

  const handleNodeContextMenu = (event: { event: MouseEvent; node: any }) => {
    console.log('Node context menu triggered for:', event.node.id, event.node)

    event.event.preventDefault()
    event.event.stopPropagation()

    // Only show context menu for section nodes
    if (!event.node.id.startsWith('section-')) {
      return
    }

    nodeContextMenuX.value = event.event.clientX
    nodeContextMenuY.value = event.event.clientY
    selectedNode.value = event.node
    showNodeContextMenu.value = true
    closeCanvasContextMenu()
    closeEdgeContextMenu()
  }

  const closeNodeContextMenu = () => {
    showNodeContextMenu.value = false
    selectedNode.value = null
  }

  const deleteNode = () => {
    if (!selectedNode.value) return

    if (selectedNode.value.id.startsWith('section-')) {
      const sectionId = selectedNode.value.id.replace('section-', '')
      console.log('Attempting to delete section:', sectionId)

      const section = canvasStore.sections.find(s => s.id === sectionId)
      if (!section) {
        closeNodeContextMenu()
        return
      }

      const tasksInSection = canvasStore.getTasksInSection(section, taskStore.filteredTasks)
      const confirmMessage = tasksInSection.length > 0
        ? `Delete "${section.name}" section? It contains ${tasksInSection.length} task(s) that will be moved to the canvas.`
        : `Delete "${section.name}" section?`

      if (confirm(confirmMessage)) {
        canvasStore.deleteSectionWithUndo(sectionId)
        syncNodes()
      }
    }

    closeNodeContextMenu()
  }

  // ============================================
  // EDGE CONTEXT MENU HANDLERS
  // ============================================

  const handleEdgeContextMenu = (event: { event: MouseEvent; edge: any }) => {
    event.event.preventDefault()
    edgeContextMenuX.value = event.event.clientX
    edgeContextMenuY.value = event.event.clientY
    selectedEdge.value = event.edge
    showEdgeContextMenu.value = true
    closeCanvasContextMenu()
    closeNodeContextMenu()
  }

  const closeEdgeContextMenu = () => {
    showEdgeContextMenu.value = false
    selectedEdge.value = null
  }

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
    // Canvas context menu
    showCanvasContextMenu,
    canvasContextMenuX,
    canvasContextMenuY,
    canvasContextSection,
    handlePaneContextMenu,
    handleCanvasRightClick,
    closeCanvasContextMenu,
    centerOnSelectedTasks,
    fitAllTasks,
    selectAllTasks,
    clearSelection,
    createTaskHere,
    createGroup,

    // Quick task create
    isQuickTaskCreateOpen,
    quickTaskPosition,

    // Alignment
    alignLeft,
    alignRight,
    alignTop,
    alignBottom,
    alignCenterHorizontal,
    alignCenterVertical,

    // Distribution
    distributeHorizontal,
    distributeVertical,

    // Group modal
    isGroupModalOpen,
    selectedGroup,
    groupModalPosition,
    closeGroupModal,
    handleGroupCreated,
    handleGroupUpdated,
    editGroup,
    deleteGroup,

    // Group edit modal
    isGroupEditModalOpen,
    selectedSectionForEdit,
    closeGroupEditModal,
    handleGroupEditSave,

    // Node context menu
    showNodeContextMenu,
    nodeContextMenuX,
    nodeContextMenuY,
    selectedNode,
    handleNodeContextMenu,
    closeNodeContextMenu,
    deleteNode,

    // Edge context menu
    showEdgeContextMenu,
    edgeContextMenuX,
    edgeContextMenuY,
    selectedEdge,
    handleEdgeContextMenu,
    closeEdgeContextMenu,
    disconnectEdge
  }
}
