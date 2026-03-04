/**
 * Supabase Edge Function: whatsapp-task-webhook
 *
 * Receives WAHA webhook POSTs and creates tasks in FlowState's inbox.
 * Auth: shared secret header (X-Webhook-Secret), not Supabase JWT.
 * Uses service role key to bypass RLS.
 *
 * Required secrets (set via `supabase secrets set`):
 *   WAHA_WEBHOOK_SECRET   — shared secret for webhook auth
 *   FLOWSTATE_USER_ID     — your Supabase user UUID
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// Types
// ============================================================================

interface WahaWebhookPayload {
  event: string
  session: string
  payload: {
    id: string
    timestamp: number
    from: string
    fromMe: boolean
    body: string
    hasMedia: boolean
    mediaUrl?: string
    mimetype?: string
    title?: string        // document filename
    _data?: {
      type?: string       // 'image', 'video', 'audio', 'document', 'sticker'
      caption?: string
      filename?: string
    }
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Validate webhook secret
  const webhookSecret = Deno.env.get('WAHA_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('WAHA_WEBHOOK_SECRET not configured')
    return new Response(
      JSON.stringify({ error: 'Server misconfigured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Accept secret via header OR query param (?secret=...) since WAHA CORE
  // doesn't reliably send custom headers via WHATSAPP_HOOK_URL_HEADERS env var
  const url = new URL(req.url)
  const providedSecret = req.headers.get('x-webhook-secret') || url.searchParams.get('secret')
  if (!providedSecret || providedSecret !== webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Validate env
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const userId = Deno.env.get('FLOWSTATE_USER_ID')

  if (!supabaseUrl || !serviceRoleKey || !userId) {
    console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or FLOWSTATE_USER_ID')
    return new Response(
      JSON.stringify({ error: 'Server misconfigured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body: WahaWebhookPayload = await req.json()

    // Only process incoming messages (not status updates, acks, etc.)
    if (body.event !== 'message') {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: `Event type '${body.event}' ignored` }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Allow fromMe messages (forwards) — this is a personal webhook,
    // all messages (sent and received) can become tasks.

    const wahaMessageId = body.payload.id
    const messageBody = body.payload?.body || ''
    const hasMedia = body.payload?.hasMedia || false

    // Skip only if BOTH text and media are empty
    if (!messageBody.trim() && !hasMedia) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'Empty message (no text or media)' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Determine media type for title/description
    const mediaType = body.payload?._data?.type || body.payload?.mimetype?.split('/')[0] || ''
    const mediaLabel = hasMedia
      ? { image: '📷 Photo', video: '🎥 Video', audio: '🎵 Audio', document: '📄 Document', sticker: '🏷️ Sticker' }[mediaType] || '📎 Media'
      : ''
    const caption = body.payload?._data?.caption || ''
    const filename = body.payload?._data?.filename || body.payload?.title || ''

    // Build title: prefer text body, fall back to caption, then media label
    let title: string
    let description: string

    if (messageBody.trim()) {
      const lines = messageBody.split('\n')
      title = lines[0].trim().substring(0, 200)
      description = lines.length > 1 ? lines.slice(1).join('\n').trim() : ''
      if (hasMedia) {
        description = description ? `${mediaLabel}\n\n${description}` : mediaLabel
      }
    } else if (caption.trim()) {
      const lines = caption.split('\n')
      title = lines[0].trim().substring(0, 200)
      description = lines.length > 1 ? lines.slice(1).join('\n').trim() : ''
      description = description ? `${mediaLabel}\n\n${description}` : mediaLabel
    } else {
      title = `${mediaLabel}${filename ? ': ' + filename : ''}`
      description = ''
    }

    // Build description with WAHA metadata for dedup and traceability
    const metaLine = `[waha:${wahaMessageId}]`
    const fullDescription = description
      ? `${description}\n\n${metaLine}`
      : metaLine

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Dedup: check if a task with this WAHA message ID already exists
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .like('description', `%${metaLine}%`)
      .limit(1)

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'Duplicate message', existingTaskId: existing[0].id }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date().toISOString()
    const taskId = crypto.randomUUID()

    const taskRow = {
      id: taskId,
      user_id: userId,
      title,
      description: fullDescription,
      status: 'planned',
      priority: 'medium',
      progress: 0,
      completed_pomodoros: 0,
      total_pomodoros: 0,
      subtasks: [],
      tags: ['whatsapp'],
      is_in_inbox: true,
      is_uncategorized: true,
      is_deleted: false,
      order: 0,
      created_at: now,
      updated_at: now,
    }

    const { error: insertError } = await supabase
      .from('tasks')
      .insert(taskRow)

    if (insertError) {
      console.error('Task insert failed:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create task', detail: insertError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Task created: ${taskId} from WAHA message ${wahaMessageId}`)

    return new Response(
      JSON.stringify({ ok: true, taskId, title }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Webhook handler error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
