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
        },
      })
      childIndex++
    }

    return result
  })

  /** Edges: auto-connect all children to parent */
  const edges = computed<Edge[]>(() => {
    const t = task.value
    if (!t) return []

    const parentId = `parent-${t.id}`
    const autoEdges: Edge[] = []

    for (const subtask of (t.subtasks || [])) {
      autoEdges.push({
        id: `e-${parentId}-${subtask.id}`,
        source: parentId,
        target: subtask.id,
        animated: true,
        style: { stroke: '#4ECDC4', strokeWidth: 1.5, opacity: 0.4 },
      })
    }

    for (const note of (t.planningNotes || [])) {
      autoEdges.push({
        id: `e-${parentId}-${note.id}`,
        source: parentId,
        target: note.id,
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

  /** Handle new connection between nodes */
  const onConnect = (params: { source: string; target: string }) => {
    const edgeId = `user-${params.source}-${params.target}`
    // Don't add duplicate
    if (userEdges.value.some(e => e.id === edgeId)) return

    userEdges.value.push({
      id: edgeId,
      source: params.source,
      target: params.target,
      style: { stroke: '#6b7280', strokeWidth: 1.5 },
    })
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
    resetEdges,
    ...actions,
  }
}
