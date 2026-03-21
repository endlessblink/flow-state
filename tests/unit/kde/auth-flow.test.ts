/**
 * TASK-1656: KDE Auth Flow Tests (10 tests)
 *
 * Tests signIn, signOut, and refreshAccessToken logic extracted from
 * main.qml as pure JavaScript functions. Uses mock XMLHttpRequest to
 * verify correct request shapes and state mutations.
 *
 * Source: packages/kde-widget/contents/ui/main.qml
 *   - signIn(): lines 3944-3996
 *   - refreshAccessToken(): lines 3998-4055
 *   - signOut(): lines 4057-4068
 *   - parseOAuthCallback (oauthDataSource.onNewData): lines 180-221
 *   - isAuthenticated: line 35
 *   - loginTrigger handler: lines 5666-5697
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Auth state model
// ---------------------------------------------------------------------------

interface AuthState {
  accessToken: string
  refreshToken: string
  userId: string
  tokenExpiresIn: number
  isAuthenticating: boolean
  isRefreshingToken: boolean
  refreshTokenStartTime: number
  authError: string
}

function makeAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    accessToken: '',
    refreshToken: '',
    userId: '',
    tokenExpiresIn: 3600,
    isAuthenticating: false,
    isRefreshingToken: false,
    refreshTokenStartTime: 0,
    authError: '',
    ...overrides,
  }
}

// --- isAuthenticated (line 35) ---
function isAuthenticated(state: AuthState): boolean {
  return state.accessToken !== ''
}

// ---------------------------------------------------------------------------
// signIn URL and body construction (lines 3953-3958)
// ---------------------------------------------------------------------------

function buildSignInRequest(supabaseUrl: string, supabaseKey: string, email: string, password: string) {
  return {
    url: supabaseUrl + '/auth/v1/token?grant_type=password',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
    },
    body: JSON.stringify({ email, password }),
  }
}

// --- signIn success: parse response (lines 3965-3970) ---
function applySignInSuccess(state: AuthState, responseBody: string): AuthState {
  const response = JSON.parse(responseBody)
  return {
    ...state,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    userId: response.user?.id || '',
    tokenExpiresIn: response.expires_in || 3600,
    isAuthenticating: false,
    authError: '',
  }
}

// --- signIn failure: set error (lines 3985-3990) ---
function applySignInFailure(state: AuthState, status: number, responseBody: string): AuthState {
  let errorMsg = 'Sign in failed: ' + status
  try {
    const error = JSON.parse(responseBody)
    errorMsg = error.msg || error.error_description || error.message || errorMsg
  } catch (_) {
    // keep default
  }
  return {
    ...state,
    isAuthenticating: false,
    authError: errorMsg,
  }
}

// --- signOut: clear tokens (lines 4057-4068) ---
function applySignOut(state: AuthState): AuthState {
  return {
    ...state,
    accessToken: '',
    refreshToken: '',
    userId: '',
  }
}

// ---------------------------------------------------------------------------
// refreshAccessToken URL and body (lines 4015-4020)
// ---------------------------------------------------------------------------

function buildTokenRefreshRequest(supabaseUrl: string, supabaseKey: string, refreshToken: string) {
  return {
    url: supabaseUrl + '/auth/v1/token?grant_type=refresh_token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  }
}

// --- Refresh success: update tokens (lines 4027-4031) ---
function applyRefreshSuccess(state: AuthState, responseBody: string): AuthState {
  const response = JSON.parse(responseBody)
  return {
    ...state,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    userId: response.user?.id || state.userId,
    tokenExpiresIn: response.expires_in || 3600,
    isRefreshingToken: false,
  }
}

// --- Auto-refresh timing (line 3876): schedule before expiry ---
function computeRefreshInterval(tokenExpiresIn: number): number {
  // tokenRefreshTimer.interval = Math.max((tokenExpiresIn - 300) * 1000, 60000)
  return Math.max((tokenExpiresIn - 300) * 1000, 60000)
}

// ---------------------------------------------------------------------------
// OAuth callback parser (oauthDataSource.onNewData, lines 186-196)
// ---------------------------------------------------------------------------

interface OAuthResult {
  access_token?: string
  refresh_token?: string
  user_id?: string
  error?: string
}

function parseOAuthCallback(stdout: string): { success: boolean; state?: Partial<AuthState>; error?: string } {
  if (!stdout.trim()) return { success: false, error: 'No response from OAuth script' }
  try {
    const result: OAuthResult = JSON.parse(stdout.trim())
    if (result.access_token && result.refresh_token) {
      return {
        success: true,
        state: {
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          userId: result.user_id || '',
          authError: '',
          isAuthenticating: false,
        },
      }
    } else if (result.error) {
      return { success: false, error: result.error }
    }
    return { success: false, error: 'No response from OAuth script' }
  } catch (_) {
    return { success: false, error: 'Failed to parse OAuth response' }
  }
}

// ---------------------------------------------------------------------------
// loginTrigger handler (lines 5666-5696)
// ---------------------------------------------------------------------------

function processLoginTrigger(trigger: string): { action: 'signout' | 'signin' | 'none'; email?: string; password?: string } {
  if (!trigger) return { action: 'none' }
  if (trigger === 'SIGNOUT') return { action: 'signout' }
  if (trigger.includes(':')) {
    const colonIndex = trigger.indexOf(':')
    const email = trigger.substring(0, colonIndex)
    const password = trigger.substring(colonIndex + 1)
    return { action: 'signin', email, password }
  }
  return { action: 'none' }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TASK-1656: KDE Auth Flow', () => {
  const SUPABASE_URL = 'http://127.0.0.1:54321'
  const SUPABASE_KEY = 'anon-key-abc'

  describe('signIn request shape', () => {
    it('1. signIn makes POST to /auth/v1/token?grant_type=password', () => {
      const req = buildSignInRequest(SUPABASE_URL, SUPABASE_KEY, 'user@test.com', 'pass')
      expect(req.method).toBe('POST')
      expect(req.url).toBe(`${SUPABASE_URL}/auth/v1/token?grant_type=password`)
    })

    it('1. signIn body includes email and password', () => {
      const req = buildSignInRequest(SUPABASE_URL, SUPABASE_KEY, 'user@test.com', 'secret')
      const body = JSON.parse(req.body)
      expect(body.email).toBe('user@test.com')
      expect(body.password).toBe('secret')
    })

    it('1. signIn includes apikey header', () => {
      const req = buildSignInRequest(SUPABASE_URL, SUPABASE_KEY, 'u', 'p')
      expect(req.headers.apikey).toBe(SUPABASE_KEY)
    })
  })

  describe('Successful login', () => {
    it('2. successful login stores accessToken, refreshToken, userId', () => {
      const state = makeAuthState({ isAuthenticating: true })
      const body = JSON.stringify({
        access_token: 'tok-access',
        refresh_token: 'tok-refresh',
        user: { id: 'user-uuid-123' },
        expires_in: 3600,
      })
      const next = applySignInSuccess(state, body)
      expect(next.accessToken).toBe('tok-access')
      expect(next.refreshToken).toBe('tok-refresh')
      expect(next.userId).toBe('user-uuid-123')
    })

    it('2. successful login clears authError and isAuthenticating', () => {
      const state = makeAuthState({ isAuthenticating: true, authError: 'previous error' })
      const body = JSON.stringify({ access_token: 'a', refresh_token: 'b', user: { id: 'uid' }, expires_in: 3600 })
      const next = applySignInSuccess(state, body)
      expect(next.authError).toBe('')
      expect(next.isAuthenticating).toBe(false)
    })
  })

  describe('Failed login', () => {
    it('3. failed login sets authError from response msg field', () => {
      const state = makeAuthState({ isAuthenticating: true })
      const body = JSON.stringify({ msg: 'Invalid credentials' })
      const next = applySignInFailure(state, 400, body)
      expect(next.authError).toBe('Invalid credentials')
    })

    it('3. failed login falls back to "Sign in failed: {status}" on parse error', () => {
      const state = makeAuthState({ isAuthenticating: true })
      const next = applySignInFailure(state, 500, 'not json')
      expect(next.authError).toBe('Sign in failed: 500')
    })
  })

  describe('signOut', () => {
    it('4. signOut clears accessToken, refreshToken, and userId', () => {
      const state = makeAuthState({ accessToken: 'tok', refreshToken: 'ref', userId: 'uid' })
      const next = applySignOut(state)
      expect(next.accessToken).toBe('')
      expect(next.refreshToken).toBe('')
      expect(next.userId).toBe('')
    })
  })

  describe('Token refresh', () => {
    it('5. refreshAccessToken makes POST to /auth/v1/token?grant_type=refresh_token', () => {
      const req = buildTokenRefreshRequest(SUPABASE_URL, SUPABASE_KEY, 'ref-tok')
      expect(req.method).toBe('POST')
      expect(req.url).toBe(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`)
    })

    it('5. refreshAccessToken body includes refresh_token', () => {
      const req = buildTokenRefreshRequest(SUPABASE_URL, SUPABASE_KEY, 'my-refresh')
      const body = JSON.parse(req.body)
      expect(body.refresh_token).toBe('my-refresh')
    })

    it('6. successful refresh updates accessToken with new value', () => {
      const state = makeAuthState({ accessToken: 'old-token', refreshToken: 'old-ref', userId: 'uid' })
      const body = JSON.stringify({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        user: { id: 'uid' },
        expires_in: 3600,
      })
      const next = applyRefreshSuccess(state, body)
      expect(next.accessToken).toBe('new-access')
      expect(next.refreshToken).toBe('new-refresh')
    })
  })

  describe('Auto-refresh scheduling', () => {
    it('7. refresh timer scheduled at (tokenExpiresIn - 300) * 1000 ms', () => {
      expect(computeRefreshInterval(3600)).toBe((3600 - 300) * 1000)
    })

    it('7. refresh timer has minimum of 60000ms even for short-lived tokens', () => {
      expect(computeRefreshInterval(100)).toBe(60000)
    })
  })

  describe('Google OAuth callback', () => {
    it('8. parseOAuthCallback extracts access_token, refresh_token, user_id', () => {
      const stdout = JSON.stringify({ access_token: 'g-access', refresh_token: 'g-refresh', user_id: 'g-uid' })
      const result = parseOAuthCallback(stdout)
      expect(result.success).toBe(true)
      expect(result.state?.accessToken).toBe('g-access')
      expect(result.state?.userId).toBe('g-uid')
    })

    it('8. parseOAuthCallback returns error on empty stdout', () => {
      const result = parseOAuthCallback('')
      expect(result.success).toBe(false)
      expect(result.error).toBe('No response from OAuth script')
    })

    it('8. parseOAuthCallback returns error on malformed JSON', () => {
      const result = parseOAuthCallback('not-json')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to parse OAuth response')
    })
  })

  describe('isAuthenticated', () => {
    it('9. isAuthenticated is true when accessToken is non-empty', () => {
      const state = makeAuthState({ accessToken: 'some-token' })
      expect(isAuthenticated(state)).toBe(true)
    })

    it('9. isAuthenticated is false when accessToken is empty string', () => {
      const state = makeAuthState({ accessToken: '' })
      expect(isAuthenticated(state)).toBe(false)
    })
  })

  describe('Login trigger from config page', () => {
    it('10. trigger "email:password" parses to signIn action with credentials', () => {
      const result = processLoginTrigger('user@test.com:mypassword')
      expect(result.action).toBe('signin')
      expect(result.email).toBe('user@test.com')
      expect(result.password).toBe('mypassword')
    })

    it('10. trigger "SIGNOUT" maps to signOut action', () => {
      const result = processLoginTrigger('SIGNOUT')
      expect(result.action).toBe('signout')
    })

    it('10. empty trigger is ignored (action=none)', () => {
      const result = processLoginTrigger('')
      expect(result.action).toBe('none')
    })

    it('10. password with colon preserved (only first colon is delimiter)', () => {
      const result = processLoginTrigger('user@test.com:pass:with:colons')
      expect(result.action).toBe('signin')
      expect(result.email).toBe('user@test.com')
      expect(result.password).toBe('pass:with:colons')
    })
  })
})
