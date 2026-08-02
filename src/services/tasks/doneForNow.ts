export interface DoneForNowInput {
  taskId: string
  preview: boolean
  workspaceId?: string | null
  nextDueDate?: string | null
  requestId?: string | null
  previewVersion?: string | null
  requestHash?: string | null
}

export interface DoneForNowResult {
  ok: true
  preview: boolean
  previewVersion?: string
  requestHash?: string
  requestId?: string
  receipt?: {
    operationId?: string
    requestHash?: string
    status?: string
    replayed?: boolean
    [key: string]: unknown
  }
  taskId?: string
  currentOccurrence?: {
    dueDate: string
    statusBefore?: string
    statusAfter?: string
  }
  completedOccurrence?: {
    id: string
    status: 'done'
    dueDate: string
    completedAt: string
  }
  nextOccurrence?: {
    id: string
    taskId: string
    status: 'todo'
    dueDate: string
    scheduledTime?: string
    duration?: number
  } | null
  recurrence?: {
    nextDueDateAfter?: string | null
    cadencePreserved?: boolean
  }
}

interface DoneForNowClient {
  rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: unknown
  }>
}

export class DoneForNowError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DoneForNowError'
    this.code = code
  }
}

export function isDoneForNowAlreadyCompletedError(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : ''
  const message = error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error)
  return code === 'occurrence_already_completed'
    || message.includes('current recurring occurrence is already completed')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function runDoneForNow(client: DoneForNowClient, input: DoneForNowInput): Promise<DoneForNowResult> {
  const { data, error } = await client.rpc('flowstate_done_for_now', {
    p_next_due_date: input.nextDueDate || null,
    p_preview: input.preview,
    p_preview_version: input.previewVersion || null,
    p_request_id: input.requestId || null,
    p_request_hash: input.requestHash || null,
    p_task_id: input.taskId,
    p_workspace_id: input.workspaceId || null,
  })

  if (error || !isRecord(data)) {
    if (import.meta.env.DEV) {
      console.error('[DONE-FOR-NOW] Canonical transaction failed', error)
    }
    throw new DoneForNowError('recurrence_transaction_failed', 'Done for now could not be completed')
  }

  if (data.ok !== true) {
    const domainError = isRecord(data.error) ? data.error : {}
    throw new DoneForNowError(
      typeof domainError.code === 'string' ? domainError.code : 'recurrence_transaction_failed',
      typeof domainError.message === 'string' ? domainError.message : 'Done for now could not be completed',
    )
  }

  return data as unknown as DoneForNowResult
}
