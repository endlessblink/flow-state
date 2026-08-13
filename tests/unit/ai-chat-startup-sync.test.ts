import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('AI chat startup sync contract', () => {
  it('initializes AI chat sync during authenticated app startup, before the sidebar is opened', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/composables/app/useAppInitialization.ts'),
      'utf-8',
    )

    expect(src).toContain("import('@/stores/aiChat')")
    expect(src).toContain('aiChatStore.initialize()')
    expect(src).toContain('aiChatStore.syncConversationsWithSupabaseNow()')
    expect(src).toContain('[MAIN] Failed to initialize AI chat sync:')
  })

  it('clears authenticated read cache only after startup confirms guest mode', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/composables/app/useAppInitialization.ts'),
      'utf-8',
    )

    expect(src).not.toContain('preserving cache while auth recovers')
    expect(src).toContain('[AUTH] No restored session; clearing authenticated read cache from signed-out view')
    expect(src).toContain('await clearReadCache()')
    expect(src).toContain('taskStore.clearAll()')
    expect(src).toContain('projectStore.clearAll()')
    expect(src).toContain('laneStore.clearAll()')
    expect(src).toContain('canvasStore.clearAll()')
    expect(src).toContain('workspaceStore.clearAll()')
    expect(src).toContain('[AUTH] Confirmed guest mode; loading guest-local data')
    expect(src).toContain('await Promise.all([')
    expect(src).toContain('taskStore.loadFromDatabase()')
    expect(src).toContain('projectStore.loadProjectsFromDatabase()')
    expect(src).toContain('canvasStore.loadFromDatabase()')
  })

  it('does not leave the Electron renderer on an infinite loading screen when startup storage stalls', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/composables/app/useAppInitialization.ts'),
      'utf-8',
    )

    expect(src).toContain('STARTUP_READ_TIMEOUT_MS = 5000')
    expect(src).toContain('withStartupReadTimeout(')
    expect(src).toContain("'durable auth identity read'")
    expect(src).toContain("'durable auth session read'")
    expect(src).toContain("'cached task read'")
    expect(src).toContain("'persisted filter read'")
    expect(src).toContain("'cache statistics read'")
    expect(src).toContain('continuing with local fallback')
    expect(src).toContain('STARTUP_READY_WATCHDOG_MS = 8_000')
    expect(src).toContain("'[STARTUP] Local startup boundary stalled; rendering recovery shell'")
  })

  it('keeps Electron asset URLs relative for file-based packaged startup', () => {
    const viteConfig = readFileSync(
      resolve(process.cwd(), 'vite.config.ts'),
      'utf-8',
    )

    expect(viteConfig).toContain("base: isElectron ? './' : '/'")
    expect(viteConfig).toContain("process.env.ELECTRON_BUILD === 'true'")
  })
})
