import { supabase } from '@/services/auth/supabase'
import { fromSupabaseTask, type SupabaseTask } from '@/utils/supabaseMappers'
import type { Task } from '@/types/tasks'

export interface DoneForNowPreview {
  ok: true
  preview: true
  requestId: null
  previewVersion: string
  task: { id: string; title: string }
  currentOccurrence: {
    occurrenceKey: string
    dueDate: string
    statusBefore: 'todo'
    statusAfter: 'done'
  }
  recurrence: {
    nextDueDateBefore: string
    nextDueDateAfter: string
    cadencePreserved: boolean
    overrideApplied: boolean
  }
  willWrite: string[]
}

export interface DoneForNowReceipt {
  ok: true
  preview: false
  requestId: string
  previewVersion: string
  receipt: {
    requestId: string
    taskId: string
    completedOccurrenceId: string
    completedOccurrenceKey: string
    nextOccurrenceId: string
    nextOccurrenceKey: string
  }
  readBack: {
    taskId: string
    completedOccurrence: { id: string; status: 'done'; dueDate: string }
    nextOccurrence: { id: string; status: 'todo'; dueDate: string; recurrenceCount: number }
    nextDueDate: string
    recurrenceActive: true
  }
  state: {
    livingTask: SupabaseTask
    completionTask: SupabaseTask
  }
}

interface DoneForNowFailure {
  ok: false
  error: { code: string; message: string }
}

export class DoneForNowError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'DoneForNowError'
  }
}

async function invokeDoneForNow(params: {
  taskId: string
  preview: boolean
  requestId?: string
  previewVersion?: string
  nextDueDate?: string
}): Promise<DoneForNowPreview | DoneForNowReceipt> {
  const { data, error } = await supabase.rpc('done_for_now_task', {
    p_task_id: params.taskId,
    p_preview: params.preview,
    p_request_id: params.requestId ?? null,
    p_preview_version: params.previewVersion ?? null,
    p_next_due_date: params.nextDueDate ?? null,
  })

  if (error) throw new DoneForNowError(error.code || 'operation_failed', error.message)
  const result = data as DoneForNowPreview | DoneForNowReceipt | DoneForNowFailure | null
  if (!result) throw new DoneForNowError('empty_response', 'Done for now returned no result')
  if (!result.ok) throw new DoneForNowError(result.error.code, result.error.message)
  return result
}

export async function previewDoneForNow(taskId: string, nextDueDate?: string): Promise<DoneForNowPreview> {
  return invokeDoneForNow({ taskId, preview: true, nextDueDate }) as Promise<DoneForNowPreview>
}

export async function applyDoneForNow(
  taskId: string,
  options: { requestId: string; previewVersion: string; nextDueDate?: string },
): Promise<DoneForNowReceipt & { tasks: { living: Task; completion: Task } }> {
  const result = await invokeDoneForNow({ taskId, preview: false, ...options }) as DoneForNowReceipt
  return {
    ...result,
    tasks: {
      living: fromSupabaseTask(result.state.livingTask),
      completion: fromSupabaseTask(result.state.completionTask),
    },
  }
}
