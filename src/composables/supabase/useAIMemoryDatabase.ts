import type { AIMemoryPatch, ProjectContext, TaskContext } from '@/types/aiMemory'
import { getSupabase, invalidateCache, swrCache, type DatabaseContext } from './_infrastructure'

type ProjectContextRow = {
  project_id: string
  user_id?: string
  summary?: string | null
  domain?: ProjectContext['domain']
  life_area?: string | null
  why_it_matters?: string | null
  success_criteria?: unknown
  failure_risks?: unknown
  current_stakes?: ProjectContext['currentStakes']
  urgency_window?: ProjectContext['urgencyWindow']
  preferred_cadence?: ProjectContext['preferredCadence'] | null
  task_selection_hints?: unknown
  non_goals?: unknown
  user_corrections?: unknown
  confidence?: number
  completeness_score?: number
  last_confirmed_at?: string | null
  last_updated_at?: string | null
  stale_after?: string | null
}

type TaskContextRow = {
  task_id: string
  project_id?: string | null
  user_id?: string
  summary?: string | null
  why_it_matters?: string | null
  success_criteria?: unknown
  current_stakes?: TaskContext['currentStakes']
  urgency_window?: TaskContext['urgencyWindow']
  selection_hints?: unknown
  non_goals?: unknown
  user_corrections?: unknown
  confidence?: number
  completeness_score?: number
  last_confirmed_at?: string | null
  last_updated_at?: string | null
  stale_after?: string | null
}

const PROJECT_FIELD_MAP: Record<string, keyof ProjectContextRow> = {
  summary: 'summary',
  domain: 'domain',
  lifeArea: 'life_area',
  whyItMatters: 'why_it_matters',
  successCriteria: 'success_criteria',
  failureRisks: 'failure_risks',
  currentStakes: 'current_stakes',
  urgencyWindow: 'urgency_window',
  preferredCadence: 'preferred_cadence',
  taskSelectionHints: 'task_selection_hints',
  nonGoals: 'non_goals',
  userCorrections: 'user_corrections',
  confidence: 'confidence',
  completenessScore: 'completeness_score',
  lastConfirmedAt: 'last_confirmed_at',
  staleAfter: 'stale_after',
}

const TASK_FIELD_MAP: Record<string, keyof TaskContextRow> = {
  projectId: 'project_id',
  summary: 'summary',
  whyItMatters: 'why_it_matters',
  successCriteria: 'success_criteria',
  currentStakes: 'current_stakes',
  urgencyWindow: 'urgency_window',
  selectionHints: 'selection_hints',
  nonGoals: 'non_goals',
  userCorrections: 'user_corrections',
  confidence: 'confidence',
  completenessScore: 'completeness_score',
  lastConfirmedAt: 'last_confirmed_at',
  staleAfter: 'stale_after',
}

const PROJECT_ARRAY_FIELDS = new Set<keyof ProjectContextRow>([
  'success_criteria',
  'failure_risks',
  'task_selection_hints',
  'non_goals',
  'user_corrections',
])

const TASK_ARRAY_FIELDS = new Set<keyof TaskContextRow>([
  'success_criteria',
  'selection_hints',
  'non_goals',
  'user_corrections',
])

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function toProjectContext(row: ProjectContextRow): ProjectContext {
  return {
    projectId: row.project_id,
    userId: row.user_id,
    summary: row.summary ?? null,
    domain: row.domain ?? 'unknown',
    lifeArea: row.life_area ?? null,
    whyItMatters: row.why_it_matters ?? null,
    successCriteria: stringArray(row.success_criteria),
    failureRisks: stringArray(row.failure_risks),
    currentStakes: row.current_stakes ?? 'unknown',
    urgencyWindow: row.urgency_window ?? 'unknown',
    preferredCadence: row.preferred_cadence ?? null,
    taskSelectionHints: stringArray(row.task_selection_hints),
    nonGoals: stringArray(row.non_goals),
    userCorrections: stringArray(row.user_corrections),
    confidence: Number(row.confidence ?? 0),
    completenessScore: Number(row.completeness_score ?? 0),
    lastConfirmedAt: row.last_confirmed_at ?? null,
    lastUpdatedAt: row.last_updated_at ?? null,
    staleAfter: row.stale_after ?? null,
  }
}

function toTaskContext(row: TaskContextRow): TaskContext {
  return {
    taskId: row.task_id,
    projectId: row.project_id ?? null,
    userId: row.user_id,
    summary: row.summary ?? null,
    whyItMatters: row.why_it_matters ?? null,
    successCriteria: stringArray(row.success_criteria),
    currentStakes: row.current_stakes ?? 'unknown',
    urgencyWindow: row.urgency_window ?? 'unknown',
    selectionHints: stringArray(row.selection_hints),
    nonGoals: stringArray(row.non_goals),
    userCorrections: stringArray(row.user_corrections),
    confidence: Number(row.confidence ?? 0),
    completenessScore: Number(row.completeness_score ?? 0),
    lastConfirmedAt: row.last_confirmed_at ?? null,
    lastUpdatedAt: row.last_updated_at ?? null,
    staleAfter: row.stale_after ?? null,
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function computeProjectCompleteness(row: ProjectContextRow): number {
  const filled = [
    Boolean(row.summary),
    row.domain && row.domain !== 'unknown',
    Boolean(row.why_it_matters),
    stringArray(row.success_criteria).length > 0,
    row.current_stakes && row.current_stakes !== 'unknown',
    row.urgency_window && row.urgency_window !== 'unknown',
  ].filter(Boolean).length
  return Number((filled / 6).toFixed(3))
}

function computeTaskCompleteness(row: TaskContextRow): number {
  const filled = [
    Boolean(row.summary),
    Boolean(row.why_it_matters),
    stringArray(row.success_criteria).length > 0,
    row.current_stakes && row.current_stakes !== 'unknown',
    row.urgency_window && row.urgency_window !== 'unknown',
  ].filter(Boolean).length
  return Number((filled / 5).toFixed(3))
}

export function useAIMemoryDatabase(ctx: DatabaseContext) {
  const { authStore, isSyncing, getUserIdSafe, withRetry, handleError } = ctx

  const fetchProjectContexts = async (projectIds: string[]): Promise<ProjectContext[]> => {
    const ids = uniqueStrings(projectIds)
    if (!ids.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return []
    const cacheKey = `ai-memory:project:${userId}:${ids.sort().join(',')}`
    return swrCache.getOrFetch(cacheKey, async () => {
      try {
        return await withRetry(async () => {
          const { data, error } = await getSupabase()
            .from('project_contexts')
            .select('*')
            .eq('user_id', userId)
            .in('project_id', ids)
          if (error) throw error
          return ((data ?? []) as ProjectContextRow[]).map(toProjectContext)
        }, 'fetchProjectContexts')
      } catch (e) {
        handleError(e, 'fetchProjectContexts')
        return []
      }
    })
  }

  const fetchTaskContexts = async (taskIds: string[]): Promise<TaskContext[]> => {
    const ids = uniqueStrings(taskIds)
    if (!ids.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return []
    const cacheKey = `ai-memory:task:${userId}:${ids.sort().join(',')}`
    return swrCache.getOrFetch(cacheKey, async () => {
      try {
        return await withRetry(async () => {
          const { data, error } = await getSupabase()
            .from('task_contexts')
            .select('*')
            .eq('user_id', userId)
            .in('task_id', ids)
          if (error) throw error
          return ((data ?? []) as TaskContextRow[]).map(toTaskContext)
        }, 'fetchTaskContexts')
      } catch (e) {
        handleError(e, 'fetchTaskContexts')
        return []
      }
    })
  }

  const searchAIMemory = async (query: string, limit = 8): Promise<{ projects: ProjectContext[]; tasks: TaskContext[] }> => {
    const text = query.trim()
    if (!text) return { projects: [], tasks: [] }
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return { projects: [], tasks: [] }
    try {
      return await withRetry(async () => {
        const [projectResult, taskResult] = await Promise.all([
          getSupabase()
            .from('project_contexts')
            .select('*')
            .eq('user_id', userId)
            .textSearch('summary', text, { type: 'websearch' })
            .limit(limit),
          getSupabase()
            .from('task_contexts')
            .select('*')
            .eq('user_id', userId)
            .textSearch('summary', text, { type: 'websearch' })
            .limit(limit),
        ])
        if (projectResult.error) throw projectResult.error
        if (taskResult.error) throw taskResult.error
        return {
          projects: ((projectResult.data ?? []) as ProjectContextRow[]).map(toProjectContext),
          tasks: ((taskResult.data ?? []) as TaskContextRow[]).map(toTaskContext),
        }
      }, 'searchAIMemory')
    } catch (e) {
      handleError(e, 'searchAIMemory')
      return { projects: [], tasks: [] }
    }
  }

  const applyAIMemoryPatch = async (patch: AIMemoryPatch): Promise<void> => {
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) throw new Error('Cannot save AI memory without an authenticated user.')

    const table = patch.entityType === 'project' ? 'project_contexts' : 'task_contexts'
    const idColumn = patch.entityType === 'project' ? 'project_id' : 'task_id'
    const fieldMap = patch.entityType === 'project' ? PROJECT_FIELD_MAP : TASK_FIELD_MAP
    const arrayFields = patch.entityType === 'project' ? PROJECT_ARRAY_FIELDS : TASK_ARRAY_FIELDS
    const dbField = fieldMap[patch.field]
    if (!dbField && patch.operation !== 'confirm') {
      throw new Error(`Unsupported AI memory field: ${patch.field}`)
    }

    try {
      isSyncing.value = true
      await withRetry(async () => {
        const { data: existingData, error: fetchError } = await getSupabase()
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .eq(idColumn, patch.entityId)
          .maybeSingle()
        if (fetchError) throw fetchError

        const existing = (existingData ?? null) as ProjectContextRow | TaskContextRow | null
        const next: Record<string, unknown> = {
          ...(existing ?? {}),
          [idColumn]: patch.entityId,
          user_id: userId,
          last_updated_at: new Date().toISOString(),
          confidence: Math.max(Number(existing?.confidence ?? 0), patch.confidence),
        }

        if (patch.operation === 'confirm') {
          next.last_confirmed_at = new Date().toISOString()
        } else if (dbField) {
          const oldValue = existing?.[dbField as keyof typeof existing]
          if (patch.operation === 'append' || patch.operation === 'deprecate') {
            const current = stringArray(oldValue)
            const additions = Array.isArray(patch.value) ? patch.value.map(String) : [String(patch.value)]
            next[dbField] = uniqueStrings([
              ...current,
              ...additions.map(value => patch.operation === 'deprecate' ? `Deprecated: ${value}` : value),
            ])
          } else if (patch.operation === 'reject') {
            const current = stringArray(oldValue)
            next[dbField] = uniqueStrings([...current, `Rejected: ${String(patch.value)}`])
          } else {
            next[dbField] = patch.value
          }
        }

        if (patch.entityType === 'project') {
          next.completeness_score = computeProjectCompleteness(next as ProjectContextRow)
        } else {
          next.completeness_score = computeTaskCompleteness(next as TaskContextRow)
        }

        const { error: upsertError } = await getSupabase()
          .from(table)
          .upsert(next, { onConflict: idColumn })
        if (upsertError) throw upsertError

        const { error: eventError } = await getSupabase()
          .from('memory_events')
          .insert({
            user_id: userId,
            entity_type: patch.entityType,
            entity_id: patch.entityId,
            event_type: patch.source === 'model_inference' ? 'inferred_candidate' : patch.source === 'user_correction' ? 'correction' : patch.operation === 'confirm' ? 'confirmation' : 'user_answer',
            field: patch.field,
            old_value: dbField && existing ? existing[dbField as keyof typeof existing] ?? null : null,
            new_value: patch.value as Record<string, unknown> | string | number | boolean | null,
            confidence: patch.confidence,
            source_message_id: patch.sourceMessageId,
            source: patch.source,
          })
        if (eventError) throw eventError
      }, 'applyAIMemoryPatch')

      invalidateCache.all()
    } catch (e) {
      handleError(e, 'applyAIMemoryPatch')
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  return {
    fetchProjectContexts,
    fetchTaskContexts,
    searchAIMemory,
    applyAIMemoryPatch,
  }
}
