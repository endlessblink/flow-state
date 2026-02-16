import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set')
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

/** Fetch active push subscriptions for a user */
export async function getUserSubscriptions(userId: string) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error) {
    console.error('[DB] Failed to fetch subscriptions:', error)
    return []
  }
  return data || []
}

/** Fetch user settings (for checking push preferences, quiet hours, etc.) */
export async function getUserSettings(userId: string) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .single()

  if (error) {
    // User may not have settings row yet — use defaults
    return null
  }
  return data?.settings || null
}

/** Increment failure count for a subscription */
export async function incrementFailureCount(subscriptionId: string) {
  // Read current, increment, write
  const { data } = await supabase
    .from('push_subscriptions')
    .select('failure_count')
    .eq('id', subscriptionId)
    .single()

  if (data) {
    await supabase
      .from('push_subscriptions')
      .update({ failure_count: data.failure_count + 1 })
      .eq('id', subscriptionId)
  }
}

/** Deactivate a subscription (gone/expired) */
export async function deactivateSubscription(subscriptionId: string) {
  await supabase
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('id', subscriptionId)
}

/** Remove subscriptions with too many failures */
export async function removeStaleSubscriptions(maxFailures: number = 5) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .delete()
    .gte('failure_count', maxFailures)
    .select()

  if (error) {
    console.error('[DB] Failed to cleanup stale subscriptions:', error)
    return 0
  }
  return data?.length || 0
}
