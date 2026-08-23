interface UpdateRegistration {
  update: () => Promise<unknown>
  waiting: { postMessage: (message: unknown) => void } | null
}

interface VisibilityTarget {
  readonly hidden: boolean
  addEventListener: (event: 'visibilitychange', listener: () => void) => void
  removeEventListener: (event: 'visibilitychange', listener: () => void) => void
}

export function startServiceWorkerUpdateRecovery(input: {
  ready: Promise<UpdateRegistration>
  visibility: VisibilityTarget
}): () => void {
  let stopped = false
  let checkInFlight: Promise<void> | null = null

  const checkForUpdate = async () => {
    if (stopped || input.visibility.hidden) return
    if (checkInFlight) return checkInFlight

    checkInFlight = (async () => {
      try {
        const registration = await input.ready
        await registration.update()
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      } catch (error) {
        // A transient network/service-worker failure must not become an
        // unhandled rejection or disable the next foreground check.
        console.warn('[PWA] Service-worker update check failed:', error)
      } finally {
        checkInFlight = null
      }
    })()

    return checkInFlight
  }
  const onVisibilityChange = () => {
    void checkForUpdate()
  }

  input.visibility.addEventListener('visibilitychange', onVisibilityChange)
  void checkForUpdate()

  return () => {
    stopped = true
    input.visibility.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
