import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
    type DatabaseContext, type DatabaseDependencies,
    createDatabaseHelpers,
} from './_infrastructure'
import { useTombstoneDatabase } from './_tombstone'
import { useTasksDatabase } from './useTasksDatabase'
import { useProjectsDatabase } from './useProjectsDatabase'
import { useGroupsDatabase } from './useGroupsDatabase'
import { useNotificationsDatabase } from './useNotificationsDatabase'
import { useTimerDatabase } from './useTimerDatabase'
import { useSettingsDatabase } from './useSettingsDatabase'
import { useQuickSortDatabase } from './useQuickSortDatabase'
import { usePinnedTasksDatabase } from './usePinnedTasksDatabase'
import { useWorkProfileDatabase } from './useWorkProfileDatabase'
import { useRealtimeSubscription } from './useRealtimeSubscription'

// Re-export types and singletons used by consumers
export { invalidateCache } from './_infrastructure'
export type { SafeCreateTaskResult, TaskIdAvailability, TimerSettings } from './_infrastructure'

export function useSupabaseDatabase(_deps: DatabaseDependencies = {}) {
    const authStore = useAuthStore()
    const isSyncing = ref(false)
    const lastSyncError = ref<string | null>(null)

    const getUserIdSafe = (): string | null => {
        return authStore.user?.id || null
    }

    const { withRetry, handleError } = createDatabaseHelpers(lastSyncError)

    const ctx: DatabaseContext = { authStore, isSyncing, lastSyncError, getUserIdSafe, withRetry, handleError }

    const tombstone = useTombstoneDatabase(ctx)
    const tasks = useTasksDatabase(ctx)
    const projects = useProjectsDatabase(ctx)
    const groups = useGroupsDatabase(ctx)
    const notifications = useNotificationsDatabase(ctx)
    const timer = useTimerDatabase(ctx)
    const settings = useSettingsDatabase(ctx)
    const quickSort = useQuickSortDatabase(ctx)
    const pinnedTasks = usePinnedTasksDatabase(ctx)
    const workProfile = useWorkProfileDatabase(ctx)
    const realtime = useRealtimeSubscription(ctx)

    return {
        isSyncing,
        lastSyncError,
        ...projects,
        ...tasks,
        ...groups,
        // TASK-317: Tombstone functions
        ...tombstone,
        ...notifications,
        ...timer,
        ...settings,
        ...quickSort,
        // FEATURE-1248: Pinned Tasks
        ...pinnedTasks,
        // FEATURE-1317: Work Profile
        ...workProfile,
        ...realtime,
    }
}
