'use strict'

function classifyMissingAuthContext(rendererAuthState) {
  const state = rendererAuthState && typeof rendererAuthState === 'object'
    ? rendererAuthState
    : null
  const retainedSignedInShell = !!(
    state
    && state.isInitialized
    && state.isAuthenticated
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
      body: { error: 'auth_reconnecting' },
    }
  }
  if (retainedSignedInShell && state.canSyncRemotely) {
    return {
      status: 503,
      body: { error: 'sidecar_auth_unavailable' },
    }
  }
  return {
    status: 503,
    body: { error: 'not_signed_in' },
  }
}

module.exports = { classifyMissingAuthContext }
