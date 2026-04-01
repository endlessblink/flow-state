// TASK-1554: Workspace Activity Feed — log + fetch + realtime
import { ref } from 'vue'
import { supabase } from './_infrastructure'
import { useAuthStore } from '@/stores/auth'
import type { WorkspaceActivity, ActivityAction, ActivityEntityType } from '@/types/workspace'

// ────────────────────────────────────────────────────────────────────────────
// DB row shape (snake_case from Supabase)
// ────────────────────────────────────────────────────────────────────────────

interface DbWorkspaceActivity {
  id: string
  workspace_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ────────────────────────────────────────────────────────────────────────────

function fromDb(
  row: DbWorkspaceActivity,
  memberMap: Map<string, { name?: string; email?: string }>
): WorkspaceActivity {
  const member = memberMap.get(row.user_id)
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    action: row.action as ActivityAction,
    entityType: row.entity_type as ActivityEntityType,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
    userName: member?.name,
    userEmail: member?.email,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Composable
// ────────────────────────────────────────────────────────────────────────────

export function useWorkspaceActivity() {
  const authStore = useAuthStore()

  const activities = ref<WorkspaceActivity[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Member cache — avoids repeated queries
  const memberCache = new Map<string, { name?: string; email?: string }>()

  async function resolveMembers(userIds: string[]): Promise<void> {
    const unknown = [...new Set(userIds)].filter(id => !memberCache.has(id))
    if (unknown.length === 0) return

    try {
      const { data } = await supabase
        .from('workspace_members')
        .select('user_id, display_name, email')
        .in('user_id', unknown)

      for (const row of data ?? []) {
        memberCache.set(row.user_id, {
          name: row.display_name ?? undefined,
          email: row.email ?? undefined,
        })
      }

      for (const id of unknown) {
        if (!memberCache.has(id)) memberCache.set(id, {})
      }
    } catch {
      for (const id of unknown) {
        if (!memberCache.has(id)) memberCache.set(id, {})
      }
    }
  }

  // ---------------------------------------------------------------------------
  // fetchFeed — load recent activity for a workspace
  // ---------------------------------------------------------------------------

  async function fetchFeed(workspaceId: string, limit = 30): Promise<WorkspaceActivity[]> {
    isLoading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('workspace_activity')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (dbError) throw dbError
      if (!data) return []

      const rows = data as DbWorkspaceActivity[]
      await resolveMembers(rows.map(r => r.user_id))

      const mapped = rows.map(r => fromDb(r, memberCache))
      activities.value = mapped
      return mapped
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      error.value = msg
      console.error('[useWorkspaceActivity] fetchFeed failed:', e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // logActivity — fire-and-forget insert into workspace_activity
  // ---------------------------------------------------------------------------

  async function logActivity(
    workspaceId: string,
    action: ActivityAction,
    entityType: ActivityEntityType,
    entityId: string | null = null,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const userId = authStore.user?.id
    if (!userId || !workspaceId) return

    try {
      const { error: dbError } = await supabase
        .from('workspace_activity')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          metadata,
        })

      if (dbError) {
        console.warn('[useWorkspaceActivity] logActivity failed:', dbError.message)
      }
    } catch (e) {
      console.warn('[useWorkspaceActivity] logActivity error:', e)
    }
  }

  // ---------------------------------------------------------------------------
  // subscribeToFeed — Supabase Realtime, scoped to workspace
  // Returns an unsubscribe function.
  // ---------------------------------------------------------------------------

  function subscribeToFeed(workspaceId: string): () => void {
    const channelName = `workspace_activity:${workspaceId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workspace_activity',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          const row = payload.new as DbWorkspaceActivity
          await resolveMembers([row.user_id])
          const incoming = fromDb(row, memberCache)

          // Prepend (newest first) and avoid duplicates
          if (!activities.value.some(a => a.id === incoming.id)) {
            activities.value = [incoming, ...activities.value]
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  return {
    // Reactive state
    activities,
    isLoading,
    error,

    // Operations
    fetchFeed,
    logActivity,
    subscribeToFeed,
  }
}
