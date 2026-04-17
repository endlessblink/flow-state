import { randomUUID } from 'node:crypto'
import type { ParsedTask, SupabaseTaskInsert } from './types.js'

/**
 * Creates a task in FlowState's Supabase database via REST API.
 * Uses the service role key for direct DB access (bypasses RLS).
 *
 * Maps to FlowState's SupabaseTask schema with snake_case columns.
 * Status uses 'planned' (DB constraint) — FlowState's app maps this to 'todo' on read.
 */
export async function createTask(
  task: ParsedTask,
  userId: string
): Promise<{ id: string } | null> {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('[SUPABASE] SUPABASE_URL or SUPABASE_SERVICE_KEY is not set')
    return null
  }

  const now = new Date().toISOString()
  const taskId = randomUUID()

  const dbTask: SupabaseTaskInsert = {
    id: taskId,
    user_id: userId,
    title: task.title,
    description: task.notes ? `${task.notes}\n\n---\nCreated via WhatsApp` : 'Created via WhatsApp',
    status: 'planned', // DB constraint: 'planned' | 'done'
    priority: task.priority,
    due_date: task.dueDate || null,
    estimated_duration: task.duration || null,
    is_in_inbox: true, // New tasks go to inbox for triage
    is_deleted: false,
    progress: 0,
    completed_pomodoros: 0,
    order: 0,
    subtasks: [],
    tags: [],
    instances: [],
    recurring_instances: [],
    created_at: now,
    updated_at: now,
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/tasks`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(dbTask),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SUPABASE] Insert error ${response.status}: ${errorText}`)
      return null
    }

    const responseData = (await response.json()) as unknown

    // Validate response is an array with at least one element
    if (!Array.isArray(responseData) || responseData.length === 0) {
      console.error('[SUPABASE] Unexpected response format (empty array or not an array)')
      return null
    }

    const created = responseData[0]
    if (!created || typeof created !== 'object' || !('id' in created)) {
      console.error('[SUPABASE] Response missing id field')
      return null
    }

    const createdTask = created as { id: string }
    console.log(`[SUPABASE] Task created: ${createdTask.id} — "${task.title}"`)
    return { id: createdTask.id }
  } catch (error) {
    console.error('[SUPABASE] Request error:', error instanceof Error ? error.message : error)
    return null
  }
}
