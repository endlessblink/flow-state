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

  const checkForUpdate = async () => {
    if (stopped || input.visibility.hidden) return
    const registration = await input.ready
    await registration.update()
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
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
