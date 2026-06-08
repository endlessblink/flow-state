import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function src(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const clarificationMigration = src('supabase/migrations/20260608090000_ai_clarification_memory.sql')
const metadataMigration = src('supabase/migrations/20260608093000_ai_assistant_memory_metadata.sql')
const parameterBeliefsMigration = src('supabase/migrations/20260608100000_ai_parameter_beliefs.sql')
const aiMemoryDatabase = src('src/composables/supabase/useAIMemoryDatabase.ts')

function expectContainsAll(source: string, values: string[]) {
  for (const value of values) {
    expect(source).toContain(value)
  }
}

describe('AI memory database schema contract', () => {
  it('keeps the general clarification memory tables server-backed and tenant-scoped', () => {
    expect(clarificationMigration).toContain('create table if not exists public.ai_context_entities')
    expect(clarificationMigration).toContain('create table if not exists public.ai_clarification_events')
    expect(clarificationMigration).toMatch(/user_id uuid references auth\.users\(id\) on delete cascade not null/)
    expect(clarificationMigration).toContain('unique(user_id, entity_key)')
    expect(clarificationMigration).toContain('canonical_project_id uuid references public.projects(id) on delete set null')
    expect(clarificationMigration).toContain('canonical_task_id uuid references public.tasks(id) on delete set null')
  })

  it('supports real entities, synthetic buckets, workflows, and clarification event history', () => {
    expectContainsAll(clarificationMigration, [
      "'project'",
      "'task'",
      "'week'",
      "'preference'",
      "'synthetic_group'",
      "'workflow'",
      "'asked'",
      "'answered'",
      "'dismissed'",
      "'generated_with_uncertainty'",
      "'showed_candidates'",
      "'correction'",
    ])
  })

  it('enforces RLS for every AI memory table that stores user-specific state', () => {
    const combinedMigration = `${clarificationMigration}\n${metadataMigration}\n${parameterBeliefsMigration}`

    for (const table of [
      'ai_context_entities',
      'ai_clarification_events',
      'ai_recommendation_feedback',
      'ai_context_edges',
      'ai_parameter_beliefs',
    ]) {
      expect(combinedMigration).toContain(`alter table public.${table} enable row level security`)
      expect(combinedMigration).toContain(`on public.${table} for select using (auth.uid() = user_id)`)
      expect(combinedMigration).toContain(`on public.${table} for insert with check (auth.uid() = user_id)`)
    }

    for (const table of [
      'ai_context_entities',
      'ai_recommendation_feedback',
      'ai_context_edges',
      'ai_parameter_beliefs',
    ]) {
      expect(combinedMigration).toContain(`on public.${table} for update using (auth.uid() = user_id)`)
      expect(combinedMigration).toContain(`on public.${table} for delete using (auth.uid() = user_id)`)
    }
  })

  it('adds uncertainty, feedback, and graph metadata after base clarification memory exists', () => {
    expectContainsAll(metadataMigration, [
      'alter table public.ai_context_entities',
      'memory_type',
      'scope',
      'reinforcement_count',
      'last_reinforced_at',
      'related_entities',
      'decay_score',
      'alter table public.ai_clarification_events',
      'coverage_score_at_time',
      'uncertainty_dimensions',
      'path_type',
      'context_snapshot',
      'create table if not exists public.ai_recommendation_feedback',
      'create table if not exists public.ai_context_edges',
    ])
  })

  it('stores recommendation feedback and graph edges without a separate graph database dependency', () => {
    expectContainsAll(metadataMigration, [
      "'accept'",
      "'timeblock'",
      "'postpone'",
      "'dismiss'",
      "'simplify'",
      "'explain'",
      "'too_hard'",
      "'low_energy'",
      "'not_important'",
      "'wrong_context'",
      "'already_done'",
      "'needs_more_info'",
      "'too_much'",
      "'belongs_to'",
      "'blocks'",
      "'blocked_by'",
      "'follow_up'",
      "'corrected_by'",
      "'similar_to'",
      "'part_of_week'",
      "'preference_affects'",
      "'mentioned_with'",
    ])
  })

  it('keeps migration order explicit so metadata does not run before the base tables', () => {
    const migrations = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
      .filter((file) => file.includes('ai_'))
      .sort()

    expect(migrations.indexOf('20260608090000_ai_clarification_memory.sql')).toBeGreaterThanOrEqual(0)
    expect(migrations.indexOf('20260608093000_ai_assistant_memory_metadata.sql')).toBeGreaterThan(
      migrations.indexOf('20260608090000_ai_clarification_memory.sql'),
    )
    expect(migrations.indexOf('20260608100000_ai_parameter_beliefs.sql')).toBeGreaterThan(
      migrations.indexOf('20260608093000_ai_assistant_memory_metadata.sql'),
    )
  })

  it('stores parameter beliefs by text entity key so synthetic buckets are not UUID-cast', () => {
    expectContainsAll(parameterBeliefsMigration, [
      'create table if not exists public.ai_parameter_beliefs',
      'entity_key text not null',
      'parameter_key text not null',
      'belief_json jsonb not null',
      'confidence numeric(4,3)',
      'impact_weight numeric(4,3)',
      'unique(user_id, entity_key, parameter_key)',
      'idx_ai_parameter_beliefs_user_entity',
      'idx_ai_parameter_beliefs_low_confidence',
    ])
    expect(parameterBeliefsMigration).not.toContain('project_id uuid')
  })

  it('no-ops cleanly when the live database has not applied the AI memory migrations yet', () => {
    expect(aiMemoryDatabase).toContain('function isAIMemorySchemaMissing')
    expectContainsAll(aiMemoryDatabase, [
      'ai_context_entities',
      'ai_clarification_events',
      'ai_recommendation_feedback',
      'ai_context_edges',
      'ai_parameter_beliefs',
      'logMissingAIMemorySchema',
      'return []',
      'return',
    ])
  })

  it('upserts a memory entity before recording a clarification event answer', () => {
    const recordStart = aiMemoryDatabase.indexOf('const recordAIClarificationEvent')
    const entityUpsert = aiMemoryDatabase.indexOf(".from('ai_context_entities')", recordStart)
    const eventInsert = aiMemoryDatabase.indexOf(".from('ai_clarification_events')", recordStart)

    expect(recordStart).toBeGreaterThanOrEqual(0)
    expect(entityUpsert).toBeGreaterThan(recordStart)
    expect(eventInsert).toBeGreaterThan(entityUpsert)
  })

  it('updates parameter beliefs after answered clarification events', () => {
    const recordStart = aiMemoryDatabase.indexOf('const recordAIClarificationEvent')
    const eventInsert = aiMemoryDatabase.indexOf(".from('ai_clarification_events')", recordStart)
    const beliefInputs = aiMemoryDatabase.indexOf('beliefInputsFromClarification(input)', eventInsert)
    const beliefUpsert = aiMemoryDatabase.indexOf(".from('ai_parameter_beliefs')", beliefInputs)

    expect(recordStart).toBeGreaterThanOrEqual(0)
    expect(eventInsert).toBeGreaterThan(recordStart)
    expect(beliefInputs).toBeGreaterThan(eventInsert)
    expect(beliefUpsert).toBeGreaterThan(beliefInputs)
    expect(aiMemoryDatabase).toContain('fetchAIParameterBeliefs')
    expect(aiMemoryDatabase).toContain('upsertAIParameterBelief')
  })
})
