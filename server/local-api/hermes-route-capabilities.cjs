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
  { method: 'PATCH', path: '/api/tasks/:id', contractVersion: 'task-v1', available: true },
  { method: 'GET', path: '/api/timer/current', contractVersion: 'timer-current-v1', available: true },
  { method: 'GET', path: '/api/timer/diagnostics', contractVersion: 'timer-diagnostics-v1', available: true },
  { method: 'GET', path: '/api/tasks/:id/instances', contractVersion: 'task-instances-v1', available: true },
  { method: 'POST', path: '/api/tasks/:id/work-blocks', contractVersion: 'work-block-v1', available: true },
  { method: 'POST', path: '/api/tasks/:id/done-for-now', contractVersion: 'task-v1', available: true },
  { method: 'POST', path: '/api/tasks/:id/merge', contractVersion: 'task-v1', available: true },
  { method: 'GET', path: '/api/tasks/:id/subtasks', contractVersion: 'subtask-list-v1', available: true },
  { method: 'POST', path: '/api/tasks/:id/subtasks/batch', contractVersion: 'subtask-batch-v1', available: true },
])

const HERMES_ROUTE_BUNDLE_MARKERS = Object.freeze([
  SCHEMA_VERSION,
  ...HERMES_ROUTE_CAPABILITIES.flatMap(({ method, path, contractVersion }) => [method, path, contractVersion]),
])

// These strings are emitted by esbuild for the actual router branches. They
// cannot be satisfied by the capability data itself, so package validation
// catches a route that was advertised but never wired into the sidecar.
const HERMES_ROUTE_DISPATCH_MARKERS = Object.freeze([
  'if (req.method === "GET" && path === "/api/health")',
  'if (req.method === "GET" && path === "/api/assistant/context")',
  'if (req.method === "GET" && path === "/api/tasks")',
  'if (req.method === "GET" && path === "/api/tasks/search")',
  'if (req.method === "GET" && path === "/api/tasks/inventory")',
  'if (req.method === "GET" && taskMatch)',
  'if (req.method === "POST" && path === "/api/tasks/lifecycle")',
  'if (req.method === "PATCH" && taskMatch)',
  'if (req.method === "GET" && path === "/api/timer/current")',
  'if (req.method === "GET" && path === "/api/timer/diagnostics")',
  'if (req.method === "GET" && taskInstancesMatch)',
  'if (req.method === "POST" && workBlocksMatch)',
  'if (req.method === "POST" && doneForNowMatch)',
  'if (req.method === "POST" && mergeTasksMatch)',
  'if (req.method === "GET" && subtasksMatch)',
  'if (req.method === "POST" && subtaskBatchMatch)',
])

module.exports = {
  HERMES_ROUTE_BUNDLE_MARKERS,
  HERMES_ROUTE_CAPABILITIES,
  HERMES_ROUTE_DISPATCH_MARKERS,
  SCHEMA_VERSION,
}
