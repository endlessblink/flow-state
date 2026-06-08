#!/usr/bin/env node

/**
 * Read-only AI memory schema readiness check.
 *
 * This verifies that the Supabase REST schema cache can see the server-backed
 * AI memory tables/columns used by the chat quality system. It does not insert,
 * update, or delete data, and it never prints keys.
 */

const path = require('node:path')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true })
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true })

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const API_KEY = SERVICE_ROLE_KEY || ANON_KEY
const RETRIES = Number.parseInt(process.env.AI_MEMORY_SCHEMA_RETRIES || '2', 10)
const RETRY_MS = Number.parseInt(process.env.AI_MEMORY_SCHEMA_RETRY_MS || '1500', 10)

const REQUIRED_TABLES = {
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
    'stale_after',
    'last_answered_at',
    'ask_count',
    'memory_type',
    'scope',
    'last_reinforced_at',
    'reinforcement_count',
    'related_entities',
    'decay_score',
  ],
  ai_clarification_events: [
    'id',
    'user_id',
    'entity_key',
    'entity_type',
    'event_type',
    'question_id',
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

async function checkTable(table, columns) {
  const select = columns.join(',')
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=0`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
  })
  if (response.ok) {
    return { table, ok: true, status: response.status }
  }

  let body = ''
  try {
    body = await response.text()
  } catch {
    body = ''
  }

  return {
    table,
    ok: false,
    status: response.status,
    reason: summarizeError(body),
  }
}

function isSchemaCacheMiss(result) {
  return !result.ok && typeof result.reason === 'string' && result.reason.includes('PGRST205')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function summarizeError(body) {
  if (!body) return 'no response body'
  try {
    const parsed = JSON.parse(body)
    const parts = [parsed.code, parsed.message, parsed.hint]
      .map(value => typeof value === 'string' ? value : '')
      .filter(Boolean)
    return parts.join(' | ').slice(0, 260) || 'unrecognized JSON error'
  } catch {
    return body.replace(/\s+/g, ' ').slice(0, 260)
  }
}

async function main() {
  if (!SUPABASE_URL || !API_KEY) {
    console.error('[ai-memory-schema] Missing SUPABASE_URL/VITE_SUPABASE_URL or Supabase key env.')
    process.exit(2)
  }

  console.log(`[ai-memory-schema] Checking ${Object.keys(REQUIRED_TABLES).length} AI memory tables at ${SUPABASE_URL}`)
  console.log(`[ai-memory-schema] Auth mode: ${SERVICE_ROLE_KEY ? 'service-role read-only' : 'anon read-only'}`)

  let results = []
  const maxAttempts = Math.max(1, 1 + (Number.isFinite(RETRIES) ? RETRIES : 0))
  const retryDelay = Math.max(0, Number.isFinite(RETRY_MS) ? RETRY_MS : 0)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    results = []
    for (const [table, columns] of Object.entries(REQUIRED_TABLES)) {
      const result = await checkTable(table, columns)
      results.push(result)
      if (result.ok) {
        console.log(`[ai-memory-schema] OK ${table}`)
      } else {
        console.error(`[ai-memory-schema] FAIL ${table}: HTTP ${result.status} ${result.reason}`)
      }
    }

    const failed = results.filter(result => !result.ok)
    const schemaMisses = failed.filter(isSchemaCacheMiss)
    if (!failed.length) break
    if (attempt >= maxAttempts || schemaMisses.length !== failed.length) break

    console.error(`[ai-memory-schema] Schema cache still missing ${schemaMisses.length} table(s); retrying in ${retryDelay}ms (${attempt}/${maxAttempts - 1})...`)
    if (retryDelay > 0) {
      await sleep(retryDelay)
    }
  }

  const failed = results.filter(result => !result.ok)
  if (failed.length) {
    console.error(`[ai-memory-schema] ${failed.length}/${results.length} table checks failed. Apply AI memory migrations or refresh the REST schema cache.`)
    process.exit(1)
  }

  console.log('[ai-memory-schema] All AI memory tables/columns are visible through Supabase REST.')
}

main().catch(error => {
  console.error(`[ai-memory-schema] Failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
