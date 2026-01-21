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
function resolveSupabaseUrl(): string {
    if (isTauri) {
        return 'http://127.0.0.1:54321'
    }
    if (envUrl.startsWith('/') && typeof window !== 'undefined') {
        // Convert relative path to full URL using current page origin
        // e.g., '/supabase' becomes 'https://xxx.trycloudflare.com/supabase'
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
        }
    }) : null
} catch (e) {
    console.error('Supabase client failed to initialize:', e)
    supabaseClient = null
}

export const supabase = supabaseClient as any

// Re-export types for convenience
export type { User, Session, AuthError } from '@supabase/supabase-js'
