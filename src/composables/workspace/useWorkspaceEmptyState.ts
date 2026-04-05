import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTaskStore } from '@/stores/tasks'

export type WorkspaceEmptyVariant = 'welcome' | 'noTasks' | 'noMembers' | null

export function useWorkspaceEmptyState() {
  const workspaceStore = useWorkspaceStore()
  const taskStore = useTaskStore()

  const variant = computed((): WorkspaceEmptyVariant => {
    // Personal workspace never shows empty states
    if (workspaceStore.isPersonalWorkspace) return null
    if (!workspaceStore.activeWorkspace) return null

    const memberCount = workspaceStore.activeMembers.length
    const taskCount = taskStore.tasks.length

    // Check if workspace was created less than 24h ago
    const createdAt = new Date(workspaceStore.activeWorkspace.createdAt)
    const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)
    const isNew = hoursOld < 24

    // Priority cascade
    if (taskCount === 0 && memberCount <= 1 && isNew) return 'welcome'
    if (taskCount > 0 && memberCount <= 1) return 'noMembers'
    if (taskCount === 0) return 'noTasks'

    return null
  })

  const hasPendingInvites = computed(() => workspaceStore.hasPendingInvites)

  return { variant, hasPendingInvites }
}
