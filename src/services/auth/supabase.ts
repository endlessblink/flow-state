import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// These will be provided by your Supabase project settings
// For now, we'll use empty strings or env vars if available
// The app should handle missing config gracefully (Guest Mode)
// BUG-339: Detect if running in Tauri context
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

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

    // Web/PWA: Resolve relative path (e.g. '/supabase' → 'https://host/supabase')
    if (envUrl.startsWith('/') && typeof window !== 'undefined') {
        const resolved = `${window.location.origin}${envUrl}`
        if (import.meta.env.DEV) console.log('[Supabase] Web/PWA:', resolved)
        return resolved
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

if (typeof window !== 'undefined' && !isTauri) {
    const hash = window.location.hash
    if (hash && (hash.includes('access_token=') || hash.includes('error='))) {
        // Handle both #/access_token=... (Vue Router prefix) and #access_token=... (normal)
        const hashContent = hash.startsWith('#/') ? hash.substring(2) : hash.substring(1)
        const params = new URLSearchParams(hashContent)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
            _pendingOAuthTokens = { access_token: accessToken, refresh_token: refreshToken }
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

let supabaseClient;
try {
    supabaseClient = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            // BUG-339: Explicit auth configuration for reliability
            autoRefreshToken: true,
            persistSession: true,
            // FEATURE-1202: PKCE flow for Tauri OAuth code exchange
            // PWA uses implicit flow (default) — PKCE not needed for redirect-based OAuth
            flowType: isTauri ? 'pkce' : 'implicit',
            // Use custom storage key to avoid conflicts with other apps
            storageKey: 'flowstate-supabase-auth',
            // For desktop apps (Tauri), don't try to detect session from URL.
            // When we have pending OAuth tokens, also disable — we handle session manually via setSession().
            // This prevents Supabase's _initialize() from racing with Vue Router for URL hash access.
            detectSessionInUrl: !isTauri && !_pendingOAuthTokens,
            // BUG-339: Use localStorage (reliable in Tauri 2.x)
            // Combined with proactive token refresh in auth.ts for session persistence
            storage: typeof window !== 'undefined' ? localStorage : undefined,
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
        // BUG-352: Add 10s fetch timeout for mobile PWA resilience + cache bypass
        global: {
            fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 10_000) // 10s timeout
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

export const supabase = supabaseClient as SupabaseClient | null

// Re-export types for convenience
export type { User, Session, AuthError } from '@supabase/supabase-js'
