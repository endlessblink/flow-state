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

  it('reloads guest localStorage data after signed-out startup clears authenticated read cache', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/composables/app/useAppInitialization.ts'),
      'utf-8',
    )

    expect(src).toContain('[AUTH] No restored session; clearing authenticated read cache from signed-out view')
    expect(src).toContain('[AUTH] Reloading guest-local data after signed-out cache cleanup')
    expect(src).toContain('await Promise.all([')
    expect(src).toContain('taskStore.loadFromDatabase()')
    expect(src).toContain('projectStore.loadProjectsFromDatabase()')
    expect(src).toContain('canvasStore.loadFromDatabase()')
  })
})
