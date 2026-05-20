export function isUndoDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return localStorage.getItem('__UNDO_DEBUG') === 'true' ||
      Boolean((window as unknown as { __UNDO_DEBUG__?: boolean }).__UNDO_DEBUG__)
  } catch {
    return false
  }
}

export function undoDebugMark(label: string): void {
  if (!isUndoDebugEnabled() || typeof performance === 'undefined') return
  performance.mark(`undo:${label}`)
}

export function undoDebugMeasure(name: string, start: string, end: string): number | undefined {
  if (!isUndoDebugEnabled() || typeof performance === 'undefined') return undefined

  try {
    const measure = performance.measure(`undo:${name}`, `undo:${start}`, `undo:${end}`)
    return measure.duration
  } catch {
    return undefined
  }
}

export function undoDebugLog(label: string, payload?: unknown): void {
  if (!isUndoDebugEnabled()) return

  if (payload === undefined) {
    console.log(`[UNDO-DEBUG] ${label}`)
  } else {
    console.log(`[UNDO-DEBUG] ${label}`, payload)
  }
}

export function describeUndoElement(element: Element | null | undefined): string | null {
  if (!element) return null
  const html = (element as HTMLElement).outerHTML
  return html ? html.slice(0, 300) : element.nodeName
}
