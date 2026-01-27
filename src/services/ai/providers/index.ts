/**
 * AI Provider Abstraction Layer
 *
 * This module provides a unified interface for interacting with various AI providers:
 * - Ollama (local, privacy-focused)
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google Gemini
 *
 * Usage:
 * ```typescript
 * import { BaseAIProvider, AIProviderInterface } from '@/services/ai/providers'
 * import { AIProvider, AIProviderConfig } from '@/types/ai'
 *
 * // Create a concrete provider implementation
 * class OllamaProvider extends BaseAIProvider {
 *   readonly provider = AIProvider.OLLAMA
 *   // ... implement abstract methods
 * }
 *
 * // Use the provider
 * const provider = new OllamaProvider()
 * await provider.initialize(config)
 * const response = await provider.complete(messages)
 * ```
 *
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 */

// Core interface and types
export * from './types'

// Base abstract class
export { BaseAIProvider } from './BaseAIProvider'

// Ollama (Local)
export {
  OllamaProvider,
  createOllamaProvider,
  autoDetectOllama,
} from './ollama'

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
