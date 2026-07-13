import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanonicalChange, CanonicalChangePageRequest } from './canonicalChangeCatchup'
import type { CanonicalChangeScope } from './canonicalChangeCursor'

const CHANGE_FIELDS = 'change_sequence,entity_type,entity_id,action,tombstone'
const VALID_ACTIONS = new Set(['inserted', 'updated', 'deleted', 'restored'])

function scopeQuery<T extends {
  eq(column: string, value: unknown): T
  is(column: string, value: null): T
}>(query: T, scope: CanonicalChangeScope): T {
  if (scope.kind === 'personal') {
    return query.eq('user_id', scope.userId).is('workspace_id', null)
  }
  return query.eq('workspace_id', scope.workspaceId)
}

function mapChange(row: unknown): CanonicalChange {
  if (!row || typeof row !== 'object') throw new Error('Canonical change read returned an invalid row')
  const value = row as Record<string, unknown>
  const changeSequence = value.change_sequence
  const entityType = value.entity_type
  const entityId = value.entity_id
  const action = value.action
  const tombstone = value.tombstone
  if (
    !Number.isSafeInteger(changeSequence)
    || Number(changeSequence) <= 0
    || typeof entityType !== 'string'
    || !entityType
    || typeof entityId !== 'string'
    || !entityId
    || typeof action !== 'string'
    || !VALID_ACTIONS.has(action)
    || typeof tombstone !== 'boolean'
  ) {
    throw new Error('Canonical change read returned an invalid row')
  }
  return {
    changeSequence: Number(changeSequence),
    entityType,
    entityId,
    action: action as CanonicalChange['action'],
    tombstone,
  }
}

export function createCanonicalChangeSupabaseReader(client: SupabaseClient) {
  return {
    async readHighWater(scope: CanonicalChangeScope): Promise<number> {
      let query = client
        .from('canonical_change_log')
        .select('change_sequence')
      query = scopeQuery(query, scope)
      const { data, error } = await query
        .order('change_sequence', { ascending: false })
        .limit(1)
      if (error) throw new Error('Canonical change read failed')
      if (!data || data.length === 0) return 0
      const sequence = data[0]?.change_sequence
      if (!Number.isSafeInteger(sequence) || Number(sequence) <= 0) {
        throw new Error('Canonical change read returned an invalid row')
      }
      return Number(sequence)
    },

    async fetchChanges(request: CanonicalChangePageRequest): Promise<CanonicalChange[]> {
      let query = client
        .from('canonical_change_log')
        .select(CHANGE_FIELDS)
      query = scopeQuery(query, request.scope)
      const { data, error } = await query
        .gt('change_sequence', request.afterSequence)
        .order('change_sequence', { ascending: request.order === 'ascending' })
        .limit(request.limit)
      if (error) throw new Error('Canonical change read failed')
      if (!Array.isArray(data)) throw new Error('Canonical change read returned an invalid row')
      return data.map(mapChange)
    },
  }
}
