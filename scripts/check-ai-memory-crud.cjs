#!/usr/bin/env node

/**
 * Guarded write/read/delete smoke for the server-backed AI memory layer.
 *
 * This is intentionally opt-in because it writes probe rows. It only writes
 * rows with an entity/snapshot/recommendation key prefixed by "probe:" and it
 * deletes those rows before exiting.
 */

const path = require('node:path')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true })
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true })

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const API_KEY = SERVICE_ROLE_KEY || ANON_KEY
const USER_ID = process.env.AI_MEMORY_PROBE_USER_ID || process.env.FLOWSTATE_USER_ID || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const ENABLED = process.env.AI_MEMORY_CRUD_PROBE === '1'

const RUN_ID = `probe:ai-memory:${Date.now()}`
const RELATED_KEY = `${RUN_ID}:related`
const SNAPSHOT_KEY = `${RUN_ID}:snapshot`
const RECOMMENDATION_ID = `${RUN_ID}:recommendation`

async function request(method, table, { query = '', body } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`
  const response = await fetch(url, {
    method,
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`${method} ${table} failed: HTTP ${response.status} ${summarizeError(text)}`)
  }

  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function insert(table, row) {
  return request('POST', table, {
    query: '?select=*',
    body: row,
  })
}

async function select(table, query) {
  return request('GET', table, { query })
}

async function remove(table, query) {
  return request('DELETE', table, { query })
}

async function cleanup() {
  await remove('ai_context_edges', `?source_entity_key=eq.${encodeURIComponent(RUN_ID)}`)
  await remove('ai_recommendation_feedback', `?recommendation_id=eq.${encodeURIComponent(RECOMMENDATION_ID)}`)
  await remove('ai_parameter_beliefs', `?entity_key=eq.${encodeURIComponent(RUN_ID)}`)
  await remove('ai_memory_snapshots', `?snapshot_key=eq.${encodeURIComponent(SNAPSHOT_KEY)}`)
  await remove('ai_clarification_events', `?entity_key=eq.${encodeURIComponent(RUN_ID)}`)
  await remove('ai_context_entities', `?entity_key=in.(${encodeURIComponent(`"${RUN_ID}","${RELATED_KEY}"`)})`)
}

function summarizeError(body) {
  if (!body) return 'no response body'
  try {
    const parsed = JSON.parse(body)
    return [parsed.code, parsed.message, parsed.hint]
      .map(value => typeof value === 'string' ? value : '')
      .filter(Boolean)
      .join(' | ')
      .slice(0, 260)
  } catch {
    return body.replace(/\s+/g, ' ').slice(0, 260)
  }
}

function assertFound(table, rows, predicate = () => true) {
  if (!Array.isArray(rows) || !rows.some(predicate)) {
    throw new Error(`${table} probe row was not readable after insert`)
  }
}

async function assertClean(table, query) {
  const rows = await select(table, query)
  if (Array.isArray(rows) && rows.length > 0) {
    throw new Error(`${table} cleanup left ${rows.length} probe row(s)`)
  }
}

async function main() {
  if (!ENABLED) {
    console.error('[ai-memory-crud] Refusing to write probe rows. Set AI_MEMORY_CRUD_PROBE=1 to run.')
    process.exit(2)
  }
  if (!SUPABASE_URL || !API_KEY) {
    console.error('[ai-memory-crud] Missing SUPABASE_URL/VITE_SUPABASE_URL or Supabase key env.')
    process.exit(2)
  }

  console.log(`[ai-memory-crud] Running guarded probe at ${SUPABASE_URL}`)
  console.log(`[ai-memory-crud] Auth mode: ${SERVICE_ROLE_KEY ? 'service-role write probe' : 'anon write probe'}`)

  try {
    await cleanup()

    await insert('ai_context_entities', {
      user_id: USER_ID,
      entity_key: RUN_ID,
      entity_type: 'workflow',
      display_name: 'AI memory CRUD probe',
      summary: 'Temporary write/read/delete validation row.',
      facts: { probe: true },
      corrections: [],
      confidence: 0.99,
      completeness_score: 0.99,
      memory_type: 'procedural',
      scope: 'workflow',
      reinforcement_count: 1,
      related_entities: [RELATED_KEY],
      decay_score: 0,
    })
    await insert('ai_context_entities', {
      user_id: USER_ID,
      entity_key: RELATED_KEY,
      entity_type: 'preference',
      display_name: 'AI memory CRUD related probe',
      facts: { probe: true },
      corrections: [],
      confidence: 0.9,
      completeness_score: 0.8,
      memory_type: 'preference',
      scope: 'user',
      related_entities: [],
    })
    await insert('ai_clarification_events', {
      user_id: USER_ID,
      entity_key: RUN_ID,
      entity_type: 'workflow',
      question_id: 'probe-question',
      event_type: 'answered',
      question: 'Probe question',
      selected_option_id: 'probe-option',
      selected_label: 'Probe answer',
      free_text: 'Temporary CRUD smoke answer.',
      memory_patch: {
        entityType: 'workflow',
        entityId: RUN_ID,
        operation: 'set',
        field: 'summary',
        value: 'Temporary CRUD smoke answer.',
        confidence: 0.99,
        source: 'button_answer',
      },
      coverage_score_at_time: 0.8,
      uncertainty_dimensions: ['preferences'],
      path_type: 'clarify_first',
      context_snapshot: { probe: true },
    })
    await insert('ai_parameter_beliefs', {
      user_id: USER_ID,
      entity_key: RUN_ID,
      entity_type: 'workflow',
      parameter_key: 'probe_parameter',
      belief_json: { value: 'probe', confidence: 0.99 },
      confidence: 0.99,
      impact_weight: 0.5,
      last_answered_at: new Date().toISOString(),
      reinforcement_count: 1,
      decay_score: 0,
    })
    await insert('ai_recommendation_feedback', {
      user_id: USER_ID,
      recommendation_id: RECOMMENDATION_ID,
      entity_key: RUN_ID,
      action: 'simplify',
      reason_category: 'too_much',
      free_text: 'Temporary CRUD smoke feedback.',
      outcome_signals: { probe: true },
      implicit_positive: false,
    })
    await insert('ai_context_edges', {
      user_id: USER_ID,
      source_entity_key: RUN_ID,
      target_entity_key: RELATED_KEY,
      relation_type: 'preference_affects',
      confidence: 0.9,
      evidence: { probe: true },
    })
    await insert('ai_memory_snapshots', {
      user_id: USER_ID,
      snapshot_key: SNAPSHOT_KEY,
      scope: 'workflow',
      entity_keys: [RUN_ID, RELATED_KEY],
      summary_text: 'Temporary CRUD smoke snapshot.',
      facts: { probe: true },
      source_event_count: 1,
      source_entity_count: 2,
      confidence: 0.9,
    })

    assertFound('ai_context_entities', await select('ai_context_entities', `?select=entity_key&entity_key=eq.${encodeURIComponent(RUN_ID)}`))
    assertFound('ai_clarification_events', await select('ai_clarification_events', `?select=entity_key,question_id&entity_key=eq.${encodeURIComponent(RUN_ID)}`))
    assertFound('ai_parameter_beliefs', await select('ai_parameter_beliefs', `?select=entity_key,parameter_key&entity_key=eq.${encodeURIComponent(RUN_ID)}`))
    assertFound('ai_recommendation_feedback', await select('ai_recommendation_feedback', `?select=recommendation_id,action&recommendation_id=eq.${encodeURIComponent(RECOMMENDATION_ID)}`))
    assertFound('ai_context_edges', await select('ai_context_edges', `?select=source_entity_key,target_entity_key&source_entity_key=eq.${encodeURIComponent(RUN_ID)}`))
    assertFound('ai_memory_snapshots', await select('ai_memory_snapshots', `?select=snapshot_key,scope&snapshot_key=eq.${encodeURIComponent(SNAPSHOT_KEY)}`))

    await cleanup()

    await assertClean('ai_context_entities', `?select=entity_key&entity_key=in.(${encodeURIComponent(`"${RUN_ID}","${RELATED_KEY}"`)})`)
    await assertClean('ai_clarification_events', `?select=entity_key&entity_key=eq.${encodeURIComponent(RUN_ID)}`)
    await assertClean('ai_parameter_beliefs', `?select=entity_key&entity_key=eq.${encodeURIComponent(RUN_ID)}`)
    await assertClean('ai_recommendation_feedback', `?select=recommendation_id&recommendation_id=eq.${encodeURIComponent(RECOMMENDATION_ID)}`)
    await assertClean('ai_context_edges', `?select=source_entity_key&source_entity_key=eq.${encodeURIComponent(RUN_ID)}`)
    await assertClean('ai_memory_snapshots', `?select=snapshot_key&snapshot_key=eq.${encodeURIComponent(SNAPSHOT_KEY)}`)

    console.log('[ai-memory-crud] Probe rows inserted, read, and deleted successfully.')
  } catch (error) {
    await cleanup().catch(() => undefined)
    console.error(`[ai-memory-crud] Failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
