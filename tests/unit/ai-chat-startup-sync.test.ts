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
})
