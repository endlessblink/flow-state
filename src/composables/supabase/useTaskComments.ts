// TASK-1553: Task Comments composable — CRUD + Realtime subscription
import { ref } from 'vue'
import { supabase } from './_infrastructure'
import { useAuthStore } from '@/stores/auth'
import type { TaskComment } from '@/types/workspace'

// ────────────────────────────────────────────────────────────────────────────
// DB row shape (snake_case from Supabase)
// ────────────────────────────────────────────────────────────────────────────

interface DbTaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  reply_to_comment_id: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

// ────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ────────────────────────────────────────────────────────────────────────────

function fromDb(
  row: DbTaskComment,
  memberMap: Map<string, { name?: string; email?: string }>
): TaskComment {
  const member = memberMap.get(row.user_id)
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    content: row.content,
    replyToCommentId: row.reply_to_comment_id,
    isDeleted: row.is_deleted,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    userName: member?.name,
    userEmail: member?.email,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Composable
// ────────────────────────────────────────────────────────────────────────────

export function useTaskComments() {
  const authStore = useAuthStore()

  const comments = ref<TaskComment[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ---------------------------------------------------------------------------
  // Member cache — avoids repeated auth.users joins.
  // Keyed by userId → { name, email }.
  // ---------------------------------------------------------------------------
  const memberCache = new Map<string, { name?: string; email?: string }>()

  async function resolveMember(userId: string): Promise<void> {
    if (memberCache.has(userId)) return

    try {
      // workspace_members may expose displayName / email; fall back to
      // auth.users metadata via the profiles pattern used elsewhere.
      const { data } = await supabase
        .from('workspace_members')
        .select('user_id, display_name, email')
        .eq('user_id', userId)
        .maybeSingle()

      if (data) {
        memberCache.set(userId, {
          name: data.display_name ?? undefined,
          email: data.email ?? undefined,
        })
      } else {
        // Fallback: at minimum record the userId so we don't re-query
        memberCache.set(userId, {})
      }
    } catch {
      memberCache.set(userId, {})
    }
  }

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

      // Seed any that still have no record so we don't re-query
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
  // fetchComments
  // ---------------------------------------------------------------------------

  async function fetchComments(taskId: string): Promise<TaskComment[]> {
    isLoading.value = true
    error.value = null

    try {
      const { data, error: dbError } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })

      if (dbError) throw dbError
      if (!data) return []

      const rows = data as DbTaskComment[]
      await resolveMembers(rows.map(r => r.user_id))

      const mapped = rows.map(r => fromDb(r, memberCache))
      comments.value = mapped
      return mapped
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      error.value = msg
      console.error('[useTaskComments] fetchComments failed:', e)
      return []
    } finally {
      isLoading.value = false
    }
  }

  // ---------------------------------------------------------------------------
  // addComment — optimistic insert
  // ---------------------------------------------------------------------------

  async function addComment(
    taskId: string,
    content: string,
    replyToCommentId: string | null = null,
    workspaceId?: string
  ): Promise<TaskComment | null> {
    const userId = authStore.user?.id
    if (!userId) {
      console.warn('[useTaskComments] addComment: not authenticated')
      return null
    }

    // Client-generated UUID for optimistic update
    const optimisticId = crypto.randomUUID()
    const now = new Date()

    const optimistic: TaskComment = {
      id: optimisticId,
      taskId,
      userId,
      content,
      replyToCommentId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      userName: memberCache.get(userId)?.name,
      userEmail: memberCache.get(userId)?.email,
    }

    // Render immediately
    comments.value = [...comments.value, optimistic]

    try {
      const { data, error: dbError } = await supabase
        .from('task_comments')
        .insert({
          id: optimisticId,
          task_id: taskId,
          user_id: userId,
          content,
          reply_to_comment_id: replyToCommentId,
          workspace_id: workspaceId,
        })
        .select('*')
        .single()

      if (dbError) throw dbError

      const confirmed = fromDb(data as DbTaskComment, memberCache)

      // Replace optimistic entry with confirmed row
      comments.value = comments.value.map(c =>
        c.id === optimisticId ? confirmed : c
      )

      // TASK-1554: Log activity for workspace comments (fire-and-forget)
      if (workspaceId) {
        import('./useWorkspaceActivity').then(({ useWorkspaceActivity }) => {
          useWorkspaceActivity().logActivity(
            workspaceId!,
            'comment_added',
            'comment',
            confirmed.id,
            { taskId, snippet: content.slice(0, 80) }
          )
        }).catch(() => {})
      }

      return confirmed
    } catch (e: unknown) {
      // Roll back optimistic entry
      comments.value = comments.value.filter(c => c.id !== optimisticId)
      const msg = e instanceof Error ? e.message : String(e)
      error.value = msg
      console.error('[useTaskComments] addComment failed:', e)
      return null
    }
  }

  // ---------------------------------------------------------------------------
  // updateComment — edit own comment only (RLS enforces ownership server-side)
  // ---------------------------------------------------------------------------

  async function updateComment(
    commentId: string,
    content: string
  ): Promise<boolean> {
    const userId = authStore.user?.id
    if (!userId) {
      console.warn('[useTaskComments] updateComment: not authenticated')
      return false
    }

    // Optimistic local update
    const original = comments.value.find(c => c.id === commentId)
    if (!original) return false

    comments.value = comments.value.map(c =>
      c.id === commentId ? { ...c, content, updatedAt: new Date() } : c
    )

    try {
      const { error: dbError } = await supabase
        .from('task_comments')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('user_id', userId) // extra safety; RLS already enforces this

      if (dbError) throw dbError

      return true
    } catch (e: unknown) {
      // Roll back
      comments.value = comments.value.map(c =>
        c.id === commentId ? original : c
      )
      const msg = e instanceof Error ? e.message : String(e)
      error.value = msg
      console.error('[useTaskComments] updateComment failed:', e)
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // deleteComment — soft delete
  // ---------------------------------------------------------------------------

  async function deleteComment(commentId: string): Promise<boolean> {
    const userId = authStore.user?.id
    if (!userId) {
      console.warn('[useTaskComments] deleteComment: not authenticated')
      return false
    }

    // Optimistic: remove from local list immediately
    const removed = comments.value.find(c => c.id === commentId)
    comments.value = comments.value.filter(c => c.id !== commentId)

    try {
      const { error: dbError } = await supabase
        .from('task_comments')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .eq('user_id', userId) // extra safety; RLS enforces ownership

      if (dbError) throw dbError

      return true
    } catch (e: unknown) {
      // Roll back: restore the comment
      if (removed) {
        comments.value = [...comments.value, removed].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )
      }
      const msg = e instanceof Error ? e.message : String(e)
      error.value = msg
      console.error('[useTaskComments] deleteComment failed:', e)
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // subscribeToComments — Supabase Realtime, scoped to a single task
  // Returns an unsubscribe function.
  // ---------------------------------------------------------------------------

  function subscribeToComments(taskId: string): () => void {
    const channelName = `task_comments:${taskId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          const eventType = payload.eventType

          if (eventType === 'INSERT') {
            const row = payload.new as DbTaskComment
            if (row.is_deleted) return

            // Resolve member info if not yet cached
            await resolveMember(row.user_id)
            const incoming = fromDb(row, memberCache)

            // Avoid duplicates (optimistic already applied)
            if (!comments.value.some(c => c.id === incoming.id)) {
              comments.value = [...comments.value, incoming].sort(
                (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
              )
            }
          } else if (eventType === 'UPDATE') {
            const row = payload.new as DbTaskComment

            if (row.is_deleted) {
              // Treat soft-delete update as removal
              comments.value = comments.value.filter(c => c.id !== row.id)
            } else {
              await resolveMember(row.user_id)
              const updated = fromDb(row, memberCache)
              comments.value = comments.value.map(c =>
                c.id === updated.id ? updated : c
              )
            }
          } else if (eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string }
            if (oldRow.id) {
              comments.value = comments.value.filter(c => c.id !== oldRow.id)
            }
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
    comments,
    isLoading,
    error,

    // Operations
    fetchComments,
    addComment,
    updateComment,
    deleteComment,
    subscribeToComments,
  }
}
