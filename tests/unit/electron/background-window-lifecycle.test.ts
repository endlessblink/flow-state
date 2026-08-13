import { describe, expect, it, vi } from 'vitest'
import {
  createBackgroundWindowLifecycle,
  isBackgroundLaunch,
  type BackgroundWindow,
} from '../../../electron/backgroundWindowLifecycle'

function createWindow(overrides: Partial<BackgroundWindow> = {}): BackgroundWindow {
  return {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    getBounds: vi.fn(() => ({ width: 1400, height: 900 })),
    setBounds: vi.fn(),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    ...overrides,
  }
}

describe('Electron background window lifecycle', () => {
  it('recognizes only an explicit background launch', () => {
    expect(isBackgroundLaunch(['flow-state', '--background'])).toBe(true)
    expect(isBackgroundLaunch(['flow-state'])).toBe(false)
    expect(isBackgroundLaunch(['flow-state', '--background=false'])).toBe(false)
  })

  it('keeps a background-first window alive without showing it when ready', () => {
    const window = createWindow()
    const lifecycle = createBackgroundWindowLifecycle({
      getWindow: () => window,
      createWindow: vi.fn(() => window),
      isBackgroundEnabled: () => true,
    })

    lifecycle.handleReadyToShow(window, ['flow-state', '--background'])

    expect(window.show).not.toHaveBeenCalled()
    expect(window.hide).not.toHaveBeenCalled()
    expect(window.isDestroyed()).toBe(false)
  })

  it('shows a normal first-launch window when ready', () => {
    const window = createWindow()
    const setBounds = window.setBounds as ReturnType<typeof vi.fn>
    const lifecycle = createBackgroundWindowLifecycle({
      getWindow: () => window,
      createWindow: vi.fn(() => window),
      isBackgroundEnabled: () => true,
    })

    lifecycle.handleReadyToShow(window, ['flow-state'])

    expect(window.show).toHaveBeenCalledOnce()
    expect(setBounds).toHaveBeenCalledWith({ width: 1400, height: 900 })
  })

  it('repairs hidden supervisor geometry before showing a normal launch', () => {
    const setBounds = vi.fn()
    const window = createWindow({
      getBounds: vi.fn(() => ({ width: 10, height: 10 })),
      setBounds,
    })
    const lifecycle = createBackgroundWindowLifecycle({
      getWindow: () => window,
      createWindow: vi.fn(() => window),
      isBackgroundEnabled: () => false,
    })

    lifecycle.handleReadyToShow(window, ['flow-state'])

    expect(setBounds).toHaveBeenCalledWith({ width: 1400, height: 900 })
    expect(window.show).toHaveBeenCalledOnce()
  })

  it('hides instead of closing while background mode is enabled', () => {
    const window = createWindow()
    const preventDefault = vi.fn()
    const lifecycle = createBackgroundWindowLifecycle({
      getWindow: () => window,
      createWindow: vi.fn(() => window),
      isBackgroundEnabled: () => true,
    })

    const hidden = lifecycle.handleClose({ preventDefault }, window)

    expect(hidden).toBe(true)
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(window.hide).toHaveBeenCalledOnce()
  })

  it('allows explicit quit to close the window', () => {
    const window = createWindow()
    const preventDefault = vi.fn()
    const lifecycle = createBackgroundWindowLifecycle({
      getWindow: () => window,
      createWindow: vi.fn(() => window),
      isBackgroundEnabled: () => true,
    })

    lifecycle.beginQuit()
    const hidden = lifecycle.handleClose({ preventDefault }, window)

    expect(hidden).toBe(false)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(window.hide).not.toHaveBeenCalled()
  })

  it('restores, shows, and focuses the existing window for a second launch', () => {
    const window = createWindow({ isMinimized: vi.fn(() => true) })
    const create = vi.fn(() => window)
    const lifecycle = createBackgroundWindowLifecycle({
      getWindow: () => window,
      createWindow: create,
      isBackgroundEnabled: () => true,
    })

    expect(lifecycle.showOrCreate()).toBe(window)

    expect(window.restore).toHaveBeenCalledOnce()
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
    expect(create).not.toHaveBeenCalled()
  })

  it('repairs a collapsed background window before showing it', () => {
    const setBounds = vi.fn()
    const window = createWindow({
      getBounds: vi.fn(() => ({ width: 10, height: 28 })),
      setBounds,
    })
    const lifecycle = createBackgroundWindowLifecycle({
      getWindow: () => window,
      createWindow: vi.fn(() => window),
      isBackgroundEnabled: () => true,
    })

    lifecycle.showOrCreate()

    expect(setBounds).toHaveBeenCalledWith({ width: 1400, height: 900 })
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
  })

  it('creates one visible window when activate finds no live window', () => {
    let current: BackgroundWindow | null = null
    const created = createWindow()
    const create = vi.fn(() => {
      current = created
      return created
    })
    const lifecycle = createBackgroundWindowLifecycle({
      getWindow: () => current,
      createWindow: create,
      isBackgroundEnabled: () => true,
    })

    expect(lifecycle.showOrCreate()).toBe(created)
    expect(lifecycle.showOrCreate()).toBe(created)

    expect(create).toHaveBeenCalledOnce()
    expect(created.show).toHaveBeenCalledTimes(2)
    expect(created.focus).toHaveBeenCalledTimes(2)
  })

  it('replaces a destroyed window once across repeated show requests', () => {
    const destroyed = createWindow({ isDestroyed: vi.fn(() => true) })
    const replacement = createWindow()
    let current: BackgroundWindow | null = destroyed
    const create = vi.fn(() => {
      current = replacement
      return replacement
    })
    const lifecycle = createBackgroundWindowLifecycle({
      getWindow: () => current,
      createWindow: create,
      isBackgroundEnabled: () => true,
    })

    lifecycle.showOrCreate()
    lifecycle.showOrCreate()

    expect(create).toHaveBeenCalledOnce()
    expect(replacement.show).toHaveBeenCalledTimes(2)
    expect(replacement.focus).toHaveBeenCalledTimes(2)
  })
})
