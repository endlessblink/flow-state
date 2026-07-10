/**
 * BUG-1936: board drag diagnostics.
 *
 * The "drag lags" / "cards keep moving after drop" symptoms only reproduce in the packaged
 * Electron app, so this records what happens during a real drag and flushes it to disk
 * (<userData>/drag-diagnostics.log) where it can be read back without a screen recording.
 *
 * ON by default in this diagnostic build — no DevTools/localStorage step needed. Just drag on the
 * board and the log appears at <userData>/drag-diagnostics.log. Disable with
 * localStorage.setItem('flowstate:drag-diag', '0').
 *
 * What it captures per drag:
 *  - frame timings during the drag (rAF deltas) → the actual "lag": long frames = jank
 *  - how many columns re-render on drop (the global kanban:drag-end resync cascade)
 *  - watch-driven resets and empty-flash relayouts after the drop
 *  - wall-clock from drop to the last settle event
 */

// Build-time constant injected by vite (see vite.config.ts `define`).
declare const __APP_VERSION__: string

type DiagEvent = { t: number; ev: string; d?: Record<string, unknown> }

interface ElectronDiag {
  appendDragDiag?: (line: string) => Promise<string>
}

const enabled = (): boolean => {
  try {
    // ON by default; only an explicit '0' disables it.
    return localStorage.getItem('flowstate:drag-diag') !== '0'
  } catch {
    return true
  }
}

const electron = (): ElectronDiag | null => {
  const api = (window as unknown as { electronAPI?: ElectronDiag }).electronAPI
  return api && typeof api.appendDragDiag === 'function' ? api : null
}

class DragDiagnostics {
  private on = false
  private t0 = 0
  private events: DiagEvent[] = []
  private frames: number[] = []
  private rafId: number | null = null
  private lastFrame = 0
  private dropAt = 0
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  // Cross-instance counters (many KanbanColumn components share one drag).
  resyncCount = 0
  watchResetCount = 0
  emptyFlashCount = 0

  private markerWritten = false

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : 0
  }

  private version(): string {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'
  }

  /** Write one line when the board mounts, so the log file exists and proves the build is live. */
  async sessionMarker(where: string): Promise<void> {
    if (this.markerWritten || !enabled()) return
    this.markerWritten = true
    const line = JSON.stringify({ ts: new Date().toISOString(), version: this.version(), ev: 'board-loaded', where })
    const api = electron()
    if (api?.appendDragDiag) {
      try { await api.appendDragDiag(line) } catch { /* ignore */ }
    } else {
      console.info('[drag-diag] (browser, no file)', line)
    }
  }

  /** Called from onDragStart. Begins frame sampling. */
  start(meta: Record<string, unknown>): void {
    if (!enabled()) return
    this.on = true
    this.t0 = this.now()
    this.events = []
    this.frames = []
    this.resyncCount = 0
    this.watchResetCount = 0
    this.emptyFlashCount = 0
    this.dropAt = 0
    this.mark('dragstart', meta)
    this.lastFrame = this.t0
    const loop = () => {
      const n = this.now()
      this.frames.push(n - this.lastFrame)
      this.lastFrame = n
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  mark(ev: string, d?: Record<string, unknown>): void {
    if (!this.on) return
    this.events.push({ t: Math.round((this.now() - this.t0) * 10) / 10, ev, d })
  }

  /** Called from onDragEnd/drop. Keeps sampling ~1.2s to catch post-drop movement, then flushes. */
  drop(meta: Record<string, unknown>): void {
    if (!this.on) return
    this.dropAt = this.now()
    this.mark('drop', meta)
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flush(), 1200)
  }

  private summarizeFrames() {
    if (!this.frames.length) return { count: 0 }
    const sorted = [...this.frames].sort((a, b) => a - b)
    const long = this.frames.filter(f => f > 32).length // <30fps frames
    const veryLong = this.frames.filter(f => f > 100).length
    return {
      count: this.frames.length,
      p50: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
      p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
      max: Math.round(sorted[sorted.length - 1]),
      jankFrames_gt32ms: long,
      stalls_gt100ms: veryLong,
    }
  }

  private async flush(): Promise<void> {
    if (!this.on) return
    this.on = false
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null

    const lastEventT = this.events.length ? this.events[this.events.length - 1].t : 0
    const dropT = this.dropAt ? Math.round((this.dropAt - this.t0) * 10) / 10 : null
    const record = {
      ts: new Date().toISOString(),
      version: this.version(),
      dropAtMs: dropT,
      settleAfterDropMs: dropT !== null ? Math.round(lastEventT - dropT) : null,
      cascade: {
        columnsResynced: this.resyncCount,
        watchResets: this.watchResetCount,
        emptyFlashRelayouts: this.emptyFlashCount,
      },
      frames: this.summarizeFrames(),
      events: this.events,
    }

    const line = JSON.stringify(record)
    const api = electron()
    if (api?.appendDragDiag) {
      try {
        await api.appendDragDiag(line)
      } catch {
        console.warn('[drag-diag] append failed', line)
      }
    } else {
      // Non-Electron (browser dev): fall back to console.
      console.info('[drag-diag]', record)
    }
  }
}

export const dragDiag = new DragDiagnostics()
