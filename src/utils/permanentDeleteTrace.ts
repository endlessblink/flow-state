type PermanentDeleteTrace = {
  traceId: string
  taskId: string
  origin: string
  startedAt: number
  deleteTimer?: ReturnType<typeof setTimeout>
}

type TraceDetails = Record<string, unknown>

declare global {
  interface Window {
    __FlowStatePermanentDeleteTraces?: Record<string, PermanentDeleteTrace>
  }
}

function traceStore(): Record<string, PermanentDeleteTrace> {
  if (typeof window === 'undefined') return {}
  window.__FlowStatePermanentDeleteTraces ||= {}
  return window.__FlowStatePermanentDeleteTraces
}

function createTrace(taskId: string, origin: string): PermanentDeleteTrace {
  return {
    traceId: `pd-${taskId.slice(0, 8)}-${Date.now().toString(36)}`,
    taskId,
    origin,
    startedAt: Date.now(),
  }
}

export function beginPermanentDeleteTrace(taskId: string, origin: string, details: TraceDetails = {}): string {
  const store = traceStore()
  const trace = store[taskId] ?? createTrace(taskId, origin)
  if (trace.deleteTimer) {
    clearTimeout(trace.deleteTimer)
    delete trace.deleteTimer
  }
  store[taskId] = trace
  logPermanentDeleteTrace(taskId, 'begin', { origin, ...details })
  return trace.traceId
}

export function logPermanentDeleteTrace(taskId: string, stage: string, details: TraceDetails = {}): void {
  const store = traceStore()
  const trace = store[taskId] ?? createTrace(taskId, 'unknown')
  store[taskId] = trace

  // TASK-1904: dev-only. This tracer shipped at console.warn (~12 lines per
  // permanent delete) and buried real warnings in production consoles.
  if (!import.meta.env.DEV) return

  console.warn('[PERMA-DELETE-TRACE]', {
    traceId: trace.traceId,
    taskId,
    shortId: taskId.slice(0, 8),
    origin: trace.origin,
    stage,
    elapsedMs: Date.now() - trace.startedAt,
    ...details,
  })
}

export function hasPermanentDeleteTrace(taskId: string): boolean {
  return Boolean(traceStore()[taskId])
}

export function logPermanentDeleteTraceIfActive(taskId: string, stage: string, details: TraceDetails = {}): void {
  if (!hasPermanentDeleteTrace(taskId)) return
  logPermanentDeleteTrace(taskId, stage, details)
}

export function endPermanentDeleteTrace(taskId: string, stage: string, details: TraceDetails = {}): void {
  logPermanentDeleteTrace(taskId, stage, details)
  const store = traceStore()
  const trace = store[taskId]
  if (!trace || typeof window === 'undefined') return
  if (trace.deleteTimer) clearTimeout(trace.deleteTimer)
  trace.deleteTimer = setTimeout(() => {
    delete store[taskId]
  }, 120_000)
}
