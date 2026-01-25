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
// If envUrl is relative (starts with /), prepend current origin
// BUG-1064: Tauri now connects to VPS Supabase (same as web) for cross-platform sync
function resolveSupabaseUrl(): string {
    // Check for explicit local mode (for development/testing)
    const useLocalSupabase = import.meta.env.VITE_USE_LOCAL_SUPABASE === 'true'
    if (useLocalSupabase) {
        return 'http://127.0.0.1:54321'
    }

    // Tauri: Use full VPS URL directly (WebView can't use relative paths)
    if (isTauri) {
        // envUrl should be the full VPS URL like 'https://api.in-theflow.com'
        // If it's relative, we can't use it in Tauri - need explicit URL
        if (envUrl.startsWith('/')) {
            console.warn('[Supabase] Tauri requires full URL, not relative path. Check VITE_SUPABASE_URL')
            // Fallback to production VPS
            return 'https://api.in-theflow.com'
        }
        return envUrl
    }

    // Web/PWA: Convert relative path to full URL if needed
    if (envUrl.startsWith('/') && typeof window !== 'undefined') {
        // e.g., '/supabase' becomes 'https://in-theflow.com/supabase'
        return `${window.location.origin}${envUrl}`
    }
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
