import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import { TauriStorageAdapter } from './tauriStorageAdapter'

// These will be provided by your Supabase project settings
// For now, we'll use empty strings or env vars if available
// The app should handle missing config gracefully (Guest Mode)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// BUG-339: Detect if running in Tauri context
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

/**
 * BUG-339: Select appropriate storage backend
 *
 * - Tauri: Use TauriStorageAdapter (persistent native key-value store)
 * - Browser: Use localStorage (standard behavior)
 *
 * The TauriStorageAdapter solves the issue where localStorage in WebView
 * contexts can lose sessions between app restarts.
 */
function getAuthStorage(): SupportedStorage {
  if (isTauri) {
    console.log('[SUPABASE] Using TauriStorageAdapter for auth persistence')
    return TauriStorageAdapter
  }
  return localStorage
}

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
            // BUG-339: Use appropriate storage backend for platform
            storage: typeof window !== 'undefined' ? getAuthStorage() : undefined,
        }
    }) : null
} catch (e) {
    console.error('Supabase client failed to initialize:', e)
    supabaseClient = null
}

export const supabase = supabaseClient as any

// Re-export types for convenience
export type { User, Session, AuthError } from '@supabase/supabase-js'
