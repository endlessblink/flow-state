'use strict'

const CONTRACT_VERSION = 'recurrence-chain-v1'

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function dateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeOccurrence(value, taskId) {
  if (!object(value) || typeof value.id !== 'string') return null
  const dueDate = value.dueDate || value.scheduledDate
  if (!dateOnly(dueDate)) return null
  return {
    id: value.id,
    taskId,
    dueDate,
    status: typeof value.status === 'string' ? value.status : 'todo',
  }
}

function buildRecurrenceChainRead({ definition, history }) {
  if (!object(definition) || typeof definition.id !== 'string') {
    throw new TypeError('recurrence definition is required')
  }

  const taskId = definition.id
  const occurrences = (Array.isArray(definition.instances) ? definition.instances : [])
    .map((value) => normalizeOccurrence(value, taskId))
    .filter(Boolean)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
  const currentOccurrence = occurrences.find((value) => value.dueDate === definition.due_date) || null
  const nextOccurrence = currentOccurrence
    ? occurrences.find((value) => value.dueDate > currentOccurrence.dueDate && value.status !== 'done') || null
    : null

  return {
    ok: true,
    contractVersion: CONTRACT_VERSION,
    definition: {
      id: taskId,
      title: typeof definition.title === 'string' ? definition.title : '',
      status: typeof definition.status === 'string' ? definition.status : 'todo',
      dueDate: dateOnly(definition.due_date) ? definition.due_date : null,
      dueTime: typeof definition.due_time === 'string' ? definition.due_time : null,
      recurrenceRule: object(definition.recurrence_rule) ? definition.recurrence_rule : null,
      recurrenceCount: Number.isSafeInteger(definition.recurrence_count) ? definition.recurrence_count : 0,
      workspaceId: definition.workspace_id ?? null,
      canonicalRevision: definition.canonical_revision,
      canonicalUpdatedAt: definition.updated_at,
    },
    history: (Array.isArray(history) ? history : [])
      .filter((value) => object(value)
        && value.recurrence_parent_id === taskId
        && value.is_completion_record === true)
      .map((value) => ({
        id: value.id,
        status: value.status,
        dueDate: value.due_date,
        completedAt: value.completed_at,
        recurrenceCount: value.recurrence_count,
      }))
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)) || String(a.id).localeCompare(String(b.id))),
    currentOccurrence,
    nextOccurrence,
  }
}

module.exports = { buildRecurrenceChainRead }
