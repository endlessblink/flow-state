export interface QueueProcessorLockContext {
  hasCrossWindowExclusion: boolean
}

export type QueueProcessorLockResult =
  | { status: 'processed' }
  | { status: 'contended' }
  | { status: 'unavailable'; error: unknown }

const QUEUE_PROCESSOR_LOCK_NAME = 'flowstate-sync-queue'
let fallbackLockTail: Promise<void> = Promise.resolve()

async function runWithFallbackLock<T>(work: () => Promise<T>): Promise<T> {
  const previous = fallbackLockTail
  let release!: () => void
  fallbackLockTail = new Promise<void>(resolve => { release = resolve })
  await previous
  try {
    return await work()
  } finally {
    release()
  }
}

export async function runWithExclusiveQueueProcessorLock(
  work: (context: QueueProcessorLockContext) => Promise<void>,
): Promise<QueueProcessorLockResult> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) {
    await runWithFallbackLock(() => work({ hasCrossWindowExclusion: false }))
    return { status: 'processed' }
  }

  let workStarted = false
  try {
    return await locks.request(
      QUEUE_PROCESSOR_LOCK_NAME,
      { mode: 'exclusive', ifAvailable: true },
      async lock => {
        if (!lock) return { status: 'contended' } as const
        workStarted = true
        await work({ hasCrossWindowExclusion: true })
        return { status: 'processed' } as const
      },
    )
  } catch (error) {
    if (workStarted) throw error
    return { status: 'unavailable', error }
  }
}

export async function runWithQueueProcessorBarrier<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks) return runWithFallbackLock(work)
  return locks.request(
    QUEUE_PROCESSOR_LOCK_NAME,
    { mode: 'exclusive' },
    async () => work(),
  )
}
