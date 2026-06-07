import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
    type DatabaseContext, type DatabaseDependencies,
    createDatabaseHelpers,
} from './_infrastructure'
import { useTombstoneDatabase } from './_tombstone'
import { useTasksDatabase } from './useTasksDatabase'
import { useProjectsDatabase } from './useProjectsDatabase'
import { useLanesDatabase } from './useLanesDatabase'
import { useGroupsDatabase } from './useGroupsDatabase'
import { useNotificationsDatabase } from './useNotificationsDatabase'
import { useTimerDatabase } from './useTimerDatabase'
import { useSettingsDatabase } from './useSettingsDatabase'
import { useQuickSortDatabase } from './useQuickSortDatabase'
import { useWorkProfileDatabase } from './useWorkProfileDatabase'
import { useAIMemoryDatabase } from './useAIMemoryDatabase'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { useTaskAuditLog } from './useTaskAuditLog'

// Re-export types and singletons used by consumers
export { invalidateCache } from './_infrastructure'
export type { SafeCreateTaskResult, TaskIdAvailability, TimerSettings } from './_infrastructure'
export type { TaskAuditEntry } from './useTaskAuditLog'

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
    const lanes = useLanesDatabase(ctx)
    const groups = useGroupsDatabase(ctx)
    const notifications = useNotificationsDatabase(ctx)
    const timer = useTimerDatabase(ctx)
    const settings = useSettingsDatabase(ctx)
    const quickSort = useQuickSortDatabase(ctx)
    const workProfile = useWorkProfileDatabase(ctx)
    const aiMemory = useAIMemoryDatabase(ctx)
    const realtime = useRealtimeSubscription(ctx)
    const auditLog = useTaskAuditLog(ctx)

    return {
        isSyncing,
        lastSyncError,
        ...projects,
        // TASK-1812: Lanes
        ...lanes,
        ...tasks,
        ...groups,
        // TASK-317: Tombstone functions
        ...tombstone,
        ...notifications,
        ...timer,
        ...settings,
        ...quickSort,
        // FEATURE-1317: Work Profile
        ...workProfile,
        ...aiMemory,
        ...realtime,
        // TASK-1734: Task Audit Log
        ...auditLog,
    }
}
