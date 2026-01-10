/**
 * Canvas Core Composable - Vue Flow setup and coordination
 * 
 * TASK-184: Canvas Rebuild Layer 1
 * 
 * DESIGN:
 * - Direct use of useVueFlow
 * - Sorting nodes (parents before children)
 * - Helper functions for coordinate conversion
 */
import { ref, markRaw, computed } from 'vue'
import { useVueFlow, type Node, type Edge } from '@vue-flow/core'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/stores/canvas/types'

export type CanvasNode = Node
export type CanvasEdge = Edge

export function useCanvasCore() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodeDragStart,
    onNodeDragStop,
    fitView,
    project,
    viewport
  } = useVueFlow({ id: 'canvas-rebuild' })

  const isDragging = ref(false)
  const draggedNodeId = ref<string | null>(null)

  // ============================================
  // CONVERSION HELPERS
  // ============================================

  /**
   * Convert CanvasGroup to Vue Flow Node
   */
  function groupToNode(group: CanvasGroup, taskCount: number = 0): CanvasNode {
    return {
      id: `section-${group.id}`,
      type: 'sectionNode',
      position: {
        x: group.position?.x ?? 0,
        y: group.position?.y ?? 0
      },
      data: {
        ...group,
        taskCount
      }
    }
  }

  /**
   * Convert Task to Vue Flow Node
   * parentGroupId is COMPUTED and passed in
   */
  function taskToNode(task: Task, parentGroupId?: string): CanvasNode {
    return {
      id: `task-${task.id}`,
      type: 'taskNode',
      position: {
        x: task.canvasPosition?.x ?? 0,
        y: task.canvasPosition?.y ?? 0
      },
      parentNode: parentGroupId ? `section-${parentGroupId}` : undefined,
      data: {
        task
      },
      // Tasks should be on top
      zIndex: 1000
    }
  }

  // ============================================
  // NODE MANAGEMENT
  // ============================================

  /**
   * Sort nodes: Parents must come before children in the array
   */
  function sortNodesParentsFirst(nodes: CanvasNode[]): CanvasNode[] {
    return [...nodes].sort((a, b) => {
      // If a is parent of b, a comes first
      if (b.parentNode === a.id) return -1
      if (a.parentNode === b.id) return 1

      // Groups come before tasks if independent
      const aIsGroup = a.id.startsWith('section-')
      const bIsGroup = b.id.startsWith('section-')
      if (aIsGroup && !bIsGroup) return -1
      if (!aIsGroup && bIsGroup) return 1

      return 0
    })
  }

  function setAllNodes(newNodes: CanvasNode[]) {
    const sorted = sortNodesParentsFirst(newNodes)
    setNodes(sorted)
  }

  // ============================================
  // COORDINATES
  // ============================================

  /**
   * Calculate absolute position of a node
   * (Handles relative positions of nested nodes)
   */
  function getAbsolutePosition(node: CanvasNode, allNodes: CanvasNode[]): { x: number; y: number } {
    let x = node.position.x
    let y = node.position.y

    let currentParentNode = node.parentNode ? allNodes.find(n => n.id === node.parentNode) : null

    while (currentParentNode) {
      x += currentParentNode.position.x
      y += currentParentNode.position.y
      currentParentNode = currentParentNode.parentNode ? allNodes.find(n => n.id === currentParentNode!.parentNode) : null
    }

    return { x, y }
  }

  return {
    // Vue Flow
    nodes,
    edges,
    fitView,
    project,
    viewport,
    setAllNodes,

    // Conversion
    groupToNode,
    taskToNode,

    // State
    isDragging,
    draggedNodeId,

    // Utils
    getAbsolutePosition
  }
}
