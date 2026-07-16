'use strict'

const SCHEMA_VERSION = 'flowstate-hermes-capabilities-v1'

// This is the compatibility boundary between Hermes and the packaged sidecar.
// Keep unavailable or legacy contracts visible so preflight can fail before a
// workflow starts instead of discovering drift during an approved mutation.
const HERMES_ROUTE_CAPABILITIES = Object.freeze([
  { method: 'GET', path: '/api/health', contractVersion: 'health-v1', available: true },
  { method: 'GET', path: '/api/assistant/context', contractVersion: 'assistant-context-v1', available: true },
  { method: 'GET', path: '/api/tasks', contractVersion: 'task-list-v1', available: true },
  { method: 'GET', path: '/api/tasks/search', contractVersion: 'task-search-v1', available: true },
  { method: 'GET', path: '/api/tasks/inventory', contractVersion: 'task-inventory-v1', available: true },
  { method: 'GET', path: '/api/tasks/:id', contractVersion: 'task-read-v1', available: true },
  { method: 'POST', path: '/api/tasks/lifecycle', contractVersion: 'task-lifecycle-v1', available: true },
  { method: 'PATCH', path: '/api/tasks/:id', contractVersion: 'canonical-task-patch-v1', available: true },
  { method: 'GET', path: '/api/timer/current', contractVersion: 'timer-current-v1', available: true },
  { method: 'GET', path: '/api/timer/diagnostics', contractVersion: 'timer-diagnostics-v1', available: true },
  { method: 'GET', path: '/api/tasks/:id/instances', contractVersion: 'task-instances-v1', available: true },
  { method: 'POST', path: '/api/tasks/:id/work-blocks', contractVersion: 'work-block-v1', available: false },
  { method: 'POST', path: '/api/tasks/:id/done-for-now', contractVersion: 'done-for-now-v1', available: true },
  { method: 'POST', path: '/api/tasks/:id/merge', contractVersion: 'task-merge-v1', available: true },
  { method: 'GET', path: '/api/tasks/:id/subtasks', contractVersion: 'subtask-list-v1', available: true },
  { method: 'POST', path: '/api/tasks/:id/subtasks/batch', contractVersion: 'legacy-subtask-batch-v0', available: true },
])

const HERMES_ROUTE_BUNDLE_MARKERS = Object.freeze([
  SCHEMA_VERSION,
  ...HERMES_ROUTE_CAPABILITIES.flatMap(({ method, path, contractVersion }) => [method, path, contractVersion]),
])

module.exports = {
  HERMES_ROUTE_BUNDLE_MARKERS,
  HERMES_ROUTE_CAPABILITIES,
  SCHEMA_VERSION,
}
