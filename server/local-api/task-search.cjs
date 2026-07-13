'use strict'

const MAX_QUERY_LENGTH = 200
const MAX_LIMIT = 25
const DEFAULT_LIMIT = 25

function parseTaskSearchParams(searchParams) {
  const query = String(searchParams.get('q') || '').trim()
  if (!query) return { ok: false, error: 'q is required' }
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `q must be at most ${MAX_QUERY_LENGTH} characters` }
  }

  const rawLimit = searchParams.get('limit')
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, error: `limit must be an integer from 1 to ${MAX_LIMIT}` }
  }

  return { ok: true, query, limit }
}

function escapeIlikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&')
}

function buildTaskSearchQuery(context, input) {
  let query = context.supabase
    .from('tasks')
    .select('id,title,status,priority,due_date,project_id,workspace_id,recurrence_rule,recurrence_parent_id,recurrence_count,is_completion_record,updated_at')
    .eq('is_deleted', false)
    .eq('is_completion_record', false)

  if (context.activeWorkspaceId == null) {
    query = query
      .eq('user_id', context.userId)
      .is('workspace_id', null)
  } else {
    // Membership and row visibility are enforced by the signed-in client's RLS.
    query = query.eq('workspace_id', context.activeWorkspaceId)
  }

  return query
    .ilike('title', `%${escapeIlikePattern(input.query)}%`)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(input.limit)
}

module.exports = { buildTaskSearchQuery, parseTaskSearchParams }
