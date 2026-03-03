/**
 * Move Task to Canvas Group
 *
 * Composable for moving tasks into canvas groups from any view (Board, Calendar, Inbox).
 * Handles positioning, metadata inheritance, and undo support.
 *
 * GEOMETRY WRITER SAFETY (TASK-1429):
 * - Explicit user action (context menu click)
 * - One-time placement via calculatePositionInGroup
 * - Atomic write via updateTaskWithUndo
 *
 * @see docs/sop/canvas/CANVAS-POSITION-SYSTEM.md
 */

import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useToast } from '@/composables/useToast'
import { calculatePositionInGroup } from '@/composables/canvas/useSmartGroupMatcher'
import { useCanvasSectionProperties } from '@/composables/canvas/useCanvasSectionProperties'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'

export function useMoveToCanvasGroup() {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const { showToast } = useToast()

    // Initialize section properties with a no-op spatial query
    // We don't need spatial containment — we have the explicit target group
    const { getSectionProperties } = useCanvasSectionProperties({
        taskStore,
        getAllContainingSections: () => []
    })

    /**
     * Move a single task into a canvas group
     */
    async function moveTaskToGroup(taskId: string, groupId: string): Promise<boolean> {
        console.log('[MOVE-GROUP] moveTaskToGroup', { taskId, groupId, rawGroupsCount: canvasStore._rawGroups.length })
        const group = canvasStore._rawGroups.find((g: CanvasGroup) => g.id === groupId)
        if (!group) {
            console.warn('[MOVE-GROUP] Group not found!', { groupId, availableIds: canvasStore._rawGroups.map((g: CanvasGroup) => g.id) })
            showToast('Group not found', 'error')
            return false
        }

        const tasksInGroup = taskStore.tasks.filter(t => t.parentId === groupId)
        const position = calculatePositionInGroup(group, tasksInGroup)

        // Get inherited metadata from group (dueDate from "Today", priority from "High Priority", etc.)
        const allGroups = canvasStore._rawGroups as CanvasGroup[]
        const inheritedProps = getSectionProperties(group, allGroups)

        const updates: Partial<Task> = {
            parentId: groupId,
            canvasPosition: position,
            isInInbox: false,
            ...inheritedProps
        }

        console.log('[MOVE-GROUP] Applying updates', { taskId, updates, groupName: group.name })

        try {
            await taskStore.updateTaskWithUndo(taskId, updates)
            canvasStore.requestSync('user:context-menu')
            console.log('[MOVE-GROUP] Task moved successfully')
            return true
        } catch (error) {
            console.error('[TASK-1429] Failed to move task to group:', error)
            showToast('Failed to move task', 'error')
            return false
        }
    }

    /**
     * Move multiple tasks into a canvas group
     */
    async function moveTasksToGroup(taskIds: string[], groupId: string): Promise<boolean> {
        let success = true
        for (const taskId of taskIds) {
            const ok = await moveTaskToGroup(taskId, groupId)
            if (!ok) success = false
        }
        return success
    }

    /**
     * Remove a task from its current group (free-floating on canvas)
     */
    async function removeFromGroup(taskId: string): Promise<boolean> {
        try {
            await taskStore.updateTaskWithUndo(taskId, {
                parentId: undefined
            })
            canvasStore.requestSync('user:context-menu')
            return true
        } catch (error) {
            console.error('[TASK-1429] Failed to remove task from group:', error)
            showToast('Failed to remove from group', 'error')
            return false
        }
    }

    /**
     * Move task(s) with toast notification
     */
    async function moveToGroupWithToast(taskIds: string | string[], groupId: string | null) {
        const ids = Array.isArray(taskIds) ? taskIds : [taskIds]

        if (!groupId) {
            // Remove from group
            let success = true
            for (const id of ids) {
                const ok = await removeFromGroup(id)
                if (!ok) success = false
            }
            if (success) {
                showToast('Removed from group', 'success', { duration: 2000 })
            }
            return
        }

        const group = canvasStore._rawGroups.find((g: CanvasGroup) => g.id === groupId)
        const groupName = group?.name || 'group'

        const success = ids.length === 1
            ? await moveTaskToGroup(ids[0], groupId)
            : await moveTasksToGroup(ids, groupId)

        if (success) {
            const label = ids.length === 1
                ? `Moved to ${groupName}`
                : `Moved ${ids.length} tasks to ${groupName}`
            showToast(label, 'success', { duration: 2000 })
        }
    }

    return {
        moveTaskToGroup,
        moveTasksToGroup,
        removeFromGroup,
        moveToGroupWithToast
    }
}
