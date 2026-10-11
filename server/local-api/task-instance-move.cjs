'use strict'

// Moves ONE existing calendar instance (tasks.instances[] entry) of a
// user-owned task to a new date/time and optional duration.
// Preview is the default and never writes; it returns an HMAC digest bound to
// the task, the instance as it stands now, the requested target, and an expiry.
// Apply repeats the body with preview:false plus that digest/expiry, writes with
// a compare-and-swap on updated_at, and returns the stored instance read back.

const crypto = require('crypto')

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_ONLY_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const DIGEST_RE = /^[0-9a-f]{64}$/
const PREVIEW_TTL_MS = 10 * 60 * 1000
const ALLOWED_KEYS = new Set([
  'scheduledDate', 'scheduledTime', 'duration', 'preview', 'previewDigest', 'previewExpiresAt',
])

// Previews are only honoured by the process that issued them; a restart
// invalidates outstanding approvals, which then need a fresh preview.
const PROCESS_PREVIEW_KEY = crypto.randomBytes(32)

function fail(status, code, message, extra = {}) {
  return { status, body: { ok: false, error: { code, message, ...extra } } }
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function isValidDuration(value) {
  return Number.isInteger(value) && value >= 1 && value <= 1440
}

function validateMoveInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail(400, 'invalid_request', 'body required')
  }
  const unknown = Object.keys(body).find(key => !ALLOWED_KEYS.has(key))
  if (unknown) return fail(400, 'invalid_request', `unknown field: ${unknown}`)
  if (!isValidDateOnly(body.scheduledDate)) {
    return fail(400, 'invalid_request', 'scheduledDate must be YYYY-MM-DD')
  }
  if (typeof body.scheduledTime !== 'string' || !TIME_ONLY_RE.test(body.scheduledTime)) {
    return fail(400, 'invalid_request', 'scheduledTime must be HH:mm')
  }
  if (body.duration !== undefined && !isValidDuration(body.duration)) {
    return fail(400, 'invalid_request', 'duration must be an integer from 1 to 1440 minutes')
  }
  if (body.preview !== undefined && typeof body.preview !== 'boolean') {
    return fail(400, 'invalid_request', 'preview must be a boolean when provided')
  }
  if (body.preview === false && (
    !DIGEST_RE.test(body.previewDigest || '')
    || typeof body.previewExpiresAt !== 'string'
    || !Number.isFinite(Date.parse(body.previewExpiresAt))
  )) {
    return fail(400, 'approval_required', 'previewDigest and previewExpiresAt from a preview are required for apply')
  }
  return null
}

function instanceSlot(instance) {
  return {
    id: instance.id,
    scheduledDate: instance.scheduledDate,
    scheduledTime: instance.scheduledTime,
    duration: instance.duration,
  }
}

function sameSlot(a, b) {
  return a.scheduledDate === b.scheduledDate
    && a.scheduledTime === b.scheduledTime
    && a.duration === b.duration
}

function previewDigest(key, { userId, taskId, before, after, expiresAt }) {
  const payload = JSON.stringify([userId, taskId, instanceSlot(before), instanceSlot(after), expiresAt])
  return crypto.createHmac('sha256', key).update(payload).digest('hex')
}

function digestsEqual(a, b) {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

async function executeTaskInstanceMove(context, taskId, instanceId, body, notifyTaskMutation, options = {}) {
  const now = options.now || (() => new Date())
  const key = options.previewKey || PROCESS_PREVIEW_KEY
  const { supabase, userId } = context

  const invalid = validateMoveInput(body)
  if (invalid) return invalid
  if (typeof instanceId !== 'string' || instanceId.length === 0 || instanceId.length > 200) {
    return fail(400, 'invalid_request', 'instance id is invalid')
  }

  const { data: existing, error: findErr } = await supabase
    .from('tasks')
    .select('id,title,instances,updated_at')
    .eq('id', taskId)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (findErr) return fail(500, 'read_failed', 'task could not be read')
  if (!existing) return fail(404, 'not_found', 'task not found')

  const rawInstances = Array.isArray(existing.instances) ? existing.instances : []
  const matches = rawInstances.filter(item => item && typeof item === 'object' && item.id === instanceId)
  if (matches.length === 0) return fail(404, 'instance_not_found', 'instance not found on this task')
  if (matches.length > 1) return fail(409, 'ambiguous_instance', 'more than one instance has this id')

  const current = matches[0]
  const duration = body.duration !== undefined ? body.duration : current.duration
  if (!isValidDuration(duration)) {
    return fail(400, 'invalid_request', 'duration is required because the existing instance has no valid duration')
  }
  const before = instanceSlot(current)
  const after = { id: instanceId, scheduledDate: body.scheduledDate, scheduledTime: body.scheduledTime, duration }
  const task = { id: existing.id, title: existing.title }

  if (body.preview !== false) {
    if (sameSlot(before, after)) return fail(409, 'no_change', 'the instance is already at this date, time, and duration')
    const expiresAt = new Date(now().getTime() + PREVIEW_TTL_MS).toISOString()
    return {
      status: 200,
      body: {
        ok: true,
        preview: true,
        task,
        before,
        instance: after,
        previewDigest: previewDigest(key, { userId, taskId, before, after, expiresAt }),
        previewExpiresAt: expiresAt,
      },
    }
  }

  // An apply retried after it already landed is answered from live state.
  if (sameSlot(before, after)) {
    return { status: 200, body: { ok: true, preview: false, alreadyApplied: true, task, before, instance: before } }
  }
  if (Date.parse(body.previewExpiresAt) <= now().getTime()) {
    return fail(409, 'preview_expired', 'the preview expired; request a new preview')
  }
  const expected = previewDigest(key, { userId, taskId, before, after, expiresAt: body.previewExpiresAt })
  if (!digestsEqual(expected, body.previewDigest)) {
    return fail(409, 'preview_mismatch', 'the instance or request changed since the preview; request a new preview')
  }

  const updatedInstances = rawInstances.map(item => (
    item && typeof item === 'object' && item.id === instanceId
      ? { ...item, scheduledDate: after.scheduledDate, scheduledTime: after.scheduledTime, duration: after.duration }
      : item
  ))
  const { data: written, error: updateErr } = await supabase
    .from('tasks')
    .update({ instances: updatedInstances, updated_at: now().toISOString() })
    .eq('id', taskId)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .eq('updated_at', existing.updated_at)
    .select('id,title,instances')
    .maybeSingle()
  if (updateErr) return fail(500, 'write_failed', 'instance could not be moved')
  if (!written) return fail(409, 'state_conflict', 'the task changed while moving; request a new preview')

  const stored = (Array.isArray(written.instances) ? written.instances : [])
    .filter(item => item && typeof item === 'object' && item.id === instanceId)
  if (stored.length !== 1 || !sameSlot(instanceSlot(stored[0]), after)) {
    return fail(500, 'read_back_mismatch', 'the stored instance does not match the approved move')
  }

  try { notifyTaskMutation('update', taskId) } catch { /* the durable write already succeeded */ }
  return {
    status: 200,
    body: { ok: true, preview: false, task, before, instance: instanceSlot(stored[0]) },
  }
}

module.exports = { executeTaskInstanceMove, PREVIEW_TTL_MS }
