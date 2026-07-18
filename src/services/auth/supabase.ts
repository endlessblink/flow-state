import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import { isTauri as isTauriRuntime } from '@/utils/platform'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { createLazyAuthStorage } from './authStorage'

// These will be provided by your Supabase project settings
// For now, we'll use empty strings or env vars if available
// The app should handle missing config gracefully (Guest Mode)
// BUG-339: Detect if running in Tauri context
const isTauri = isTauriRuntime()

// FEATURE-1345: Detect Capacitor runtime (Android/iOS native app)
const isCapacitorRuntime = typeof window !== 'undefined' &&
  !!window.Capacitor?.isNativePlatform?.()

// Electron: file:// protocol does not reliably persist localStorage across restarts.
// TASK-1881: Detect the Electron runtime robustly. The preload contextBridge normally injects
// `window.electronAPI.isElectron` before renderer scripts run, but relying on that single signal
// at module-eval is fragile (a momentary absence permanently mis-detected the runtime for the
// whole session). Fall back to the Electron user-agent / process tag so detection can't silently
// flip to the web branch (which would resolve a relative Supabase URL against a file:// origin).
export function detectElectronRuntime(): boolean {
    if (typeof window === 'undefined') return false
    const w = window as any
    if (w.electronAPI?.isElectron) return true
    if (w.process?.type === 'renderer') return true
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
    return / Electron\//i.test(ua) || /electron/i.test(ua)
}
const isElectronRuntime = detectElectronRuntime()

// FIX-MOBILE-PWA & TAURI COMPATIBILITY:
// - Browser/PWA: Use relative path '/supabase' (from .env) to work via Tunnel/Caddy
// - Tauri: Must use full URL 'http://127.0.0.1:54321' because relative paths fail in WebView
const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Supabase JS client requires full URL (not relative path)
// Self-hosting: All URLs come from env vars. No hardcoded fallbacks.
// Production: Doppler injects VITE_SUPABASE_URL at build time.
function resolveSupabaseUrl(): string {
    if (!envUrl) {
        console.warn('[Supabase] No VITE_SUPABASE_URL configured — running in Guest Mode')
        return ''
    }

    // Tauri: Use env var directly (must be a full URL)
    if (isTauri) {
        if (import.meta.env.DEV) console.log('[Supabase] Tauri →', envUrl)
        return envUrl
    }

    // Electron: Use env var directly (file:// can't resolve relative paths)
    if (isElectronRuntime) {
        if (import.meta.env.DEV) console.log('[Supabase] Electron →', envUrl)
        return envUrl
    }

    // FEATURE-1345: Capacitor: Use env var directly (WebView can't resolve relative paths)
    if (isCapacitorRuntime) {
        if (import.meta.env.DEV) console.log('[Supabase] Capacitor →', envUrl)
        return envUrl
    }

    // Web/PWA: Resolve relative path (e.g. '/supabase' → 'https://host/supabase').
    // TASK-1881: ONLY resolve against an http(s) origin. If runtime detection ever misfired in a
    // desktop build, the origin would be file:// and `${origin}${envUrl}` → a broken URL that
    // silently kills getSession/refreshSession (signed-out while local cache still renders).
    if (envUrl.startsWith('/') && typeof window !== 'undefined') {
        const protocol = window.location.protocol
        if (protocol === 'http:' || protocol === 'https:') {
            const resolved = `${window.location.origin}${envUrl}`
            if (import.meta.env.DEV) console.log('[Supabase] Web/PWA:', resolved)
            return resolved
        }
        console.warn(`[Supabase] Relative URL "${envUrl}" cannot be resolved against ${protocol} origin — using as-is. A desktop build needs a full VITE_SUPABASE_URL.`)
        return envUrl
    }

    // Default: use env URL as-is
    if (import.meta.env.DEV) console.log('[Supabase] Using:', envUrl)
    return envUrl
}

const supabaseUrl = resolveSupabaseUrl()

/**
 * BUG-339 UPDATE: Using localStorage for auth persistence
 *
 * Research findings (2026-01-20):
 * - localStorage IS reliable in Tauri 2.x (random port issue fixed in 2022)
 * - tauri-plugin-store causes Tokio runtime panic when called from JS
 * - The proactive token refresh in auth.ts handles session expiry
 *
 * Sources:
 * - https://github.com/tauri-apps/tauri/issues/896 (RESOLVED)
 * - https://aptabase.com/blog/persistent-state-tauri-apps
 */

// FEATURE-1202 FIX: Vue Router hash mode (#/) breaks Supabase OAuth token parsing.
//
// PROBLEM (two-layer):
// 1. Vue Router's createWebHashHistory() prefixes all hashes with #/.
//    After Google OAuth, URL becomes /#/access_token=eyJ... instead of /#access_token=eyJ...
//    Supabase's parseParametersFromURL does URLSearchParams(hash.substring(1)) which yields
//    key "/access_token" (not "access_token") — tokens silently ignored.
// 2. RACE CONDITION: Even after stripping /, Supabase's _initialize() uses navigator.locks
//    (async). Vue Router initializes synchronously during the async gap and navigates to #/,
//    wiping tokens before Supabase can read them.
//
// SOLUTION: Extract tokens synchronously at module load (before ANYTHING else runs),
// clean the URL, then call setSession() after client creation.
// See: https://github.com/supabase/auth-js/issues/455
let _pendingOAuthTokens: { access_token: string; refresh_token: string } | null = null
// TASK-1283: Capture Google provider tokens for Calendar API access
let _pendingProviderTokens: { provider_token: string; provider_refresh_token?: string } | null = null

if (typeof window !== 'undefined' && !isTauri && !isElectronRuntime && !isCapacitorRuntime) {
    const hash = window.location.hash
    if (hash && (hash.includes('access_token=') || hash.includes('error='))) {
        // Handle both #/access_token=... (Vue Router prefix) and #access_token=... (normal)
        const hashContent = hash.startsWith('#/') ? hash.substring(2) : hash.substring(1)
        const params = new URLSearchParams(hashContent)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
            _pendingOAuthTokens = { access_token: accessToken, refresh_token: refreshToken }

            // TASK-1283: Extract Google provider tokens from hash (for Calendar API)
            const providerToken = params.get('provider_token')
            const providerRefreshToken = params.get('provider_refresh_token')
            if (providerToken) {
                _pendingProviderTokens = {
                    provider_token: providerToken,
                    provider_refresh_token: providerRefreshToken || undefined
                }
                console.log('[Supabase] Extracted Google provider tokens from URL hash')
            }

            // Clean URL immediately — remove tokens from address bar for security
            // Use #/ so Vue Router routes to home page
            window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/')
            console.log('[Supabase] Extracted OAuth tokens from URL hash (bypassing Vue Router race condition)')
        } else if (params.get('error')) {
            console.error('[Supabase] OAuth error:', params.get('error'), params.get('error_description'))
            window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/')
        }
    }
}

/**
 * Electron storage adapter for Supabase auth.
 *
 * WHY: Electron loads the app via file:// in production. The Chromium file:// origin
 * has an isolated localStorage that is NOT persisted reliably across app restarts
 * (each cold launch can start with an empty origin storage). This causes users to be
 * signed out every time they relaunch the app.
 *
 * FIX: Route all auth token reads/writes through the disk-backed IPC store
 * (window.electronAPI.storeGet / storeSet), which writes to userData/store.json.
 * Supabase auth-js supports async storage — getItem/setItem/removeItem may return Promises.
 *
 * NOTE on removeItem: we store null via storeSet(key, null). getItem checks
 * `typeof value === 'string'` so a null stored value correctly returns null (absent key).
 */
// BUG-1874: lazy, call-time backend resolution (Electron IPC store vs localStorage).
// See src/services/auth/authStorage.ts for why this is no longer frozen at module-eval.
const authStorage = createLazyAuthStorage()

export const AUTH_SESSION_BACKUP_KEY = `${STORAGE_KEYS.SUPABASE_AUTH}-backup-v1`
export const AUTH_IDENTITY_KEY = `${STORAGE_KEYS.SUPABASE_AUTH}-identity-v1`

async function authStorageGet(key: string): Promise<string | null> {
    if (!authStorage) return null
    const value = await authStorage.getItem(key)
    return typeof value === 'string' ? value : null
}

async function authStorageSet(key: string, value: string): Promise<void> {
    if (!authStorage) return
    await authStorage.setItem(key, value)
}

async function authStorageRemove(key: string): Promise<void> {
    if (!authStorage) return
    await authStorage.removeItem(key)
}

export async function persistAuthSessionBackup(session: Session | null | undefined): Promise<void> {
    if (!session?.refresh_token || !session.user?.id) return
    try {
        await authStorageSet(AUTH_SESSION_BACKUP_KEY, JSON.stringify({
            savedAt: Date.now(),
            session,
        }))
        await authStorageSet(AUTH_IDENTITY_KEY, JSON.stringify(session.user))
    } catch (e) {
        console.warn('[Supabase] Failed to persist auth session backup:', e)
    }
}

/**
 * A credential-free durable account marker. Refresh-token rotation or a bad
 * release credential may invalidate the session, but that is not a user sign-out.
 * Keeping the User separately lets a cold restart retain account ownership and
 * cached data without replaying a server-rejected secret.
 */
export async function persistAuthIdentity(user: User | null | undefined): Promise<void> {
    if (!user?.id) return
    try {
        await authStorageSet(AUTH_IDENTITY_KEY, JSON.stringify(user))
    } catch (e) {
        console.warn('[Supabase] Failed to persist auth identity:', e)
    }
}

export async function readPersistedAuthIdentity(): Promise<User | null> {
    try {
        const raw = await authStorageGet(AUTH_IDENTITY_KEY)
        if (!raw) return null
        const user = JSON.parse(raw) as User | null
        return user?.id ? user : null
    } catch {
        return null
    }
}

export async function clearPersistedAuthIdentity(): Promise<void> {
    try {
        await authStorageRemove(AUTH_IDENTITY_KEY)
    } catch (e) {
        console.warn('[Supabase] Failed to clear auth identity:', e)
    }
}

function parsePersistedSession(raw: string | null, fromBackup: boolean): Session | null {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as Session | { session?: Session } | null
        if (!parsed || typeof parsed !== 'object') return null
        const candidate = fromBackup && 'session' in parsed ? parsed.session : parsed as Session
        return candidate?.refresh_token && candidate.user?.id ? candidate : null
    } catch {
        return null
    }
}

/**
 * BUG-1944: Read the best durable identity before auth-js finishes its network-backed
 * initialization. This is deliberately read-only: startup may use the user id for
 * local queue ownership, but auth-js remains authoritative for the usable session.
 */
export async function readPersistedAuthSessionCandidate(): Promise<Session | null> {
    const primary = parsePersistedSession(await authStorageGet(STORAGE_KEYS.SUPABASE_AUTH), false)
    if (primary) return primary
    return parsePersistedSession(await authStorageGet(AUTH_SESSION_BACKUP_KEY), true)
}

// ~JWT_EXP (GoTrue default 3600s) + 2min buffer. A backup older than this whose
// access token is already expired would force a refresh of a single-use token that
// the live instance has very likely already rotated → "Refresh Token: Already Used".
const MAX_AUTH_BACKUP_AGE_MS = (60 * 60 + 120) * 1000

/**
 * TASK-1871: Decide whether an auth-session backup is safe to replay. Its refresh token
 * is single-use and may already have been rotated (multiple Electron instances, normal
 * refresh cadence) — replaying a stale one yields a hard "Already Used" auth failure.
 * Replay only when the token is likely still active: access token not yet expired, OR
 * the backup is fresh (< ~JWT_EXP old). Pure + exported for testing.
 */
export function isAuthBackupReplayable(
    session: { refresh_token?: string | null; expires_at?: number } | null | undefined,
    savedAt: number | undefined,
    now: number = Date.now()
): boolean {
    if (!session?.refresh_token) return false
    const accessStillValid = typeof session.expires_at === 'number' && session.expires_at > now / 1000 + 30
    const ageMs = now - (typeof savedAt === 'number' ? savedAt : 0)
    return accessStillValid || ageMs <= MAX_AUTH_BACKUP_AGE_MS
}

export async function restoreAuthSessionFromBackup(): Promise<Session | null> {
    try {
        const raw = await authStorageGet(AUTH_SESSION_BACKUP_KEY)
        if (!raw) return null

        const parsed = JSON.parse(raw) as { savedAt?: number; session?: Session }
        const session = parsed?.session
        if (!session?.refresh_token || !session.user?.id) return null

        // TASK-1881 (fix for recurring Electron "signed out on restart"):
        // Do NOT locally refuse + delete the backup based on a ~62min age heuristic.
        // GoTrue refresh tokens live far longer than the access-token TTL, so a backup
        // whose access token has expired is almost always still refreshable. Always
        // restore it and let the SERVER decide on the next refresh — the genuine
        // "Invalid Refresh Token: Already Used" case is handled in auth.ts (it clears
        // the dead backup there and keeps a signed-in shell for reconnect). Refusing
        // here erased the only recovery source and guaranteed the sign-out.
        if (!isAuthBackupReplayable(session, parsed?.savedAt)) {
            console.warn('[Supabase] Auth backup looks old (access token expired); attempting restore anyway — server will validate the refresh token')
        }

        await authStorageSet(STORAGE_KEYS.SUPABASE_AUTH, JSON.stringify(session))
        console.warn('[Supabase] Restored missing auth session from Electron-safe backup')
        return session
    } catch (e) {
        console.warn('[Supabase] Failed to restore auth session backup:', e)
        return null
    }
}

export async function clearAuthSessionBackup(): Promise<void> {
    try {
        await authStorageRemove(AUTH_SESSION_BACKUP_KEY)
    } catch (e) {
        console.warn('[Supabase] Failed to clear auth session backup:', e)
    }
}

let supabaseClient: ReturnType<typeof createClient> | null;
try {
    supabaseClient = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            // BUG-339: Explicit auth configuration for reliability
            autoRefreshToken: true,
            persistSession: true,
            // FEATURE-1202 + TASK-1283: PKCE flow for ALL platforms.
            // PKCE does server-side code exchange → returns refresh tokens (needed for Google Calendar).
            // Implicit flow only gives short-lived access tokens with no refresh capability.
            // PKCE redirect uses ?code=xxx in query string (not hash), so Vue Router hash mode doesn't interfere.
            flowType: 'pkce',
            // Use custom storage key to avoid conflicts with other apps
            storageKey: 'flowstate-supabase-auth',
            // For desktop apps (Tauri/Capacitor), don't detect session from URL (they use deep links).
            // For web/PWA with PKCE: detectSessionInUrl MUST be true so Supabase picks up ?code=xxx
            // from the query string and exchanges it for tokens (including provider_refresh_token).
            // Legacy: if _pendingOAuthTokens is set (old implicit flow hash), disable to avoid conflict.
            detectSessionInUrl: !isTauri && !isElectronRuntime && !isCapacitorRuntime && !_pendingOAuthTokens,
            // BUG-339: Use localStorage (reliable in Tauri 2.x, not reliable in Electron file://)
            // Electron uses disk-backed IPC store instead (see electronStorage adapter above).
            // Combined with proactive token refresh in auth.ts for session persistence.
            storage: authStorage ?? undefined,
        },
        // BUG-1179: Configure Realtime to prevent connection drops
        // Cloudflare has 100-second idle timeout, so we send heartbeats more frequently
        // See: https://supabase.com/docs/guides/troubleshooting/realtime-heartbeat-messages
        realtime: {
            heartbeatIntervalMs: 15000,  // Send heartbeat every 15s (default: 25s) - keeps connection alive
            reconnectAfterMs: (tries: number) => {
                // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
                return Math.min(1000 * Math.pow(2, tries), 30000)
            },
            // Enable logging in development for debugging connection issues
            log_level: import.meta.env.DEV ? 'info' : 'error',
        },
        // TASK-1083: Prevent browser HTTP caching of Supabase responses
        // Note: Cannot add Cache-Control/Pragma headers - Supabase CORS doesn't allow them
        // Using cache: 'no-store' fetch option only (this is a Request option, not a header)
        // BUG-352 + BUG-1411: Fetch timeout for resilience + cache bypass
        // Increased from 10s → 30s: VPS Supabase can be slow under load,
        // 10s caused cascading AbortErrors on app startup
        global: {
            fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 30_000) // 30s timeout (BUG-1411)
                // Merge signals: if caller already has a signal, respect it too
                const signal = options.signal
                    ? AbortSignal.any([options.signal, controller.signal])
                    : controller.signal
                return fetch(url, {
                    ...options,
                    signal,
                    cache: 'no-store', // Bypass browser HTTP cache entirely
                }).finally(() => clearTimeout(timeoutId))
            },
        },
    }) : null
} catch (e) {
    console.error('Supabase client failed to initialize:', e)
    supabaseClient = null
}

// FEATURE-1202: Manually establish session from extracted OAuth tokens.
// This runs after createClient() but before any component mounts.
// setSession() goes through Supabase's lock system, so it queues behind _initialize().
if (_pendingOAuthTokens && supabaseClient) {
    supabaseClient.auth.setSession(_pendingOAuthTokens).then(({ data, error }) => {
        if (error) {
            console.error('[Supabase] Failed to set session from OAuth tokens:', error.message)
        } else {
            console.log('[Supabase] Session established from OAuth callback — user:', data?.user?.email)
        }
        _pendingOAuthTokens = null
    })
}

export const supabase = supabaseClient as SupabaseClient

// TASK-1797: Resolved URL + anon key, forwarded to the Electron Local API
// sidecar (token mode) so it can talk to Supabase as the logged-in user.
export const supabaseConfig = { url: supabaseUrl, anonKey: supabaseAnonKey }

// TASK-1283: Consume pending Google provider tokens (called once by auth store after sign-in)
export function consumePendingProviderTokens(): { provider_token: string; provider_refresh_token?: string } | null {
    const tokens = _pendingProviderTokens
    _pendingProviderTokens = null
    return tokens
}

/**
 * BUG-1874: Force the current session to durable storage right before an Electron update restart.
 * Writes both the primary auth key and the replayable backup, awaited, so the just-rotated
 * refresh token can't be left in-flight when the app exits. The main process additionally
 * flushes the IPC store write queue (see electron/ipc/store.ts flushStore) before exiting.
 */
export async function flushAuthForUpdate(): Promise<void> {
    try {
        if (!supabaseClient) return
        const { data } = await supabaseClient.auth.getSession()
        const session = data?.session
        if (!session) return
        await persistAuthSessionBackup(session)
        await authStorageSet(STORAGE_KEYS.SUPABASE_AUTH, JSON.stringify(session))
    } catch (e) {
        console.warn('[Supabase] flushAuthForUpdate failed:', e)
    }
}

/**
 * BUG-1933: write a session to the PRIMARY auth key.
 *
 * When a refresh fails, supabase-js calls `removeItem` on the storage adapter, which in Electron
 * writes `flowstate-supabase-auth: null` into store.json. The app then keeps a signed-in shell in
 * memory (keepSessionForReconnect) but the durable copy stays null, so the next launch has nothing
 * to rehydrate and only the backup key saves us. Re-persist the recoverable session so disk and
 * memory agree.
 */
export async function persistPrimaryAuthSession(session: Session): Promise<void> {
    try {
        await authStorageSet(STORAGE_KEYS.SUPABASE_AUTH, JSON.stringify(session))
    } catch (e) {
        console.warn('[Supabase] Failed to persist primary auth session:', e)
    }
}

// Re-export types for convenience
export type { User, Session, AuthError } from '@supabase/supabase-js'
