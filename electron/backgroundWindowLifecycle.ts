export interface BackgroundWindow {
  isDestroyed(): boolean
  isMinimized(): boolean
  getBounds(): { width: number; height: number }
  setBounds(bounds: { width: number; height: number }): void
  restore(): void
  show(): void
  focus(): void
  hide(): void
}

export interface WindowCloseEvent {
  preventDefault(): void
}

interface BackgroundWindowLifecycleOptions {
  getWindow(): BackgroundWindow | null
  createWindow(): BackgroundWindow
  isBackgroundEnabled(): boolean
}

export function isBackgroundLaunch(argv: readonly string[]): boolean {
  return argv.includes('--background')
}

export function createBackgroundWindowLifecycle(options: BackgroundWindowLifecycleOptions) {
  let quitting = false

  const restoreUsableBounds = (window: BackgroundWindow): void => {
    const bounds = window.getBounds()
    if (bounds.width >= 100 && bounds.height >= 100) return
    window.setBounds({ width: 1400, height: 900 })
  }

  const showOrCreate = (): BackgroundWindow => {
    let window = options.getWindow()
    if (!window || window.isDestroyed()) window = options.createWindow()
    if (window.isMinimized()) window.restore()
    restoreUsableBounds(window)
    window.show()
    window.focus()
    return window
  }

  return {
    beginQuit(): void {
      quitting = true
    },

    handleReadyToShow(window: BackgroundWindow, argv: readonly string[]): void {
      if (!isBackgroundLaunch(argv)) window.show()
    },

    handleClose(event: WindowCloseEvent, window: BackgroundWindow): boolean {
      if (quitting || !options.isBackgroundEnabled()) return false
      event.preventDefault()
      window.hide()
      return true
    },

    showOrCreate,
  }
}
