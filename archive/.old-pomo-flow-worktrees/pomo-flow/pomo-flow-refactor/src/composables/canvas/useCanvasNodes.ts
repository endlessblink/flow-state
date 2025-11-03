import { ref, watch, markRaw, type Ref } from 'vue'
import type { Node } from '@vue-flow/core'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import SectionNodeSimple from '@/components/canvas/SectionNodeSimple.vue'
import TaskNode from '@/components/canvas/TaskNode.vue'

/**
 * Canvas Nodes Composable
 * Handles node management, syncing, and parent-child relationships for Vue Flow
 */
export function useCanvasNodes(syncEdges: () => void) {
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()

  // ============================================
  // NODE STATE
  // ============================================

  const nodes = ref<Node[]>([])

  // Node types for Vue Flow
  const nodeTypes = {
    taskNode: markRaw(TaskNode),
    sectionNode: markRaw(SectionNodeSimple)
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Get tasks for a section
   * Returns empty array if section is collapsed to hide tasks
   */
  const getTasksForSection = (section: any) => {
    const tasks = canvasStore.getTasksInSection(section, taskStore.filteredTasks)
    return section.isCollapsed ? [] : tasks
  }

  /**
   * Get task count for a section
   */
  const getTaskCountForSection = (sectionId: string) => {
    const section = canvasStore.sections.find(s => s.id === sectionId)
    if (!section) return 0
    return canvasStore.getTaskCountInSection(section, taskStore.filteredTasks)
  }

  // ============================================
  // NODE SYNC
  // ============================================

  /**
   * Sync nodes from store with parent-child relationships and collapsible sections
   * Creates Vue Flow nodes for both sections and tasks
   */
  const syncNodes = () => {
    const allNodes: Node[] = []

    // Add section nodes FIRST (so they render in background)
    canvasStore.sections.forEach(section => {
      allNodes.push({
        id: `section-${section.id}`,
        type: 'sectionNode',
        position: { x: section.position.x, y: section.position.y },
        data: {
          id: section.id,
          name: section.name,
          type: section.type,
          layout: section.layout,
          propertyValue: section.propertyValue,
          backgroundColor: section.backgroundColor,
          isCollapsed: section.isCollapsed,
          taskCount: getTaskCountForSection(section.id)
        },
        style: {
          width: `${section.position.width}px`,
          height: section.isCollapsed
            ? '80px'
            : `${section.position.height}px`
        },
        draggable: true,
        selectable: true
      })
    })

    // Add task nodes (with parent-child relationships for sections)
    taskStore.filteredTasks
      .filter(task => task.canvasPosition)
      .forEach(task => {
        // Check if task is inside any section for parent-child relationship
        const containingSection = canvasStore.sections.find(section => {
          const { x, y, width, height } = section.position
          const taskCenterX = task.canvasPosition!.x + 110 // half of task width (220/2)
          const taskCenterY = task.canvasPosition!.y + 50 // half of task height (100/2)

          return (
            taskCenterX >= x &&
            taskCenterX <= x + width &&
            taskCenterY >= y &&
            taskCenterY <= y + height
          )
        })

        // If task is in a collapsed section, skip rendering it
        if (containingSection && containingSection.isCollapsed) {
          return
        }

        allNodes.push({
          id: task.id,
          type: 'taskNode',
          position: containingSection
            ? {
                x: task.canvasPosition!.x - containingSection.position.x,
                y: task.canvasPosition!.y - containingSection.position.y
              }
            : { x: task.canvasPosition!.x, y: task.canvasPosition!.y },
          data: task,
          parentNode: containingSection ? `section-${containingSection.id}` : undefined,
          extent: undefined, // Allow tasks to be dragged outside sections
          draggable: true,
          selectable: true
        })
      })

    nodes.value = allNodes
  }

  // ============================================
  // WATCHERS
  // ============================================

  // Watch for task and section changes
  watch(() => taskStore.filteredTasks, () => {
    syncNodes()
    syncEdges()
  }, { deep: true, immediate: true })

  // Watch sections array length and IDs only (not deep) to prevent recursion
  watch(() => canvasStore.sections.map(s => s.id).join(','), () => {
    syncNodes()
  })

  // Watch for section collapse state changes - CRITICAL for Vue Flow parent-child
  watch(() => canvasStore.sections.map(s => ({ id: s.id, isCollapsed: s.isCollapsed })), () => {
    syncNodes()
  }, { deep: true })

  // Watch for task position changes to update section counts
  watch(() => taskStore.filteredTasks.map(t => ({ id: t.id, canvasPosition: t.canvasPosition })), () => {
    syncNodes()
  }, { deep: true })

  // Watch for canvas store selection changes and sync with Vue Flow nodes
  watch(() => canvasStore.selectedNodeIds, (newSelectedIds) => {
    // Update Vue Flow nodes to match canvas store selection
    nodes.value.forEach(node => {
      const shouldBeSelected = newSelectedIds.includes(node.id)
      if (node.selected !== shouldBeSelected) {
        node.selected = shouldBeSelected
      }
    })
  }, { deep: true })

  // ============================================
  // SELECTION HELPERS
  // ============================================

  /**
   * Restore selection state to Vue Flow nodes
   */
  const restoreSelection = (selectedIds: string[]) => {
    nodes.value.forEach(node => {
      node.selected = selectedIds.includes(node.id)
    })
  }

  /**
   * Get currently selected nodes from Vue Flow
   */
  const getSelectedNodes = () => {
    return nodes.value.filter(n => n.selected).map(n => n.id)
  }

  /**
   * Update a single node's selection state
   */
  const updateNodeSelection = (nodeId: string, selected: boolean) => {
    const nodeIndex = nodes.value.findIndex(n => n.id === nodeId)
    if (nodeIndex > -1) {
      if (nodes.value[nodeIndex].selected !== selected) {
        nodes.value[nodeIndex].selected = selected
      }
    }
  }

  // ============================================
  // RETURN PUBLIC API
  // ============================================

  return {
    // State
    nodes,
    nodeTypes,

    // Helpers
    getTasksForSection,
    getTaskCountForSection,

    // Sync
    syncNodes,

    // Selection helpers
    restoreSelection,
    getSelectedNodes,
    updateNodeSelection
  }
}
