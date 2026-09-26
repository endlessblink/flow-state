/**
 * BUG-2100: Realtime echoes of our own queued writes are skipped while the
 * entity still has a pending write, and each skip used to schedule its own
 * full `reloadCoreData()`. Those reloads hold the queue-processor barrier, so a
 * burst of N echoes serialized N full reloads and starved the upload queue
 * (and each reload re-saved canvas groups, growing the queue further).
 *
 * This coalesces any number of requests into at most one running reload plus
 * one follow-up, and gives the queue a turn before every reload.
 */
export interface CoalescedReloaderOptions {
  reload: () => Promise<void>
  /** Let queued local writes upload before re-reading the server. */
  beforeReload?: () => Promise<void>
  debounceMs?: number
  onError?: (error: unknown) => void
  wait?: (ms: number) => Promise<void>
}

export function createCoalescedReloader(options: CoalescedReloaderOptions) {
  const {
    reload,
    beforeReload,
    debounceMs = 1500,
    onError,
    wait = ms => new Promise<void>(resolve => setTimeout(resolve, ms)),
  } = options
  let running: Promise<void> | null = null
  let requestedAgain = false

  const request = (): Promise<void> => {
    if (running) {
      requestedAgain = true
      return running
    }
    running = (async () => {
      try {
        do {
          requestedAgain = false
          await wait(debounceMs)
          if (beforeReload) {
            try {
              await beforeReload()
            } catch (error) {
              onError?.(error)
            }
          }
          await reload()
        } while (requestedAgain)
      } catch (error) {
        onError?.(error)
      } finally {
        running = null
      }
    })()
    return running
  }

  return { request, isRunning: () => running !== null }
}
