import { computed, ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useMiniCanvasActions } from './useMiniCanvasActions'
import type { Node, Edge } from '@vue-flow/core'

const CHILD_RADIUS = 300

/**
 * Core composable: maps parent task + subtasks + planningNotes → VueFlow nodes.
 * Parent task sits at center (0,0). Children radiate outward in a circle.
 */
export function useMiniCanvas(taskId: () => string | null) {
  const taskStore = useTaskStore()
  const actions = useMiniCanvasActions(taskId)

  const editingNodeId = ref<string | null>(null)

  // Store user-created edges (connections between nodes)
  const userEdges = ref<Edge[]>([])

  const task = computed(() => {
    const id = taskId()
    if (!id) return undefined
    return taskStore._rawTasks.find(t => t.id === id)
  })

  /** Auto-layout: place children in a circle around parent */
  const radialPosition = (index: number, total: number) => {
    const angle = (2 * Math.PI * index) / Math.max(total, 1) - Math.PI / 2
    return {
      x: Math.round(Math.cos(angle) * CHILD_RADIUS),
      y: Math.round(Math.sin(angle) * CHILD_RADIUS),
    }
  }

  /** Convert parent task + subtasks + notes to VueFlow nodes */
  const nodes = computed<Node[]>(() => {
    const t = task.value
    if (!t) return []

    const result: Node[] = []

    // Parent task at center — not draggable
    result.push({
      id: `parent-${t.id}`,
      type: 'parentTaskNode',
      position: { x: 0, y: 0 },
      draggable: false,
      data: {
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        taskId: t.id,
      },
    })

    const totalChildren = (t.subtasks || []).length + (t.planningNotes || []).length
    let childIndex = 0

    // Subtask nodes
    for (const subtask of (t.subtasks || [])) {
      const pos = subtask.canvasPosition || radialPosition(childIndex, totalChildren)

      result.push({
        id: subtask.id,
        type: 'subtaskNode',
        position: pos,
        data: {
          title: subtask.title,
          description: subtask.description,
          isCompleted: subtask.isCompleted,
          subtaskId: subtask.id,
        },
      })
      childIndex++
    }

    // Planning note nodes
    for (const note of (t.planningNotes || [])) {
      const pos = note.canvasPosition || radialPosition(childIndex, totalChildren)

      result.push({
        id: note.id,
        type: 'noteNode',
        position: pos,
        data: {
          title: note.title,
          description: note.description,
          color: note.color,
          noteId: note.id,
          imageUrl: note.imageUrl,
        },
      })
      childIndex++
    }

    return result
  })

  /**
   * Pick the best handle pair based on child position relative to parent (0,0).
   * Returns sourceHandle (on parent) and targetHandle (on child).
   */
  const getHandles = (childPos: { x: number; y: number }) => {
    if (Math.abs(childPos.y) >= Math.abs(childPos.x)) {
      // Primarily vertical
      if (childPos.y >= 0) {
        return { sourceHandle: 'bottom', targetHandle: 'top' }   // child is below
      } else {
        return { sourceHandle: 'top', targetHandle: 'bottom' }   // child is above
      }
    } else {
      // Primarily horizontal
      if (childPos.x > 0) {
        return { sourceHandle: 'right', targetHandle: 'left' }   // child is to the right
      } else {
        return { sourceHandle: 'left', targetHandle: 'right' }   // child is to the left
      }
    }
  }

  /** Edges: auto-connect all children to parent */
  const edges = computed<Edge[]>(() => {
    const t = task.value
    if (!t) return []

    const parentId = `parent-${t.id}`
    const autoEdges: Edge[] = []

    // Build a position lookup from current node positions (reflects post-drag state)
    const nodePositions = new Map(nodes.value.map(n => [n.id, n.position]))

    for (const subtask of (t.subtasks || [])) {
      const childPos = nodePositions.get(subtask.id) || { x: 0, y: 100 }
      const handles = getHandles(childPos)
      autoEdges.push({
        id: `e-${parentId}-${subtask.id}`,
        source: parentId,
        target: subtask.id,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        animated: true,
        style: { stroke: '#4ECDC4', strokeWidth: 1.5, opacity: 0.4 },
      })
    }

    for (const note of (t.planningNotes || [])) {
      const childPos = nodePositions.get(note.id) || { x: 0, y: 100 }
      const handles = getHandles(childPos)
      autoEdges.push({
        id: `e-${parentId}-${note.id}`,
        source: parentId,
        target: note.id,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        animated: true,
        style: { stroke: '#8b5cf6', strokeWidth: 1.5, opacity: 0.3 },
      })
    }

    return [...autoEdges, ...userEdges.value]
  })

  /** Handle node drag stop — persist position (skip parent) */
  const onNodeDragStop = (event: { node: Node }) => {
    const { node } = event
    if (node.type === 'parentTaskNode') return

    const pos = { x: Math.round(node.position.x), y: Math.round(node.position.y) }

    if (node.type === 'subtaskNode') {
      actions.updateSubtaskPosition(node.id, pos)
    } else if (node.type === 'noteNode') {
      actions.updateNotePosition(node.id, pos)
    }
  }

  /** Add a temporary user edge between non-parent nodes. */
  const addUserEdge = (source: string, target: string) => {
    const t = task.value
    const parentId = t ? `parent-${t.id}` : null
    if (source === parentId) return

    const edgeId = `user-${source}-${target}`
    if (userEdges.value.some(e => e.id === edgeId)) return

    userEdges.value.push({
      id: edgeId,
      source,
      target,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
    })
  }

  /** Handle new connection between nodes */
  const onConnect = (params: { source: string; target: string }) => {
    addUserEdge(params.source, params.target)
  }

  /** Create a subtask when a connection is dropped on empty space. */
  const createConnectedSubtask = (sourceId: string, position: { x: number; y: number }) => {
    const newSubtaskId = actions.addSubtask(position)
    if (newSubtaskId) {
      addUserEdge(sourceId, newSubtaskId)
    }
  }

  /** Reset edges when mini-canvas closes */
  const resetEdges = () => {
    userEdges.value = []
  }

  return {
    task,
    nodes,
    edges,
    editingNodeId,
    onNodeDragStop,
    onConnect,
    createConnectedSubtask,
    resetEdges,
    ...actions,
  }
}
