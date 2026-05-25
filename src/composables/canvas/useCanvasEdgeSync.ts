/**
 * useCanvasEdgeSync
 *
 * Builds Vue Flow edges from task.parentTaskId (subtask relationships).
 * This is the READ PATH for edges: DB/Store → Vue Flow
 *
 * When a task has parentTaskId: 'task-a', we create an edge:
 *   - task-a → this-task (parent to child)
 *
 * Edges represent subtask relationships: the source is the parent task.
 */

import { type Ref, ref } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useVueFlow, type Edge } from '@vue-flow/core'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { getGroupAbsolutePosition } from '@/utils/canvas/coordinates'
import { getAllDescendantGroupIds } from '@/utils/canvas/storeHelpers'
import { isNodeCompletelyInside } from '@/utils/canvas/spatialContainment'

interface EdgeSyncDeps {
    recentlyRemovedEdges: Ref<Set<string>>
}

export function useCanvasEdgeSync(deps: EdgeSyncDeps) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const { setEdges, edges: currentEdges } = useVueFlow()

    const isSyncing = ref(false)

    const getLinkedParentForGroup = (groupId: string | undefined | null): string | null => {
        let currentId = groupId || null
        const visited = new Set<string>()

        while (currentId && !visited.has(currentId)) {
            visited.add(currentId)
            const group = canvasStore.groups.find(g => g.id === currentId)
            if (!group) return null
            if (group.linkedParentTaskId) return group.linkedParentTaskId
            currentId = group.parentGroupId || null
        }

        return null
    }

    const getClosestGroupTargetHandle = (sourceTask: Task, groupId: string): string => {
        const group = canvasStore.groups.find(g => g.id === groupId)
        if (!group?.position || !sourceTask.canvasPosition) return 'group-target-left'

        const groupPos = getGroupAbsolutePosition(groupId, canvasStore.groups)
        const sourceCenter = {
            x: sourceTask.canvasPosition.x + 140,
            y: sourceTask.canvasPosition.y + 40
        }

        if (sourceCenter.x < groupPos.x) return 'group-target-left'
        if (sourceCenter.x > groupPos.x + group.position.width) return 'group-target-right'
        if (sourceCenter.y < groupPos.y) return 'group-target-top'
        return 'group-target-bottom'
    }

    const taskIsVisuallyInsideGroupTree = (task: Task, groupId: string): boolean => {
        if (!task.canvasPosition) return false

        const linkedGroupIds = getAllDescendantGroupIds(groupId, canvasStore.groups)
        if (task.parentId && linkedGroupIds.includes(task.parentId)) return true

        return linkedGroupIds.some(id => {
            const group = canvasStore.groups.find(g => g.id === id)
            if (!group?.position) return false

            return isNodeCompletelyInside(
                { position: task.canvasPosition },
                {
                    position: getGroupAbsolutePosition(id, canvasStore.groups),
                    width: group.position.width,
                    height: group.position.height
                },
                0
            )
        })
    }

    const isImpliedByLinkedGroup = (task: Task): boolean => {
        if (!task.parentTaskId) return false

        return canvasStore.groups.some(group =>
            group.linkedParentTaskId === task.parentTaskId &&
            taskIsVisuallyInsideGroupTree(task, group.id)
        )
    }

    const edgeSignature = (edge: Edge): string => {
        return JSON.stringify({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle || null,
            targetHandle: edge.targetHandle || null,
            type: edge.type || null,
            animated: edge.animated || false,
            markerEnd: edge.markerEnd || null,
            style: edge.style || null
        })
    }

    /**
     * Build edges from task.parentTaskId and sync to Vue Flow.
     *
     * For each task with parentTaskId, creates an edge from the parent
     * to the task. Only creates edges for tasks that are on the canvas
     * (have canvasPosition).
     */
    const syncEdges = (tasksToSync?: Task[]) => {
        if (isSyncing.value) return
        isSyncing.value = true

        try {
            const newEdges: Edge[] = []
            const tasks = tasksToSync || taskStore.tasks

            // Build a map of task IDs to tasks for fast lookup
            // CRITICAL: Only include tasks that are actually being synced/displayed
            // This prevents creating edges to nodes that are filtered out (e.g. done/overdue)
            const taskMap = new Map(tasks.map((t: Task) => [t.id, t]))
            for (const group of canvasStore.groups) {
                if (!group.linkedParentTaskId) continue

                const parentTask = taskMap.get(group.linkedParentTaskId)
                if (!parentTask?.canvasPosition) continue

                const groupNodeId = CanvasIds.groupNodeId(group.id)
                const edgeId = CanvasIds.edgeId(group.linkedParentTaskId, groupNodeId)
                if (deps.recentlyRemovedEdges.value.has(edgeId)) continue

                newEdges.push({
                    id: edgeId,
                    source: group.linkedParentTaskId,
                    target: groupNodeId,
                    sourceHandle: 'source',
                    targetHandle: getClosestGroupTargetHandle(parentTask, group.id),
                    type: 'default',
                    animated: false,
                    style: {
                        stroke: 'var(--accent-primary)',
                        strokeWidth: 2.5,
                        strokeDasharray: '8 5'
                    },
                    markerEnd: 'arrowhead'
                })
            }

            for (const task of tasks) {
                // Skip tasks without canvas position (not on canvas)
                if (!task.canvasPosition) continue

                // Skip tasks without a parent (not a subtask)
                if (!task.parentTaskId) continue

                // Check if parent task exists and is on canvas
                const parentTask = taskMap.get(task.parentTaskId)
                if (!parentTask?.canvasPosition) continue

                // A linked group edge already represents these child relationships visually.
                if (getLinkedParentForGroup(task.parentId) === task.parentTaskId) continue
                if (isImpliedByLinkedGroup(task)) continue

                // Skip group nodes - edges are only between tasks
                if (CanvasIds.isGroupNode(task.parentTaskId) || CanvasIds.isGroupNode(task.id)) continue

                // Generate edge ID (parent → child)
                const edgeId = CanvasIds.edgeId(task.parentTaskId, task.id)

                // Skip if this edge was recently removed by user
                // This prevents "zombie edges" from reappearing immediately
                if (deps.recentlyRemovedEdges.value.has(edgeId)) continue

                newEdges.push({
                    id: edgeId,
                    source: task.parentTaskId,
                    target: task.id,
                    type: 'default',
                    animated: false,
                    style: {
                        stroke: 'var(--border-secondary)',
                        strokeWidth: 2
                    },
                    markerEnd: 'arrowhead'
                })
            }

            // Idempotence check: only update if edges changed
            const currentEdgeIds = new Set(currentEdges.value.map(e => e.id))
            const newEdgeIds = new Set(newEdges.map(e => e.id))
            const currentSignatures = new Map(currentEdges.value.map(e => [e.id, edgeSignature(e)]))

            const hasChanges =
                currentEdges.value.length !== newEdges.length ||
                [...currentEdgeIds].some(id => !newEdgeIds.has(id)) ||
                newEdges.some(edge => currentSignatures.get(edge.id) !== edgeSignature(edge))

            if (hasChanges) {
                console.debug('[EdgeSync] Syncing edges', {
                    previous: currentEdges.value.length,
                    new: newEdges.length
                })
                setEdges(newEdges)
            }
        } finally {
            isSyncing.value = false
        }
    }

    return {
        syncEdges,
        isSyncing
    }
}
