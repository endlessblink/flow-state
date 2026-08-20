type RendererHeartbeatApi = {
  isElectron?: boolean
  rendererHeartbeat?: (heartbeat: Record<string, unknown>) => Promise<unknown>
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null

function electronApi(): RendererHeartbeatApi | null {
  const api = (window as unknown as { electronAPI?: RendererHeartbeatApi }).electronAPI
  return api?.isElectron && typeof api.rendererHeartbeat === 'function' ? api : null
}

function heartbeat(): Record<string, unknown> {
  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
  }).memory
  return {
    route: `${window.location.pathname}${window.location.search}`,
    visibility: document.visibilityState,
    readyState: document.readyState,
    performanceNow: performance.now(),
    memory,
  }
}

export function startElectronRuntimeDiagnostics(): () => void {
  const api = electronApi()
  if (!api || heartbeatTimer) return () => {}

  const report = () => { void api.rendererHeartbeat?.(heartbeat()).catch(() => {}) }
  report()
  heartbeatTimer = setInterval(report, 5_000)

  const reportError = (event: ErrorEvent) => {
    void api.rendererHeartbeat?.({
      ...heartbeat(),
      lastError: { message: event.message, source: event.filename, line: event.lineno, column: event.colno },
    }).catch(() => {})
  }
  const reportRejection = (event: PromiseRejectionEvent) => {
    void api.rendererHeartbeat?.({ ...heartbeat(), lastUnhandledRejection: String(event.reason) }).catch(() => {})
  }
  window.addEventListener('error', reportError)
  window.addEventListener('unhandledrejection', reportRejection)

  return () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
    window.removeEventListener('error', reportError)
    window.removeEventListener('unhandledrejection', reportRejection)
  }
}
