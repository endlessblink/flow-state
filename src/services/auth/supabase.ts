import { createClient } from '@supabase/supabase-js'

// These will be provided by your Supabase project settings
// For now, we'll use empty strings or env vars if available
// The app should handle missing config gracefully (Guest Mode)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// BUG-339: Detect if running in Tauri context
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

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
