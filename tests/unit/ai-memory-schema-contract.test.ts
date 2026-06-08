import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationFiles = [
  'supabase/migrations/20260608090000_ai_clarification_memory.sql',
  'supabase/migrations/20260608093000_ai_assistant_memory_metadata.sql',
  'supabase/migrations/20260608100000_ai_parameter_beliefs.sql',
  'supabase/migrations/20260608103000_ai_memory_snapshots.sql',
  'supabase/migrations/20260608110000_ai_clarification_event_delete_policy.sql',
  'supabase/migrations/20260608111500_ai_parameter_belief_lifecycle.sql',
]

const migrations = migrationFiles
  .map(file => readFileSync(join(root, file), 'utf8'))
  .join('\n')

const memoryDbSource = readFileSync(join(root, 'src/composables/supabase/useAIMemoryDatabase.ts'), 'utf8')
const aiMemoryTypes = readFileSync(join(root, 'src/types/aiMemory.ts'), 'utf8')

const tableColumns: Record<string, string[]> = {
  ai_context_entities: [
    'id',
    'user_id',
    'entity_key',
    'entity_type',
    'display_name',
    'canonical_project_id',
    'canonical_task_id',
    'summary',
    'facts',
    'corrections',
    'confidence',
    'completeness_score',
    'last_asked_at',
    'last_answered_at',
    'ask_count',
    'stale_after',
    'memory_type',
    'scope',
    'reinforcement_count',
    'last_reinforced_at',
    'related_entities',
    'decay_score',
  ],
  ai_clarification_events: [
    'id',
    'user_id',
    'entity_key',
    'entity_type',
    'question_id',
    'event_type',
    'question',
    'selected_option_id',
    'selected_label',
    'free_text',
    'memory_patch',
    'source_message_id',
    'coverage_score_at_time',
    'uncertainty_dimensions',
    'path_type',
    'context_snapshot',
    'created_at',
  ],
  ai_recommendation_feedback: [
    'id',
    'user_id',
    'generated_plan_id',
    'recommendation_id',
    'task_id',
    'entity_key',
    'action',
    'reason_category',
    'free_text',
    'revisit_at',
    'outcome_signals',
    'implicit_positive',
    'source_message_id',
    'created_at',
  ],
  ai_context_edges: [
    'id',
    'user_id',
    'source_entity_key',
    'target_entity_key',
    'relation_type',
    'confidence',
    'evidence',
    'source_event_id',
    'valid_from',
    'valid_until',
    'created_at',
  ],
  ai_parameter_beliefs: [
    'id',
    'user_id',
    'entity_key',
    'entity_type',
    'parameter_key',
    'belief_json',
    'confidence',
    'impact_weight',
    'last_answered_at',
    'stale_after',
    'last_reinforced_at',
    'reinforcement_count',
    'decay_score',
    'source_question_id',
    'source_event_id',
    'created_at',
    'updated_at',
  ],
  ai_memory_snapshots: [
    'id',
    'user_id',
    'snapshot_key',
    'scope',
    'entity_keys',
    'summary_text',
    'facts',
    'source_event_count',
    'source_entity_count',
    'confidence',
    'stale_after',
    'created_at',
    'updated_at',
  ],
}

function createTableBlock(table: string): string {
  const pattern = new RegExp(`create table if not exists public\\.${table} \\([\\s\\S]*?\\n\\);`, 'i')
  return migrations.match(pattern)?.[0] ?? ''
}

function migrationDefinesColumn(table: string, column: string): boolean {
  const createBlock = createTableBlock(table)
  if (new RegExp(`(^|\\n)\\s*${column}\\b`, 'i').test(createBlock)) return true
  const alterPattern = new RegExp(`alter table public\\.${table}[\\s\\S]*?add column if not exists ${column}\\b`, 'i')
  return alterPattern.test(migrations)
}

function enumValues(typeName: string): string[] {
  const block = aiMemoryTypes.match(new RegExp(`export type ${typeName} =[\\s\\S]*?(?=\\n\\nexport )`))?.[0] ?? ''
  return [...block.matchAll(/'([^']+)'/g)].map(match => match[1])
}

describe('AI memory schema contract', () => {
  it('keeps every runtime AI memory table backed by migrations', () => {
    for (const table of Object.keys(tableColumns)) {
      expect(memoryDbSource).toContain(`from('${table}')`)
      expect(migrations).toContain(`public.${table}`)
      expect(migrations).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('defines every column the runtime reads or writes', () => {
    for (const [table, columns] of Object.entries(tableColumns)) {
      for (const column of columns) {
        expect(migrationDefinesColumn(table, column), `${table}.${column}`).toBe(true)
      }
    }
  })

  it('keeps synthetic and workflow memory keyed by text, not UUID-only project ids', () => {
    expect(createTableBlock('ai_context_entities')).toContain('entity_key text not null')
    expect(createTableBlock('ai_clarification_events')).toContain('entity_key text not null')
    expect(createTableBlock('ai_parameter_beliefs')).toContain('entity_key text not null')
    expect(createTableBlock('ai_context_edges')).toContain('source_entity_key text not null')
    expect(createTableBlock('ai_context_edges')).toContain('target_entity_key text not null')
    expect(memoryDbSource).toContain('function aiContextEntityKeyFromPatch')
    expect(memoryDbSource).toContain('applyAIContextEntityPatch')
    expect(memoryDbSource).toContain("kind: 'context_entity_patch'")
    expect(memoryDbSource).toContain("from('ai_context_entities')")
  })

  it('keeps migration check enums aligned with TypeScript memory types', () => {
    for (const value of ['project', 'task', ...enumValues('AIContextEntityType')]) {
      expect(migrations).toContain(`'${value}'`)
    }
    for (const value of enumValues('AIClarificationPathType')) {
      expect(migrations).toContain(`'${value}'`)
    }
    for (const value of ['belongs_to', 'blocks', 'blocked_by', 'follow_up', 'corrected_by', 'similar_to', 'part_of_week', 'preference_affects', 'mentioned_with']) {
      expect(migrations).toContain(`'${value}'`)
    }
    for (const value of ['accept', 'timeblock', 'postpone', 'dismiss', 'simplify', 'explain']) {
      expect(migrations).toContain(`'${value}'`)
    }
    for (const value of ['too_hard', 'low_energy', 'not_important', 'wrong_context', 'already_done', 'needs_more_info', 'too_much', 'other']) {
      expect(migrations).toContain(`'${value}'`)
    }
  })

  it('keeps indexes for hot retrieval, cooldown, feedback, and graph traversal paths', () => {
    const requiredIndexes = [
      'idx_ai_context_entities_user_key',
      'idx_ai_clarification_events_user_key',
      'idx_ai_clarification_events_question',
      'idx_ai_recommendation_feedback_task',
      'idx_ai_recommendation_feedback_entity',
      'idx_ai_context_edges_source',
      'idx_ai_context_edges_target',
      'idx_ai_parameter_beliefs_user_entity',
      'idx_ai_parameter_beliefs_user_parameter',
      'idx_ai_parameter_beliefs_stale',
      'idx_ai_memory_snapshots_user_scope',
      'idx_ai_memory_snapshots_user_key',
      'idx_ai_memory_snapshots_stale',
    ]
    for (const indexName of requiredIndexes) {
      expect(migrations).toContain(`create index if not exists ${indexName}`)
    }
  })

  it('keeps user-owned AI memory rows clearable under RLS', () => {
    const clearableTables = [
      'ai_context_entities',
      'ai_clarification_events',
      'ai_recommendation_feedback',
      'ai_context_edges',
      'ai_parameter_beliefs',
      'ai_memory_snapshots',
    ]

    for (const table of clearableTables) {
      const policyPattern = new RegExp(
        `create policy "[^"]*delete[^"]*"\\s+on public\\.${table} for delete using \\(auth\\.uid\\(\\) = user_id\\)`,
        'i',
      )
      expect(migrations, `${table} delete policy`).toMatch(policyPattern)
    }
  })
})
