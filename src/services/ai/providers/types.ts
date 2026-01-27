/**
 * AI Provider Abstraction Types
 *
 * Defines the core interfaces for AI provider implementations.
 * All AI providers (Ollama, Anthropic, OpenAI, Gemini) must implement
 * the AIProviderInterface.
 *
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 */

import type {
  AIProvider,
  AIProviderConfig,
  AIMessage,
  AIResponse,
  AIStreamChunk,
  AICompletionOptions,
  AIModelInfo,
  AIHealthCheckResult,
  AIRetryConfig,
  AIRateLimitConfig
} from '@/types/ai'

/**
 * Core interface that all AI providers must implement.
 *
 * This provides a unified API for interacting with different AI backends,
 * allowing the application to switch providers seamlessly.
 */
export interface AIProviderInterface {
  /**
   * Provider identifier.
   */
  readonly provider: AIProvider

  /**
   * Provider configuration.
   */
  readonly config: AIProviderConfig

  /**
   * Whether the provider is currently initialized and ready.
   */
  readonly isInitialized: boolean

  /**
   * Initialize the provider with configuration.
   * Should be called before any other methods.
   *
   * @param config - Provider configuration
   */
  initialize(config: AIProviderConfig): Promise<void>

  /**
   * Generate a completion from messages.
   * This is the core method for non-streaming AI requests.
   *
   * @param messages - Conversation messages
   * @param options - Completion options
   * @returns AI response
   */
  complete(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AIResponse>

  /**
   * Generate a streaming completion from messages.
   * Returns an async generator that yields response chunks.
   *
   * @param messages - Conversation messages
   * @param options - Completion options
   * @returns Async generator of stream chunks
   */
  stream(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): AsyncGenerator<AIStreamChunk, void, unknown>

  /**
   * Get list of available models from the provider.
   *
   * @returns Array of model information
   */
  getModels(): Promise<AIModelInfo[]>

  /**
   * Perform a health check on the provider.
   * Tests connectivity and basic functionality.
   *
   * @returns Health check result
   */
  healthCheck(): Promise<AIHealthCheckResult>

  /**
   * Abort any in-flight requests.
   */
  abort(): void

  /**
   * Clean up provider resources.
   */
  dispose(): void
}

/**
 * Extended interface for providers that support additional features.
 */
export interface AIProviderExtended extends AIProviderInterface {
  /**
   * Generate embeddings for text.
   *
   * @param text - Text to embed
   * @param model - Embedding model to use
   * @returns Array of embedding vectors
   */
  embed?(text: string | string[], model?: string): Promise<number[][]>

  /**
   * Count tokens in a message or string.
   *
   * @param input - Message or string to count
   * @returns Token count
   */
  countTokens?(input: AIMessage[] | string): Promise<number>
}

/**
 * Configuration options for BaseAIProvider.
 */
export interface BaseProviderOptions {
  /** Provider configuration */
  config: AIProviderConfig

  /** Retry configuration */
  retryConfig?: AIRetryConfig

  /** Rate limit configuration */
  rateLimitConfig?: AIRateLimitConfig

  /** Whether to enable debug logging */
  debug?: boolean
}

/**
 * Internal state for tracking rate limits.
 */
export interface RateLimitState {
  /** Number of requests in current window */
  requestCount: number

  /** Tokens used in current window */
  tokenCount: number

  /** Current concurrent requests */
  concurrentRequests: number

  /** Window start timestamp */
  windowStart: number

  /** Queue of pending requests */
  queue: Array<{
    resolve: () => void
    reject: (error: Error) => void
  }>
}

/**
 * Internal state for tracking retries.
 */
export interface RetryState {
  /** Current attempt number */
  attempt: number

  /** Last error encountered */
  lastError?: Error

  /** Timestamp of last attempt */
  lastAttemptTime?: number
}

/**
 * Request context passed through the provider pipeline.
 */
export interface RequestContext {
  /** Unique request ID */
  requestId: string

  /** Start timestamp */
  startTime: number

  /** Messages being processed */
  messages: AIMessage[]

  /** Completion options */
  options: AICompletionOptions

  /** Abort controller for cancellation */
  abortController: AbortController

  /** Retry state */
  retryState: RetryState
}

/**
 * Metrics collected during provider operations.
 */
export interface ProviderMetrics {
  /** Total requests made */
  totalRequests: number

  /** Successful requests */
  successfulRequests: number

  /** Failed requests */
  failedRequests: number

  /** Total tokens used */
  totalTokens: number

  /** Average latency in milliseconds */
  averageLatencyMs: number

  /** Requests currently in flight */
  activeRequests: number

  /** Rate limit hits */
  rateLimitHits: number

  /** Retry attempts */
  retryAttempts: number
}

/**
 * Event types emitted by providers.
 */
export type ProviderEventType =
  | 'request:start'
  | 'request:complete'
  | 'request:error'
  | 'request:retry'
  | 'stream:start'
  | 'stream:chunk'
  | 'stream:end'
  | 'rate_limit:hit'
  | 'health:change'

/**
 * Event payload for provider events.
 */
export interface ProviderEvent {
  type: ProviderEventType
  provider: AIProvider
  timestamp: Date
  data?: unknown
}

/**
 * Listener for provider events.
 */
export type ProviderEventListener = (event: ProviderEvent) => void
