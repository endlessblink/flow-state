/**
 * useTaskAssignment
 *
 * TASK-1552: Composable for assigning tasks to workspace members.
 *
 * Responsibilities:
 * - assignTask: update a task's assigned_to field via the normal task store
 * - getAssignableMembers: return members who can be assigned in the current workspace
 * - useAssignmentFilter: composable returning a computed filter fn for 'mine'/'unassigned'/'all'
 *
 * NOTE: The sync-queue payload builder in taskOperations.ts does not yet have a
 * `changedKeys.has('assignedTo')` branch (BUG-1516 field coverage gap). Assignment changes
 * will be persisted via the direct `saveSpecificTasks` / `toSupabaseTask` path immediately
 * and via the sync queue only when that branch is added. The local store update is
 * always applied optimistically.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import type { WorkspaceMember } from '@/types/workspace'

// ============================================================================
// assignTask
// ============================================================================

/**
 * Assign a task to a user, or unassign by passing null.
 *
 * Routes through the standard task update infrastructure so it:
 * - Updates the in-memory Pinia store optimistically
 * - Triggers pending-write echo protection (addPendingWrite)
 * - Queues for offline-first sync (useSyncOrchestrator)
 * - Falls back to direct Supabase save via saveSpecificTasks / toSupabaseTask
 *
 * @param taskId - UUID of the task to update
 * @param userId - UUID of the assignee, or null to unassign
 */
export async function assignTask(
  taskId: string,
  userId: string | null
): Promise<void> {
  const taskStore = useTaskStore()
  await taskStore.updateTask(taskId, { assignedTo: userId ?? null })
}

// ============================================================================
// getAssignableMembers
// ============================================================================

/**
 * Return the list of workspace members who can be assigned tasks.
 *
 * - Personal workspace (workspaceId === null): returns a single synthetic
 *   entry representing the current user (so UIs can show "Assign to me").
 * - Shared workspace: returns all members loaded in workspaceStore.members.
 *   If the workspace has not been loaded yet, an empty array is returned.
 *
 * @param workspaceId - active workspace ID, or null for personal workspace
 */
export function getAssignableMembers(
  workspaceId: string | null
): WorkspaceMember[] {
  const authStore = useAuthStore()
  const workspaceStore = useWorkspaceStore()

  if (!workspaceId) {
    // Personal workspace: only the current user can be assigned
    const userId = authStore.user?.id
    if (!userId) return []

    const selfMember: WorkspaceMember = {
      id: `personal-${userId}`,
      workspaceId: '',
      userId,
      role: 'owner',
      joinedAt: new Date().toISOString(),
      displayName: authStore.user?.email?.split('@')[0] || userId.substring(0, 8),
      avatarUrl: undefined,
      email: authStore.user?.email,
    }
    return [selfMember]
  }

  return workspaceStore.members.get(workspaceId) ?? []
}

// ============================================================================
// useAssignmentFilter
// ============================================================================

export type AssignmentFilterMode = 'mine' | 'unassigned' | 'all'

/**
 * Returns a computed filter function for filtering tasks by assignment.
 *
 * Integrate with existing filter pipelines by calling the returned filterFn
 * on a Task object — it returns true if the task passes the current filter.
 *
 * Usage:
 * ```ts
 * const { filterMode, filterFn } = useAssignmentFilter()
 * const filtered = computed(() => tasks.value.filter(filterFn.value))
 * ```
 */
export function useAssignmentFilter(): {
  filterMode: Ref<AssignmentFilterMode>
  filterFn: ComputedRef<(task: { assignedTo?: string | null }) => boolean>
  setFilterMode: (mode: AssignmentFilterMode) => void
} {
  const authStore = useAuthStore()

  // Reactive ref — filterFn computed re-evaluates when this changes
  const filterMode = ref<AssignmentFilterMode>('all')

  const filterFn = computed<(task: { assignedTo?: string | null }) => boolean>(() => {
    const mode = filterMode.value
    const currentUserId = authStore.user?.id ?? null

    if (mode === 'all') {
      return () => true
    }

    if (mode === 'mine') {
      return (task) => !!currentUserId && task.assignedTo === currentUserId
    }

    // 'unassigned'
    return (task) => task.assignedTo == null
  })

  function setFilterMode(mode: AssignmentFilterMode): void {
    filterMode.value = mode
  }

  return {
    filterMode,
    filterFn,
    setFilterMode,
  }
}
