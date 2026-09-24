'use strict'

const { classifyMissingAuthContext } = require('./auth-availability.cjs')

const SCHEMA_VERSION = 'flowstate-api-readiness-v1'

/**
 * Describe whether the sidecar can safely serve authenticated task operations.
 * This is deliberately separate from /api/health: a live process can be
 * signed out, waiting for re-authentication, or unable to receive the
 * renderer's session while still serving loopback diagnostics.
 */
function buildApiReadiness({ ctx, rendererAuthState, mode = 'unknown', appVersion = 'unknown' } = {}) {
  const live = true
  const base = {
    schemaVersion: SCHEMA_VERSION,
    service: 'task-api',
    live,
    mode,
    appVersion,
  }

  if (ctx) {
    return {
      status: 200,
      body: {
        ...base,
        ok: true,
        ready: true,
        auth: 'ready',
        capabilities: {
          taskReads: true,
          taskMutations: true,
        },
      },
    }
  }

  const unavailable = classifyMissingAuthContext(rendererAuthState)
  return {
    status: unavailable.status,
    body: {
      ...base,
      ok: false,
      ready: false,
      auth: unavailable.body.error,
      action: unavailable.body.action || 'wait_or_sign_in_again',
      capabilities: {
        taskReads: false,
        taskMutations: false,
      },
    },
  }
}

module.exports = {
  SCHEMA_VERSION,
  buildApiReadiness,
}
