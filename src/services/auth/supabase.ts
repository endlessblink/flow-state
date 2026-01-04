import { createClient } from '@supabase/supabase-js'

// These will be provided by your Supabase project settings
// For now, we'll use empty strings or env vars if available
// The app should handle missing config gracefully (Guest Mode)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Re-export types for convenience
export type { User, Session, AuthError } from '@supabase/supabase-js'
