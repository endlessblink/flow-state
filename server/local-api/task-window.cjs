'use strict'

const { scopeTaskQuery } = require('./task-scope.cjs')

const CONTRACT_VERSION = 'task-window-v1'
const MAX_TASKS = 500
const READ_TIMEOUT_MS = 1500

function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
    && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
}

function parseTaskWindowParams(params) {
  const raw = params.get('days') || ''
  if (raw.length > 1024) return { ok: false, error: 'days is too long' }
  const days = [...new Set(raw.split(','))].sort()
  if (days.length < 1 || days.length > 31 || !days.every(validDay)) {
    return { ok: false, error: 'days must contain 1 to 31 ISO calendar dates' }
  }
  return { ok: true, days }
}

function failure(code) {
  return { contractVersion: CONTRACT_VERSION, complete: false, fresh: false,
    tasks: [], error: { code, message: 'planning window could not be read completely' } }
}

async function readTaskWindow(context, input) {
  // One database statement: no all-inventory fetch, consistency loop, count
  // query or client-side pagination. Dates are calendar labels, not UTC instants.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
  try {
    const clauses = [`due_date.in.(${input.days.join(',')})`,
      ...input.days.map(day => `instances.cs.${JSON.stringify([{ scheduledDate: day }])}`)]
    let query = context.supabase.from('tasks')
      .select('id,title,status,priority,due_date,due_time,estimated_duration,instances,workspace_id,canonical_revision')
      .eq('is_deleted', false).eq('is_completion_record', false).neq('status', 'done')
    query = scopeTaskQuery(context, query)
    const { data, error } = await query.or(clauses.join(','))
      .order('id', { ascending: true }).limit(MAX_TASKS + 1).abortSignal(controller.signal)
    if (error) return failure(controller.signal.aborted ? 'window_timeout' : 'window_read_failed')
    if (!Array.isArray(data)) return failure('window_invalid_data')
    if (data.length > MAX_TASKS) return failure('window_too_large')
    const days = new Set(input.days)
    const tasks = []
    for (const row of data) {
      if (!row || typeof row.id !== 'string' || typeof row.title !== 'string'
          || (row.instances != null && !Array.isArray(row.instances))) return failure('window_invalid_data')
      const instances = []
      for (const block of row.instances || []) {
        if (!block || typeof block !== 'object' || !validDay(block.scheduledDate)) {
          return failure('window_invalid_data')
        }
        if (!days.has(block.scheduledDate) || block.isSkipped || block.isLater
            || ['done', 'completed', 'skipped'].includes(block.status)) continue
        // Preserve scheduling overrides and per-block identity, not notification
        // preferences or unrelated private fields from the stored JSONB object.
        const item = {}
        for (const key of ['id', 'taskId', 'scheduledDate', 'scheduledTime', 'duration',
          'status', 'isRecurring', 'isModified', 'parentTaskId']) {
          if (block[key] !== undefined) item[key] = block[key]
        }
        instances.push(item)
      }
      if (row.status === 'done' || row.status === 'completed' || (!days.has(row.due_date) && !instances.length)) continue
      tasks.push({ id: row.id, title: row.title, status: 'todo', priority: row.priority ?? null,
        dueDate: row.due_date ?? null, dueTime: row.due_time ?? null,
        estimatedDuration: row.estimated_duration ?? null, instances,
        workspaceId: row.workspace_id ?? null, canonicalRevision: row.canonical_revision })
    }
    const result = { contractVersion: CONTRACT_VERSION, complete: true, fresh: true,
      scope: 'planning_window', days: input.days, capturedAt: new Date().toISOString(), tasks }
    // Match the consumer's bounded body contract, with space for HTTP metadata.
    if (Buffer.byteLength(JSON.stringify(result)) > 1024 * 1024) return failure('window_too_large')
    return result
  } catch {
    return failure(controller.signal.aborted ? 'window_timeout' : 'window_read_failed')
  } finally {
    clearTimeout(timer)
  }
}

module.exports = { parseTaskWindowParams, readTaskWindow }
