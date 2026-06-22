/**
 * TASK-1881: Electron runtime detection must not hinge solely on the preload bridge being
 * present at the instant supabase.ts is first evaluated. A momentary absence used to flip the
 * client to the web branch for the whole session (relative URL resolved against file:// origin
 * → broken Supabase client → "signed out" while local cache still rendered).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: {}, channel: () => ({}), removeChannel: () => {} }),
}))

describe('detectElectronRuntime (TASK-1881)', () => {
  const realUA = navigator.userAgent

  afterEach(() => {
    delete (window as any).electronAPI
    delete (window as any).process
    Object.defineProperty(navigator, 'userAgent', { value: realUA, configurable: true })
  })

  it('detects via the preload bridge', async () => {
    const { detectElectronRuntime } = await import('@/services/auth/supabase')
    ;(window as any).electronAPI = { isElectron: true }
    expect(detectElectronRuntime()).toBe(true)
  })

  it('detects via the Electron user-agent when the bridge is momentarily absent', async () => {
    const { detectElectronRuntime } = await import('@/services/auth/supabase')
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 ... FlowState/1.4.203 Chrome/120 Electron/28.0.0 Safari/537.36',
      configurable: true,
    })
    expect(detectElectronRuntime()).toBe(true)
  })

  it('detects via window.process.type === renderer', async () => {
    const { detectElectronRuntime } = await import('@/services/auth/supabase')
    ;(window as any).process = { type: 'renderer' }
    expect(detectElectronRuntime()).toBe(true)
  })

  it('returns false for a plain web browser', async () => {
    const { detectElectronRuntime } = await import('@/services/auth/supabase')
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36',
      configurable: true,
    })
    expect(detectElectronRuntime()).toBe(false)
  })
})
