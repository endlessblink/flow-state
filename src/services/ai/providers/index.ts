/**
 * AI Provider Abstraction Layer
 *
 * This module provides a unified interface for interacting with various AI providers:
 * - Ollama (local, privacy-focused)
 * - Groq (via proxy - Llama, Mixtral, Gemma)
 * - OpenRouter (via proxy - Claude, GPT-4, Llama, etc.)
 *
 * BUG-1131: Cloud providers now use Supabase Edge Function proxies to keep API keys server-side.
 *
 * Usage:
 * ```typescript
 * import { createGroqProxyProvider, createOpenRouterProxyProvider } from '@/services/ai/providers'
 *
 * // Use proxy providers (recommended - API keys stay server-side)
 * const groq = createGroqProxyProvider()
 * const openrouter = createOpenRouterProxyProvider()
 * ```
 *
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 * @see BUG-1131 in MASTER_PLAN.md - Move All Exposed API Keys to Backend Proxy
 */

// Core interface and types
export * from './types'

// Ollama (Local)
export {
  OllamaProvider,
  createOllamaProvider,
  autoDetectOllama,
} from './ollama'

// ============================================================================
// Proxy Providers (BUG-1131 - API keys server-side)
// ============================================================================

// Groq Proxy (Llama, Mixtral, Gemma via Edge Function)
export {
  GroqProxyProvider,
  createGroqProxyProvider,
} from './groqProxy'

// OpenRouter Proxy (Claude, GPT-4, Llama, etc. via Edge Function)
export {
  OpenRouterProxyProvider,
  createOpenRouterProxyProvider,
} from './openrouterProxy'

// ============================================================================
// Direct Providers (for local/testing use)
// ============================================================================

// Groq Direct
export {
  GroqProvider,
  createGroqProvider,
} from './groq'

// Re-export commonly used types from @/types/ai for convenience
export type {
  AIProvider,
  AIProviderConfig,
  AIMessage,
  AIMessageRole,
  AIResponse,
  AIStreamChunk,
  AICompletionOptions,
  AIModelInfo,
  AIHealthCheckResult,
  AITokenUsage,
  AIRetryConfig,
  AIRateLimitConfig,
  AIErrorCode,
  AIProviderError
} from '@/types/ai'

export {
  DEFAULT_RETRY_CONFIG,
  DEFAULT_RATE_LIMIT_CONFIG,
  DEFAULT_PROVIDER_CONFIGS,
  isAIProviderError,
  createAIProviderError
} from '@/types/ai'
