/**
 * Shared AI Router Factory (TASK-1350)
 *
 * Provides a single shared AIRouter instance across all AI composables
 * (useAIChat, useQuickSortAI, useAITaskAssist). The router is configured
 * from the user's settings (Groq API key, preferred provider).
 *
 * When the user changes their API key, call `resetSharedRouter()` to
 * dispose the old router and create a new one on next use.
 */

import { createAIRouter, type AIRouter } from './router'
import { useSettingsStore } from '@/stores/settings'

let sharedRouter: AIRouter | null = null
let initPromise: Promise<void> | null = null
let configuredApiKey: string | undefined = undefined

/**
 * Get or create the shared AI Router singleton.
 *
 * Reads groqApiKey from settings store and passes it to the router.
 * If the API key has changed since last initialization, the old router
 * is disposed and a new one is created.
 */
export async function getSharedRouter(): Promise<AIRouter> {
  const settingsStore = useSettingsStore()
  const currentApiKey = settingsStore.groqApiKey || undefined

  // If API key changed since last init, reset the router
  if (sharedRouter && currentApiKey !== configuredApiKey) {
    sharedRouter.dispose()
    sharedRouter = null
    initPromise = null
  }

  if (!sharedRouter) {
    configuredApiKey = currentApiKey
    sharedRouter = createAIRouter({
      providers: ['groq', 'ollama', 'openrouter'],
      preferLocal: false,
      debug: false,
      groqApiKey: currentApiKey,
    })
    initPromise = sharedRouter.initialize()
  }

  await initPromise
  return sharedRouter
}

/**
 * Force-reset the shared router.
 * Call this when the user changes their API key or provider settings.
 */
export function resetSharedRouter(): void {
  if (sharedRouter) {
    sharedRouter.dispose()
    sharedRouter = null
    initPromise = null
    configuredApiKey = undefined
  }
}
