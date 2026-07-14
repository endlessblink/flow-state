'use strict'

function classifyMissingAuthContext(rendererAuthState) {
  const state = rendererAuthState && typeof rendererAuthState === 'object'
    ? rendererAuthState
    : null
  const retainedSignedInShell = !!(
    state
    && state.isInitialized
    && state.hasUser
  )

  if (retainedSignedInShell && state.reauthRequired) {
    return {
      status: 503,
      body: {
        error: 'reauth_required',
        action: 'sign_in_again',
      },
    }
  }
  if (retainedSignedInShell && !state.canSyncRemotely) {
    return {
      status: 503,
      body: {
        error: 'reauth_required',
        action: 'wait_or_sign_in_again',
      },
    }
  }
  if (retainedSignedInShell && state.canSyncRemotely) {
    return {
      status: 503,
      body: {
        error: 'sidecar_auth_bridge_failed',
        action: 'restart_or_sign_in_again',
      },
    }
  }
  return {
    status: 503,
    body: { error: 'signed_out' },
  }
}

module.exports = { classifyMissingAuthContext }
