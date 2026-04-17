import express from 'express'
import type { Request, Response } from 'express'
import type { WAHAMessage } from './types.js'
import { parseMessage } from './groqParser.js'
import { createTask } from './supabaseClient.js'
import { sendMessage } from './wahaClient.js'

const app = express()
app.use(express.json())

// --- Config ---

const PORT = parseInt(process.env.BOT_PORT || '3001', 10)
const ALLOWED_CHAT_IDS = (process.env.ALLOWED_CHAT_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || ''

// --- Startup validation ---

function validateConfig(): void {
  const required = [
    ['GROQ_API_KEY', process.env.GROQ_API_KEY],
    ['SUPABASE_URL', process.env.SUPABASE_URL],
    ['SUPABASE_SERVICE_KEY', process.env.SUPABASE_SERVICE_KEY],
    ['DEFAULT_USER_ID', DEFAULT_USER_ID],
  ] as const

  const missing = required.filter(([, value]) => !value).map(([name]) => name)

  if (missing.length > 0) {
    console.warn(`[BOTTY] Missing env vars: ${missing.join(', ')}`)
    console.warn('[BOTTY] Botty will start but some features may not work')
  }

  if (ALLOWED_CHAT_IDS.length === 0) {
    console.warn('[BOTTY] ALLOWED_CHAT_IDS is empty — send a WhatsApp message and check logs for your chat ID')
  }
}

// --- Routes ---

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    allowedChats: ALLOWED_CHAT_IDS.length,
  })
})

app.post('/webhook/waha', async (req: Request, res: Response) => {
  const message = req.body as WAHAMessage

  // Acknowledge immediately — WAHA retries on timeout
  res.sendStatus(200)

  // Only process incoming messages
  if (message.event !== 'message') return
  if (!message.payload?.body) return
  if (message.payload.fromMe) return

  const chatId = message.payload.from
  const body = message.payload.body.trim()

  // Security: only process allowed chat IDs
  if (!ALLOWED_CHAT_IDS.includes(chatId)) {
    console.log(`[BOTTY] Rejected message from unlisted chat: ${chatId}`)
    return
  }

  // Skip empty or very short messages
  if (body.length < 2) return

  console.log(`[BOTTY] Processing message from ${chatId}: "${body.substring(0, 80)}${body.length > 80 ? '...' : ''}"`)

  try {
    // Parse with Groq AI
    const task = await parseMessage(body)

    if (!task) {
      await sendMessage(chatId, 'Got your message, but I couldn\'t extract a task from it.')
      return
    }

    // Create in FlowState's Supabase
    const result = await createTask(task, DEFAULT_USER_ID)

    if (!result) {
      await sendMessage(chatId, 'Parsed a task but failed to save it. Check bot logs.')
      return
    }

    // Build confirmation message
    const parts = [`Task created: "${task.title}"`, `Priority: ${task.priority}`]
    if (task.dueDate) parts.push(`Due: ${task.dueDate}`)
    if (task.duration) parts.push(`Duration: ${task.duration}min`)

    await sendMessage(chatId, parts.join('\n'))
    console.log(`[BOTTY] Task created: "${task.title}" (${task.priority}) for ${chatId}`)
  } catch (error) {
    console.error('[BOTTY] Webhook processing error:', error)
    await sendMessage(chatId, 'Something went wrong processing your message.').catch(() => {})
  }
})

// --- Start ---

validateConfig()

app.listen(PORT, () => {
  console.log(`[BOTTY] Botty listening on port ${PORT}`)
  console.log(`[BOTTY] Webhook endpoint: POST http://localhost:${PORT}/webhook/waha`)
  console.log(`[BOTTY] Health check:     GET  http://localhost:${PORT}/health`)
  console.log(`[BOTTY] Allowed chats: ${ALLOWED_CHAT_IDS.length > 0 ? ALLOWED_CHAT_IDS.join(', ') : '(none)'}`)
})
