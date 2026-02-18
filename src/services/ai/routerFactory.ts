/**
 * Shared AI Router Factory (TASK-1350)
 *
 * Provides a single shared AIRouter instance across all AI composables
 * (useAIChat, useQuickSortAI, useAITaskAssist). The router is configured
 * from the user's settings (Groq API key, preferred provider).
 *
 * Phase 2: Returns a ContextAwareRouter that auto-injects user context
 * into every AI call's system message. Composables no longer need to
 * call getAIUserContext() manually — just pass `contextFeature` in options.
 *
 * When the user changes their API key, call `resetSharedRouter()` to
 * dispose the old router and create a new one on next use.
 */

import { createAIRouter, type AIRouter, type RouterOptions } from './router'
import type { ChatMessage } from './types'
import { useSettingsStore } from '@/stores/settings'
import { getAIUserContext } from './userContext'

let sharedRouter: AIRouter | null = null
let initPromise: Promise<void> | null = null
let configuredApiKey: string | undefined = undefined

// ── Context Cache (30s TTL) ──
let cachedContext: string | null = null
let cachedContextFeature: string | null = null
let cachedContextTimestamp = 0
const CONTEXT_CACHE_TTL_MS = 30_000

/**
 * Get cached user context or compute fresh one.
 * Cache is keyed by feature type and expires after 30 seconds.
 */
async function getCachedUserContext(feature: RouterOptions['contextFeature']): Promise<string> {
  const now = Date.now()
  const featureKey = feature || 'chat'

  if (
    cachedContext !== null &&
    cachedContextFeature === featureKey &&
    now - cachedContextTimestamp < CONTEXT_CACHE_TTL_MS
  ) {
    return cachedContext
  }

  cachedContext = await getAIUserContext(featureKey as 'quicksort' | 'taskassist' | 'chat' | 'weeklyplan')
  cachedContextFeature = featureKey
  cachedContextTimestamp = now
  return cachedContext
}

/**
 * Inject user context into a messages array.
 * - If the first message is a system message, appends context to it
 * - If no system message exists, prepends a new system message with the context
 * - Returns a NEW array (does not mutate the original)
 */
function injectContextIntoMessages(messages: ChatMessage[], context: string): ChatMessage[] {
  if (!context) return messages

  const result = [...messages]

  if (result.length > 0 && result[0].role === 'system') {
    // Append context to existing system message
    result[0] = { ...result[0], content: result[0].content + context }
  } else {
    // Prepend new system message with context
    result.unshift({ role: 'system', content: context })
  }

  return result
}

/**
 * Create a context-aware wrapper around an AIRouter.
 * Intercepts `chat()` and `chatStream()` to auto-inject user context.
 * All other methods/properties pass through to the underlying router.
 */
function createContextAwareRouter(router: AIRouter): AIRouter {
  // Use a Proxy to intercept chat and chatStream while passing through everything else
  return new Proxy(router, {
    get(target, prop, receiver) {
      if (prop === 'chat') {
        return async function contextAwareChat(
          messages: ChatMessage[],
          options: RouterOptions = {}
        ) {
          if (options.skipUserContext) {
            return target.chat(messages, options)
          }

          const context = await getCachedUserContext(options.contextFeature)
          const enrichedMessages = injectContextIntoMessages(messages, context)
          return target.chat(enrichedMessages, options)
        }
      }

      if (prop === 'chatStream') {
        return async function* contextAwareChatStream(
          messages: ChatMessage[],
          options: RouterOptions = {}
        ) {
          if (options.skipUserContext) {
            yield* target.chatStream(messages, options)
            return
          }

          const context = await getCachedUserContext(options.contextFeature)
          const enrichedMessages = injectContextIntoMessages(messages, context)
          yield* target.chatStream(enrichedMessages, options)
        }
      }

      return Reflect.get(target, prop, receiver)
    }
  })
}

/**
 * Get or create the shared AI Router singleton.
 *
 * Returns a ContextAwareRouter that auto-injects user context into
 * every chat/chatStream call. Reads groqApiKey from settings store.
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
    // Also invalidate context cache on router reset
    cachedContext = null
    cachedContextTimestamp = 0
  }

  if (!sharedRouter) {
    configuredApiKey = currentApiKey
    const rawRouter = createAIRouter({
      providers: ['groq', 'ollama', 'openrouter'],
      preferLocal: false,
      debug: false,
      groqApiKey: currentApiKey,
    })
    initPromise = rawRouter.initialize()
    // Wrap the raw router with context-aware behavior
    sharedRouter = createContextAwareRouter(rawRouter)
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
    cachedContext = null
    cachedContextTimestamp = 0
  }
}
