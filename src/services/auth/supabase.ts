import { createClient } from '@supabase/supabase-js'

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
// BUG-1064: Tauri ALWAYS connects to VPS for reliable cross-platform sync
// Local Supabase is only used for backup, not for the main app connection
function resolveSupabaseUrl(): string {
    // Production VPS URL - hardcoded for reliability
    const VPS_URL = 'https://api.in-theflow.com'

    // Tauri: Use env var if set (self-hosted builds), fall back to VPS (official builds)
    if (isTauri) {
        const url = envUrl || VPS_URL
        console.log('[Supabase] Tauri →', url)
        return url
    }

    // Web/PWA: Use env var or resolve relative path
    if (envUrl.startsWith('/') && typeof window !== 'undefined') {
        const resolved = `${window.location.origin}${envUrl}`
        console.log('[Supabase] Web/PWA:', resolved)
        return resolved
    }

    // Default: use env URL as-is
    console.log('[Supabase] Using:', envUrl || VPS_URL)
    return envUrl || VPS_URL
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

let supabaseClient;
try {
    supabaseClient = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            // BUG-339: Explicit auth configuration for reliability
            autoRefreshToken: true,
            persistSession: true,
            // Use custom storage key to avoid conflicts with other apps
            storageKey: 'flowstate-supabase-auth',
            // For desktop apps (Tauri), don't try to detect session from URL
            // This prevents issues with redirect flows in WebView
            detectSessionInUrl: !isTauri,
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
        global: {
            fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
                return fetch(url, {
                    ...options,
                    cache: 'no-store', // Bypass browser HTTP cache entirely
                })
            },
        },
    }) : null
} catch (e) {
    console.error('Supabase client failed to initialize:', e)
    supabaseClient = null
}

export const supabase = supabaseClient as any

// Re-export types for convenience
export type { User, Session, AuthError } from '@supabase/supabase-js'
