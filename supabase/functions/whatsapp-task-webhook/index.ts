/**
 * Supabase Edge Function: whatsapp-task-webhook
 *
 * Conversational WhatsApp bot for FlowState task creation.
 * Receives WAHA webhook POSTs, uses Groq AI to extract tasks from messages,
 * then guides the user through a numbered-reply conversation to confirm,
 * adjust priority, or assign a project before creating the task.
 *
 * Auth: shared secret header (X-Webhook-Secret) or query param (?secret=...).
 * Uses service role key to bypass RLS.
 *
 * Required secrets (set via `supabase secrets set`):
 *   WAHA_WEBHOOK_SECRET      - shared secret for webhook auth
 *   FLOWSTATE_USER_ID        - your Supabase user UUID
 *   WAHA_BASE_URL            - WAHA instance URL, e.g. http://waha:3000
 *   WAHA_API_KEY             - WAHA API key for sending messages
 *   GROQ_API_KEY             - Groq API key for AI extraction
 *   SUPABASE_URL             - auto-provided
 *   SUPABASE_SERVICE_ROLE_KEY - auto-provided
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    title?: string
    _data?: {
      type?: string
      caption?: string
      filename?: string
    }
  }
}

interface Conversation {
  id: string
  chat_id: string
  waha_message_id: string
  user_id: string
  state: 'awaiting_confirm' | 'choosing_project'
  extracted_title: string
  extracted_description: string
  priority: 'high' | 'medium' | 'low'
  project_id: string | null
  project_name: string | null
  original_message: string
  created_at: string
}

interface AIExtraction {
  title: string
  priority: 'high' | 'medium' | 'low'
  description: string
}

// ============================================================================
// Constants
// ============================================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const CONVERSATION_TIMEOUT_MS = 60 * 60 * 1000 // 1 hour

const AI_SYSTEM_PROMPT = `You are a task extraction assistant for a productivity app. Given a forwarded WhatsApp message, extract:
- title: concise task title (max 100 chars, imperative form like "Buy groceries" not "Buying groceries")
- priority: "high", "medium", or "low" based on urgency signals in the message
- description: any additional context worth preserving (empty string if none)

Respond in JSON format: { "title": "...", "priority": "...", "description": "..." }`

// ============================================================================
// Helpers
// ============================================================================

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function priorityEmoji(p: string): string {
  return (
    { high: '\u{1F534} High', medium: '\u{1F7E1} Medium', low: '\u{1F7E2} Low' }[p] ||
    '\u{1F7E1} Medium'
  )
}

// ============================================================================
// WAHA API: Send Message
// ============================================================================

async function sendWhatsAppMessage(chatId: string, text: string): Promise<void> {
  const wahaUrl = Deno.env.get('WAHA_BASE_URL')
  const wahaApiKey = Deno.env.get('WAHA_API_KEY')

  if (!wahaUrl) {
    console.error('WAHA_BASE_URL not configured, cannot send message')
    return
  }

  try {
    const res = await fetch(`${wahaUrl}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(wahaApiKey ? { 'X-Api-Key': wahaApiKey } : {}),
      },
      body: JSON.stringify({
        chatId,
        text,
        session: 'default',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`WAHA sendText failed (${res.status}):`, errText)
    }
  } catch (err) {
    console.error('WAHA sendText error:', (err as Error).message)
  }
}

// ============================================================================
// Groq AI: Extract Task from Message
// ============================================================================

async function extractTaskFromMessage(messageText: string): Promise<AIExtraction> {
  const groqApiKey = Deno.env.get('GROQ_API_KEY')
  if (!groqApiKey) {
    console.error('GROQ_API_KEY not configured, using fallback extraction')
    return {
      title: messageText.split('\n')[0].trim().substring(0, 100) || 'New task',
      priority: 'medium',
      description: '',
    }
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: messageText },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`Groq API error (${response.status}):`, errText)
      throw new Error(`Groq API returned ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty Groq response')

    const parsed = JSON.parse(content)
    return {
      title: (parsed.title || messageText.split('\n')[0].trim()).substring(0, 100),
      priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
      description: parsed.description || '',
    }
  } catch (err) {
    console.error('AI extraction failed, using fallback:', (err as Error).message)
    return {
      title: messageText.split('\n')[0].trim().substring(0, 100) || 'New task',
      priority: 'medium',
      description: '',
    }
  }
}

// ============================================================================
// Conversation Management
// ============================================================================

async function cleanupStaleConversations(supabase: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - CONVERSATION_TIMEOUT_MS).toISOString()
  const { error } = await supabase
    .from('whatsapp_conversations')
    .delete()
    .lt('created_at', cutoff)

  if (error) {
    console.error('Stale conversation cleanup failed:', error.message)
  }
}

async function getActiveConversation(
  supabase: SupabaseClient,
  chatId: string,
  userId: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as Conversation
}

async function deleteConversation(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('whatsapp_conversations').delete().eq('id', id)
  if (error) console.error('Failed to delete conversation:', error.message)
}

// ============================================================================
// Confirmation Message Builder
// ============================================================================

function buildConfirmationMessage(
  title: string,
  priority: string,
  projectName: string | null
): string {
  const projectLine = projectName || '\u{1F4E5} Inbox'
  return [
    '\u{1F4CB} New task from WhatsApp:',
    '',
    `Title: "${title}"`,
    `Priority: ${priorityEmoji(priority)}`,
    `Project: ${projectLine}`,
    '',
    'Reply:',
    '1. \u{2705} Create as-is',
    '2. \u{1F534} Set High priority',
    '3. \u{1F7E2} Set Low priority',
    '4. \u{1F4C1} Choose project',
    '5. \u{274C} Cancel',
  ].join('\n')
}

// ============================================================================
// Flow Handlers
// ============================================================================

async function handleNewMessage(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
  messageId: string,
  messageText: string
): Promise<void> {
  // AI extraction
  const extraction = await extractTaskFromMessage(messageText)

  // Create conversation row
  const conversationId = crypto.randomUUID()
  const { error } = await supabase.from('whatsapp_conversations').insert({
    id: conversationId,
    chat_id: chatId,
    waha_message_id: messageId,
    user_id: userId,
    state: 'awaiting_confirm',
    extracted_title: extraction.title,
    extracted_description: extraction.description,
    priority: extraction.priority,
    project_id: null,
    project_name: null,
    original_message: messageText.substring(0, 2000),
    created_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Failed to create conversation:', error.message)
    await sendWhatsAppMessage(chatId, '\u{26A0}\u{FE0F} Sorry, something went wrong. Try again.')
    return
  }

  // Send confirmation
  const confirmMsg = buildConfirmationMessage(
    extraction.title,
    extraction.priority,
    null
  )
  await sendWhatsAppMessage(chatId, confirmMsg)
}

async function handleCreateTask(
  supabase: SupabaseClient,
  conversation: Conversation,
  chatId: string
): Promise<void> {
  const now = new Date().toISOString()
  const taskId = crypto.randomUUID()

  // Build description with WAHA metadata for traceability
  const metaLine = `[waha:${conversation.waha_message_id}]`
  const descParts: string[] = []
  if (conversation.extracted_description) descParts.push(conversation.extracted_description)
  if (conversation.original_message && conversation.original_message !== conversation.extracted_title) {
    descParts.push(`Original message:\n${conversation.original_message}`)
  }
  descParts.push(metaLine)
  const fullDescription = descParts.join('\n\n')

  const taskRow = {
    id: taskId,
    user_id: conversation.user_id,
    title: conversation.extracted_title,
    description: fullDescription,
    status: 'planned',
    priority: conversation.priority,
    progress: 0,
    completed_pomodoros: 0,
    total_pomodoros: 0,
    subtasks: [],
    tags: ['whatsapp'],
    is_in_inbox: true,
    is_uncategorized: !conversation.project_id,
    is_deleted: false,
    order: 0,
    project_id: conversation.project_id || null,
    created_at: now,
    updated_at: now,
  }

  const { error: insertError } = await supabase.from('tasks').insert(taskRow)

  if (insertError) {
    console.error('Task insert failed:', insertError.message)
    await sendWhatsAppMessage(chatId, '\u{26A0}\u{FE0F} Failed to create task. Try again.')
    return
  }

  // Clean up conversation
  await deleteConversation(supabase, conversation.id)

  // Send success
  const projectLine = conversation.project_name || '\u{1F4E5} Inbox'
  await sendWhatsAppMessage(
    chatId,
    [
      `\u{2705} Task created: "${conversation.extracted_title}"`,
      `Priority: ${priorityEmoji(conversation.priority)}`,
      `Project: ${projectLine}`,
    ].join('\n')
  )

  console.log(`Task created: ${taskId} from conversation ${conversation.id}`)
}

async function handleChangePriority(
  supabase: SupabaseClient,
  conversation: Conversation,
  chatId: string,
  newPriority: 'high' | 'low'
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_conversations')
    .update({ priority: newPriority })
    .eq('id', conversation.id)

  if (error) {
    console.error('Failed to update priority:', error.message)
    await sendWhatsAppMessage(chatId, '\u{26A0}\u{FE0F} Failed to update priority. Try again.')
    return
  }

  const confirmMsg = buildConfirmationMessage(
    conversation.extracted_title,
    newPriority,
    conversation.project_name
  )
  await sendWhatsAppMessage(chatId, confirmMsg)
}

async function handleChooseProject(
  supabase: SupabaseClient,
  conversation: Conversation,
  chatId: string,
  userId: string
): Promise<void> {
  // Fetch user's projects
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('name', { ascending: true })

  if (error || !projects || projects.length === 0) {
    await sendWhatsAppMessage(
      chatId,
      'No projects found. Create a project in FlowState first.'
    )
    return
  }

  // Update conversation state
  const { error: updateError } = await supabase
    .from('whatsapp_conversations')
    .update({ state: 'choosing_project' })
    .eq('id', conversation.id)

  if (updateError) {
    console.error('Failed to update conversation state:', updateError.message)
    return
  }

  // Build project list
  const lines = ['\u{1F4C1} Choose a project:', '']
  projects.forEach((p: { id: string; name: string }, i: number) => {
    lines.push(`${i + 1}. ${p.name}`)
  })
  lines.push('')
  lines.push('0. \u{2B05}\u{FE0F} Back')

  await sendWhatsAppMessage(chatId, lines.join('\n'))
}

async function handleCancel(
  supabase: SupabaseClient,
  conversation: Conversation,
  chatId: string
): Promise<void> {
  await deleteConversation(supabase, conversation.id)
  await sendWhatsAppMessage(chatId, '\u{274C} Cancelled.')
}

async function handleProjectSelection(
  supabase: SupabaseClient,
  conversation: Conversation,
  chatId: string,
  userId: string,
  replyText: string
): Promise<void> {
  const num = parseInt(replyText.trim(), 10)

  // "0" = back
  if (num === 0) {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ state: 'awaiting_confirm', project_id: null, project_name: null })
      .eq('id', conversation.id)

    if (error) console.error('Failed to go back:', error.message)

    const confirmMsg = buildConfirmationMessage(
      conversation.extracted_title,
      conversation.priority,
      null
    )
    await sendWhatsAppMessage(chatId, confirmMsg)
    return
  }

  // Fetch projects again to map number to project
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('name', { ascending: true })

  if (error || !projects || projects.length === 0) {
    await sendWhatsAppMessage(chatId, '\u{26A0}\u{FE0F} Could not load projects. Try again.')
    return
  }

  if (isNaN(num) || num < 1 || num > projects.length) {
    // Invalid selection — resend project list
    const lines = ['\u{26A0}\u{FE0F} Invalid selection. Choose a number:', '']
    projects.forEach((p: { id: string; name: string }, i: number) => {
      lines.push(`${i + 1}. ${p.name}`)
    })
    lines.push('')
    lines.push('0. \u{2B05}\u{FE0F} Back')
    await sendWhatsAppMessage(chatId, lines.join('\n'))
    return
  }

  const selected = projects[num - 1]

  // Update conversation with selected project, go back to awaiting_confirm
  const { error: updateError } = await supabase
    .from('whatsapp_conversations')
    .update({
      state: 'awaiting_confirm',
      project_id: selected.id,
      project_name: selected.name,
    })
    .eq('id', conversation.id)

  if (updateError) {
    console.error('Failed to set project:', updateError.message)
    await sendWhatsAppMessage(chatId, '\u{26A0}\u{FE0F} Failed to set project. Try again.')
    return
  }

  const confirmMsg = buildConfirmationMessage(
    conversation.extracted_title,
    conversation.priority,
    selected.name
  )
  await sendWhatsAppMessage(chatId, confirmMsg)
}

async function handleReply(
  supabase: SupabaseClient,
  conversation: Conversation,
  chatId: string,
  userId: string,
  replyText: string
): Promise<void> {
  // ---- choosing_project state ----
  if (conversation.state === 'choosing_project') {
    await handleProjectSelection(supabase, conversation, chatId, userId, replyText)
    return
  }

  // ---- awaiting_confirm state ----
  const choice = replyText.trim()

  switch (choice) {
    case '1':
      await handleCreateTask(supabase, conversation, chatId)
      break
    case '2':
      await handleChangePriority(supabase, conversation, chatId, 'high')
      break
    case '3':
      await handleChangePriority(supabase, conversation, chatId, 'low')
      break
    case '4':
      await handleChooseProject(supabase, conversation, chatId, userId)
      break
    case '5':
    case 'cancel':
      await handleCancel(supabase, conversation, chatId)
      break
    default:
      // Unrecognized reply — resend current options
      const confirmMsg = buildConfirmationMessage(
        conversation.extracted_title,
        conversation.priority,
        conversation.project_name
      )
      await sendWhatsAppMessage(
        chatId,
        `\u{26A0}\u{FE0F} I didn't understand that. Please reply with a number:\n\n${confirmMsg}`
      )
      break
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ---- Auth ----
  const webhookSecret = Deno.env.get('WAHA_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('WAHA_WEBHOOK_SECRET not configured')
    return json({ error: 'Server misconfigured' }, 500)
  }

  const url = new URL(req.url)
  const providedSecret =
    req.headers.get('x-webhook-secret') || url.searchParams.get('secret')
  if (!providedSecret || providedSecret !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ---- Env validation ----
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const userId = Deno.env.get('FLOWSTATE_USER_ID')

  if (!supabaseUrl || !serviceRoleKey || !userId) {
    console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or FLOWSTATE_USER_ID')
    return json({ error: 'Server misconfigured' }, 500)
  }

  try {
    const body: WahaWebhookPayload = await req.json()

    // Only process message events
    if (body.event !== 'message' && body.event !== 'message.any') {
      return json({ ok: true, skipped: true, reason: `Event type '${body.event}' ignored` })
    }

    // Skip bot's own messages to avoid loops
    if (body.payload.fromMe) {
      return json({ ok: true, skipped: true, reason: 'Own message (fromMe)' })
    }

    const chatId = body.payload.from
    const messageId = body.payload.id
    const messageText = body.payload?.body || ''

    // Skip completely empty messages
    if (!messageText.trim()) {
      return json({ ok: true, skipped: true, reason: 'Empty message' })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Clean up stale conversations on every request
    await cleanupStaleConversations(supabase)

    // Check for duplicate message (dedup by waha_message_id)
    const { data: dupCheck } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('waha_message_id', messageId)
      .limit(1)

    if (dupCheck && dupCheck.length > 0) {
      return json({ ok: true, skipped: true, reason: 'Duplicate message ID' })
    }

    // Check for active conversation
    const conversation = await getActiveConversation(supabase, chatId, userId)

    if (conversation) {
      // This is a reply to an active conversation
      await handleReply(supabase, conversation, chatId, userId, messageText)
      return json({ ok: true, action: 'reply_handled', conversationId: conversation.id })
    } else {
      // New message — start a new conversation
      await handleNewMessage(supabase, chatId, userId, messageId, messageText)
      return json({ ok: true, action: 'new_conversation', chatId })
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return json(
      { error: 'Internal server error', message: (err as Error).message },
      500
    )
  }
})
