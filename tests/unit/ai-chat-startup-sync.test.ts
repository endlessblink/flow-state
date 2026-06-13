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

  it('preserves authenticated read cache when startup auth restore misses transiently', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/composables/app/useAppInitialization.ts'),
      'utf-8',
    )

    expect(src).toContain('[AUTH] No restored session, but cached authenticated data exists; preserving cache while auth recovers')
    expect(src).not.toContain('[AUTH] No restored session; clearing authenticated read cache from signed-out view')
    expect(src).not.toContain('await clearReadCache()')
    expect(src).toContain('[AUTH] No restored session and no authenticated cache; loading guest-local data')
    expect(src).toContain('await Promise.all([')
    expect(src).toContain('taskStore.loadFromDatabase()')
    expect(src).toContain('projectStore.loadProjectsFromDatabase()')
    expect(src).toContain('canvasStore.loadFromDatabase()')
  })
})
