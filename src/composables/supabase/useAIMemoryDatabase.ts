import type {
  AIClarificationEvent,
  AIClarificationEventInput,
  AIContextEntity,
  AIMemoryPatch,
  ProjectContext,
  TaskContext,
} from '@/types/aiMemory'
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

type AIContextEntityRow = {
  id?: string
  entity_key: string
  entity_type: AIContextEntity['entityType']
  display_name: string
  canonical_project_id?: string | null
  canonical_task_id?: string | null
  summary?: string | null
  facts?: Record<string, unknown> | null
  corrections?: unknown
  confidence?: number
  completeness_score?: number
  last_asked_at?: string | null
  last_answered_at?: string | null
  ask_count?: number
  stale_after?: string | null
}

type AIClarificationEventRow = {
  id?: string
  entity_key: string
  entity_type: AIClarificationEvent['entityType']
  question_id: string
  event_type: AIClarificationEvent['eventType']
  question?: string | null
  selected_option_id?: string | null
  selected_label?: string | null
  free_text?: string | null
  memory_patch?: AIMemoryPatch | null
  source_message_id?: string | null
  created_at?: string | null
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

function toAIContextEntity(row: AIContextEntityRow): AIContextEntity {
  return {
    id: row.id,
    entityKey: row.entity_key,
    entityType: row.entity_type,
    displayName: row.display_name,
    canonicalProjectId: row.canonical_project_id ?? null,
    canonicalTaskId: row.canonical_task_id ?? null,
    summary: row.summary ?? null,
    facts: row.facts ?? {},
    corrections: stringArray(row.corrections),
    confidence: Number(row.confidence ?? 0),
    completenessScore: Number(row.completeness_score ?? 0),
    lastAskedAt: row.last_asked_at ?? null,
    lastAnsweredAt: row.last_answered_at ?? null,
    askCount: Number(row.ask_count ?? 0),
    staleAfter: row.stale_after ?? null,
  }
}

function toAIClarificationEvent(row: AIClarificationEventRow): AIClarificationEvent {
  return {
    id: row.id,
    entityKey: row.entity_key,
    entityType: row.entity_type,
    questionId: row.question_id,
    eventType: row.event_type,
    question: row.question ?? null,
    selectedOptionId: row.selected_option_id ?? null,
    selectedLabel: row.selected_label ?? null,
    freeText: row.free_text ?? null,
    memoryPatch: row.memory_patch ?? null,
    sourceMessageId: row.source_message_id ?? null,
    createdAt: row.created_at ?? null,
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function isSupabaseUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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

function computeAIEntityCompleteness(facts: Record<string, unknown>): number {
  const filled = [
    facts.domain,
    facts.whyItMatters,
    facts.successCriteria,
    facts.currentStakes,
    facts.urgencyWindow,
    facts.thisWeekImportance,
  ].filter(value => Array.isArray(value) ? value.length > 0 : Boolean(value)).length
  return Number((filled / 6).toFixed(3))
}

function mergeFactPatch(facts: Record<string, unknown>, patch?: AIMemoryPatch, freeText?: string): Record<string, unknown> {
  const next = { ...facts }
  if (patch) {
    if (patch.operation === 'append') {
      const current = Array.isArray(next[patch.field]) ? next[patch.field] as unknown[] : []
      next[patch.field] = uniqueStrings([...current.map(String), String(patch.value)])
    } else if (patch.operation === 'reject') {
      const current = Array.isArray(next.userCorrections) ? next.userCorrections as unknown[] : []
      next.userCorrections = uniqueStrings([...current.map(String), `Rejected: ${String(patch.value)}`])
    } else if (patch.operation === 'deprecate') {
      const current = Array.isArray(next.deprecated) ? next.deprecated as unknown[] : []
      next.deprecated = uniqueStrings([...current.map(String), `${patch.field}: ${String(patch.value)}`])
    } else if (patch.operation !== 'confirm') {
      next[patch.field] = patch.value
    }
  }
  if (freeText) next.whyItMatters = freeText
  return next
}

function clarificationAnsweredRecently(events: AIClarificationEvent[], cooldownDays: number): boolean {
  const cutoff = Date.now() - cooldownDays * 24 * 60 * 60 * 1000
  return events.some(event =>
    ['answered', 'dismissed', 'generated_with_uncertainty', 'showed_candidates'].includes(event.eventType) &&
    event.createdAt &&
    new Date(event.createdAt).getTime() >= cutoff
  )
}

export function useAIMemoryDatabase(ctx: DatabaseContext) {
  const { authStore, isSyncing, getUserIdSafe, withRetry, handleError } = ctx

  const fetchProjectContexts = async (projectIds: string[]): Promise<ProjectContext[]> => {
    const ids = uniqueStrings(projectIds).filter(isSupabaseUuid)
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
    const ids = uniqueStrings(taskIds).filter(isSupabaseUuid)
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

  const fetchAIContextEntities = async (entityKeys: string[]): Promise<AIContextEntity[]> => {
    const keys = uniqueStrings(entityKeys)
    if (!keys.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return []
    try {
      return await withRetry(async () => {
        const { data, error } = await getSupabase()
          .from('ai_context_entities')
          .select('*')
          .eq('user_id', userId)
          .in('entity_key', keys)
        if (error) throw error
        return ((data ?? []) as AIContextEntityRow[]).map(toAIContextEntity)
      }, 'fetchAIContextEntities')
    } catch (e) {
      handleError(e, 'fetchAIContextEntities')
      return []
    }
  }

  const fetchAIClarificationEvents = async (entityKeys: string[], limit = 20): Promise<AIClarificationEvent[]> => {
    const keys = uniqueStrings(entityKeys)
    if (!keys.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return []
    try {
      return await withRetry(async () => {
        const { data, error } = await getSupabase()
          .from('ai_clarification_events')
          .select('*')
          .eq('user_id', userId)
          .in('entity_key', keys)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        return ((data ?? []) as AIClarificationEventRow[]).map(toAIClarificationEvent)
      }, 'fetchAIClarificationEvents')
    } catch (e) {
      handleError(e, 'fetchAIClarificationEvents')
      return []
    }
  }

  const shouldAskClarification = async (entityKey: string, questionId: string, cooldownDays = 7): Promise<boolean> => {
    const events = await fetchAIClarificationEvents([entityKey], 20)
    return !clarificationAnsweredRecently(events.filter(event => event.questionId === questionId), cooldownDays)
  }

  const recordAIClarificationEvent = async (input: AIClarificationEventInput): Promise<void> => {
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) throw new Error('Cannot save AI clarification without an authenticated user.')
    const now = new Date().toISOString()
    try {
      isSyncing.value = true
      await withRetry(async () => {
        const { data: existingData, error: fetchError } = await getSupabase()
          .from('ai_context_entities')
          .select('*')
          .eq('user_id', userId)
          .eq('entity_key', input.entityKey)
          .maybeSingle()
        if (fetchError) throw fetchError
        const existing = (existingData ?? null) as AIContextEntityRow | null
        const facts = mergeFactPatch(existing?.facts ?? {}, input.memoryPatch, input.freeText)
        const corrections = input.eventType === 'correction'
          ? uniqueStrings([...stringArray(existing?.corrections), input.freeText || input.selectedLabel || input.questionId])
          : stringArray(existing?.corrections)
        const { error: upsertError } = await getSupabase()
          .from('ai_context_entities')
          .upsert({
            ...(existing ?? {}),
            user_id: userId,
            entity_key: input.entityKey,
            entity_type: input.entityType,
            display_name: input.displayName,
            summary: typeof facts.whyItMatters === 'string' ? facts.whyItMatters : existing?.summary ?? null,
            facts,
            corrections,
            confidence: Math.max(Number(existing?.confidence ?? 0), input.eventType === 'answered' ? 0.85 : 0.4),
            completeness_score: computeAIEntityCompleteness(facts),
            last_asked_at: input.eventType === 'asked' ? now : existing?.last_asked_at ?? null,
            last_answered_at: input.eventType === 'answered' ? now : existing?.last_answered_at ?? null,
            ask_count: Number(existing?.ask_count ?? 0) + (input.eventType === 'asked' ? 1 : 0),
          }, { onConflict: 'user_id,entity_key' })
        if (upsertError) throw upsertError

        const { error: eventError } = await getSupabase()
          .from('ai_clarification_events')
          .insert({
            user_id: userId,
            entity_key: input.entityKey,
            entity_type: input.entityType,
            question_id: input.questionId,
            event_type: input.eventType,
            question: input.question,
            selected_option_id: input.selectedOptionId,
            selected_label: input.selectedLabel,
            free_text: input.freeText,
            memory_patch: input.memoryPatch ?? null,
            source_message_id: input.sourceMessageId,
          })
        if (eventError) throw eventError
      }, 'recordAIClarificationEvent')
      invalidateCache.all()
    } catch (e) {
      handleError(e, 'recordAIClarificationEvent')
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  const applyAIMemoryPatch = async (patch: AIMemoryPatch): Promise<void> => {
    if (patch.entityType !== 'project' && patch.entityType !== 'task') {
      console.debug(`[AIMemory] Skipping legacy UUID memory patch for general entity: ${patch.entityType}:${patch.entityId}`)
      return
    }
    if (!isSupabaseUuid(patch.entityId)) {
      console.debug(`[AIMemory] Skipping ${patch.entityType} memory patch for non-Supabase UUID: ${patch.entityId}`)
      return
    }
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
    fetchAIContextEntities,
    fetchAIClarificationEvents,
    shouldAskClarification,
    recordAIClarificationEvent,
    applyAIMemoryPatch,
  }
}
