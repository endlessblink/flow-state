/**
 * Base AI Provider Abstract Class
 *
 * Provides common functionality for all AI provider implementations:
 * - Error handling with structured error types
 * - Retry logic with exponential backoff
 * - Rate limiting with token bucket algorithm
 * - Request context and metrics tracking
 * - Event emission for monitoring
 *
 * Concrete providers extend this class and implement the abstract methods.
 *
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 */

import {
  AIProvider,
  AIProviderConfig,
  AIMessage,
  AIResponse,
  AIStreamChunk,
  AICompletionOptions,
  AIModelInfo,
  AIHealthCheckResult,
  AIRetryConfig,
  AIRateLimitConfig,
  AIErrorCode,
  AIProviderError,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_RATE_LIMIT_CONFIG,
  createAIProviderError,
  DEFAULT_PROVIDER_CONFIGS
} from '@/types/ai'

import type {
  AIProviderInterface,
  BaseProviderOptions,
  RateLimitState,
  RequestContext,
  ProviderMetrics,
  ProviderEvent,
  ProviderEventListener,
  ProviderEventType
} from './types'

/**
 * Abstract base class for AI providers.
 *
 * Handles common concerns like:
 * - Configuration management
 * - Retry logic with exponential backoff
 * - Rate limiting
 * - Error handling and normalization
 * - Metrics collection
 * - Event emission
 *
 * Subclasses must implement:
 * - executeComplete() - Provider-specific completion logic
 * - executeStream() - Provider-specific streaming logic
 * - fetchModels() - Provider-specific model listing
 * - performHealthCheck() - Provider-specific health check
 */
export abstract class BaseAIProvider implements AIProviderInterface {
  // ============================================================================
  // Properties
  // ============================================================================

  /** Provider identifier */
  abstract readonly provider: AIProvider

  /** Provider configuration */
  protected _config: AIProviderConfig

  /** Whether provider is initialized */
  protected _isInitialized = false

  /** Retry configuration */
  protected retryConfig: AIRetryConfig

  /** Rate limit configuration */
  protected rateLimitConfig: AIRateLimitConfig

  /** Rate limit state */
  protected rateLimitState: RateLimitState

  /** Provider metrics */
  protected metrics: ProviderMetrics

  /** Event listeners */
  protected eventListeners: Map<ProviderEventType, Set<ProviderEventListener>>

  /** Active abort controllers for cancellation */
  protected activeAbortControllers: Set<AbortController>

  /** Debug mode flag */
  protected debug: boolean

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(options?: Partial<BaseProviderOptions>) {
    // Initialize with defaults, will be properly set in initialize()
    this._config = options?.config ?? {
      ...DEFAULT_PROVIDER_CONFIGS[AIProvider.OLLAMA],
      provider: AIProvider.OLLAMA
    }

    this.retryConfig = options?.retryConfig ?? { ...DEFAULT_RETRY_CONFIG }
    this.rateLimitConfig = options?.rateLimitConfig ?? { ...DEFAULT_RATE_LIMIT_CONFIG }
    this.debug = options?.debug ?? false

    // Initialize rate limit state
    this.rateLimitState = {
      requestCount: 0,
      tokenCount: 0,
      concurrentRequests: 0,
      windowStart: Date.now(),
      queue: []
    }

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      averageLatencyMs: 0,
      activeRequests: 0,
      rateLimitHits: 0,
      retryAttempts: 0
    }

    // Initialize event listeners
    this.eventListeners = new Map()
    this.activeAbortControllers = new Set()
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  get config(): AIProviderConfig {
    return this._config
  }

  get isInitialized(): boolean {
    return this._isInitialized
  }

  // ============================================================================
  // AIProviderInterface Implementation
  // ============================================================================

  /**
   * Initialize the provider with configuration.
   */
  async initialize(config: AIProviderConfig): Promise<void> {
    this._config = { ...config }
    this._isInitialized = true

    this.log('Provider initialized', { provider: this.provider, endpoint: config.endpoint })
  }

  /**
   * Generate a completion from messages.
   */
  async complete(
    messages: AIMessage[],
    options: AICompletionOptions = {}
  ): Promise<AIResponse> {
    this.ensureInitialized()

    const context = this.createRequestContext(messages, options)

    try {
      // Wait for rate limit
      await this.acquireRateLimit()

      // Execute with retry logic
      const response = await this.executeWithRetry(
        () => this.executeComplete(context),
        context
      )

      // Update metrics
      this.recordSuccess(response, context)

      return response
    } catch (error) {
      this.recordFailure(error, context)
      throw this.normalizeError(error)
    } finally {
      this.releaseRateLimit()
      this.activeAbortControllers.delete(context.abortController)
    }
  }

  /**
   * Generate a streaming completion from messages.
   */
  async *stream(
    messages: AIMessage[],
    options: AICompletionOptions = {}
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    this.ensureInitialized()

    const context = this.createRequestContext(messages, options)

    try {
      // Wait for rate limit
      await this.acquireRateLimit()

      this.emit('stream:start', { requestId: context.requestId })

      // Get the stream generator from the concrete implementation
      const streamGenerator = this.executeStream(context)

      let accumulated = ''

      for await (const chunk of streamGenerator) {
        // Check for abort
        if (context.abortController.signal.aborted) {
          throw this.createAbortError()
        }

        accumulated += chunk.content
        const enrichedChunk: AIStreamChunk = {
          ...chunk,
          accumulated
        }

        this.emit('stream:chunk', { requestId: context.requestId, chunk: enrichedChunk })

        yield enrichedChunk

        if (chunk.done) {
          this.emit('stream:end', { requestId: context.requestId, usage: chunk.usage })
        }
      }

      this.metrics.successfulRequests++
    } catch (error) {
      this.recordFailure(error, context)
      throw this.normalizeError(error)
    } finally {
      this.releaseRateLimit()
      this.activeAbortControllers.delete(context.abortController)
    }
  }

  /**
   * Get list of available models.
   */
  async getModels(): Promise<AIModelInfo[]> {
    this.ensureInitialized()

    try {
      return await this.fetchModels()
    } catch (error) {
      throw this.normalizeError(error)
    }
  }

  /**
   * Perform a health check.
   */
  async healthCheck(): Promise<AIHealthCheckResult> {
    const startTime = Date.now()

    try {
      const result = await this.performHealthCheck()

      this.emit('health:change', { healthy: result.healthy })

      return {
        ...result,
        latencyMs: Date.now() - startTime,
        timestamp: new Date()
      }
    } catch (error) {
      const normalizedError = this.normalizeError(error)

      this.emit('health:change', { healthy: false, error: normalizedError.message })

      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: normalizedError.message,
        timestamp: new Date()
      }
    }
  }

  /**
   * Abort all in-flight requests.
   */
  abort(): void {
    for (const controller of this.activeAbortControllers) {
      controller.abort()
    }
    this.activeAbortControllers.clear()

    this.log('All requests aborted')
  }

  /**
   * Clean up provider resources.
   */
  dispose(): void {
    this.abort()
    this.eventListeners.clear()
    this._isInitialized = false

    this.log('Provider disposed')
  }

  // ============================================================================
  // Abstract Methods (Must be implemented by subclasses)
  // ============================================================================

  /**
   * Execute the completion request.
   * Must be implemented by concrete providers.
   */
  protected abstract executeComplete(context: RequestContext): Promise<AIResponse>

  /**
   * Execute the streaming request.
   * Must be implemented by concrete providers.
   */
  protected abstract executeStream(
    context: RequestContext
  ): AsyncGenerator<AIStreamChunk, void, unknown>

  /**
   * Fetch available models from the provider.
   * Must be implemented by concrete providers.
   */
  protected abstract fetchModels(): Promise<AIModelInfo[]>

  /**
   * Perform provider-specific health check.
   * Must be implemented by concrete providers.
   */
  protected abstract performHealthCheck(): Promise<AIHealthCheckResult>

  // ============================================================================
  // Retry Logic
  // ============================================================================

  /**
   * Execute a function with retry logic.
   */
  protected async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: RequestContext
  ): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      context.retryState.attempt = attempt

      if (attempt > 0) {
        this.metrics.retryAttempts++
        const delay = this.calculateRetryDelay(attempt)

        this.emit('request:retry', {
          requestId: context.requestId,
          attempt,
          delay
        })

        this.log(`Retry attempt ${attempt}/${this.retryConfig.maxRetries}`, { delay })

        await this.sleep(delay)
      }

      try {
        // Check for abort before attempt
        if (context.abortController.signal.aborted) {
          throw this.createAbortError()
        }

        this.emit('request:start', { requestId: context.requestId, attempt })

        const result = await fn()

        this.emit('request:complete', { requestId: context.requestId })

        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        context.retryState.lastError = lastError
        context.retryState.lastAttemptTime = Date.now()

        const normalizedError = this.normalizeError(error)

        this.emit('request:error', {
          requestId: context.requestId,
          error: normalizedError,
          attempt
        })

        // Don't retry if not retryable or if aborted
        if (!normalizedError.retryable || context.abortController.signal.aborted) {
          throw error
        }

        this.log(`Request failed, will retry`, {
          attempt,
          error: normalizedError.message
        })
      }
    }

    // All retries exhausted
    throw lastError ?? new Error('Unknown error after retries')
  }

  /**
   * Calculate delay for retry attempt using exponential backoff with jitter.
   */
  protected calculateRetryDelay(attempt: number): number {
    const baseDelay = this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, attempt - 1)

    const cappedDelay = Math.min(baseDelay, this.retryConfig.maxDelayMs)

    // Add jitter
    const jitter = cappedDelay * this.retryConfig.jitterFactor * Math.random()

    return Math.floor(cappedDelay + jitter)
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  /**
   * Acquire a rate limit slot.
   */
  protected async acquireRateLimit(): Promise<void> {
    // Reset window if expired
    const now = Date.now()
    const windowDuration = 60000 // 1 minute

    if (now - this.rateLimitState.windowStart >= windowDuration) {
      this.rateLimitState.requestCount = 0
      this.rateLimitState.tokenCount = 0
      this.rateLimitState.windowStart = now
    }

    // Check if at capacity
    if (
      this.rateLimitState.requestCount >= this.rateLimitConfig.requestsPerMinute ||
      this.rateLimitState.concurrentRequests >= this.rateLimitConfig.maxConcurrent
    ) {
      this.metrics.rateLimitHits++
      this.emit('rate_limit:hit', {
        requestCount: this.rateLimitState.requestCount,
        concurrentRequests: this.rateLimitState.concurrentRequests
      })

      // Wait for next window or slot
      await new Promise<void>((resolve, reject) => {
        this.rateLimitState.queue.push({ resolve, reject })

        // Set timeout to avoid indefinite waiting
        setTimeout(() => {
          const index = this.rateLimitState.queue.findIndex(
            item => item.resolve === resolve
          )
          if (index !== -1) {
            this.rateLimitState.queue.splice(index, 1)
            resolve() // Resolve anyway after timeout
          }
        }, windowDuration)
      })
    }

    this.rateLimitState.requestCount++
    this.rateLimitState.concurrentRequests++
    this.metrics.activeRequests++
  }

  /**
   * Release a rate limit slot.
   */
  protected releaseRateLimit(): void {
    this.rateLimitState.concurrentRequests = Math.max(
      0,
      this.rateLimitState.concurrentRequests - 1
    )
    this.metrics.activeRequests = Math.max(0, this.metrics.activeRequests - 1)

    // Process queue
    if (this.rateLimitState.queue.length > 0) {
      const next = this.rateLimitState.queue.shift()
      next?.resolve()
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  /**
   * Normalize an error into an AIProviderError.
   */
  protected normalizeError(error: unknown): AIProviderError {
    // Check if already an AIProviderError using isAIProviderError type guard
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'provider' in error &&
      'retryable' in error
    ) {
      return error as AIProviderError
    }

    // Handle abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      return createAIProviderError(
        AIErrorCode.TIMEOUT,
        'Request was aborted',
        this.provider,
        { retryable: false, cause: error }
      )
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return createAIProviderError(
        AIErrorCode.NETWORK_ERROR,
        `Network error: ${error.message}`,
        this.provider,
        { cause: error }
      )
    }

    // Handle HTTP errors (if error has status)
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = (error as { status: number }).status
      return this.normalizeHttpError(status, error)
    }

    // Generic error
    const message = error instanceof Error ? error.message : String(error)
    return createAIProviderError(
      AIErrorCode.UNKNOWN,
      message,
      this.provider,
      { cause: error instanceof Error ? error : undefined }
    )
  }

  /**
   * Normalize HTTP status codes to error codes.
   */
  protected normalizeHttpError(status: number, error: unknown): AIProviderError {
    const cause = error instanceof Error ? error : undefined

    switch (status) {
      case 401:
      case 403:
        return createAIProviderError(
          AIErrorCode.AUTH_ERROR,
          'Authentication failed',
          this.provider,
          { retryable: false, cause }
        )

      case 429:
        return createAIProviderError(
          AIErrorCode.RATE_LIMIT,
          'Rate limit exceeded',
          this.provider,
          { retryAfterMs: 60000, cause }
        )

      case 400:
        return createAIProviderError(
          AIErrorCode.INVALID_REQUEST,
          'Invalid request',
          this.provider,
          { retryable: false, cause }
        )

      case 404:
        return createAIProviderError(
          AIErrorCode.MODEL_NOT_FOUND,
          'Model not found',
          this.provider,
          { retryable: false, cause }
        )

      case 408:
      case 504:
        return createAIProviderError(
          AIErrorCode.TIMEOUT,
          'Request timed out',
          this.provider,
          { cause }
        )

      case 500:
      case 502:
      case 503:
        return createAIProviderError(
          AIErrorCode.SERVICE_ERROR,
          'Service error',
          this.provider,
          { cause }
        )

      default:
        return createAIProviderError(
          AIErrorCode.UNKNOWN,
          `HTTP error: ${status}`,
          this.provider,
          { cause }
        )
    }
  }

  /**
   * Create an abort error.
   */
  protected createAbortError(): AIProviderError {
    return createAIProviderError(
      AIErrorCode.TIMEOUT,
      'Request was aborted',
      this.provider,
      { retryable: false }
    )
  }

  // ============================================================================
  // Metrics & Monitoring
  // ============================================================================

  /**
   * Record a successful request.
   */
  protected recordSuccess(response: AIResponse, context: RequestContext): void {
    this.metrics.totalRequests++
    this.metrics.successfulRequests++

    if (response.usage) {
      this.metrics.totalTokens += response.usage.totalTokens
      this.rateLimitState.tokenCount += response.usage.totalTokens
    }

    // Update average latency
    const latency = Date.now() - context.startTime
    this.metrics.averageLatencyMs =
      (this.metrics.averageLatencyMs * (this.metrics.successfulRequests - 1) + latency) /
      this.metrics.successfulRequests
  }

  /**
   * Record a failed request.
   */
  protected recordFailure(error: unknown, _context: RequestContext): void {
    this.metrics.totalRequests++
    this.metrics.failedRequests++

    this.log('Request failed', { error })
  }

  /**
   * Get current metrics.
   */
  getMetrics(): ProviderMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset metrics.
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      averageLatencyMs: 0,
      activeRequests: 0,
      rateLimitHits: 0,
      retryAttempts: 0
    }
  }

  // ============================================================================
  // Event Emission
  // ============================================================================

  /**
   * Add an event listener.
   */
  on(event: ProviderEventType, listener: ProviderEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * Remove an event listener.
   */
  off(event: ProviderEventType, listener: ProviderEventListener): void {
    this.eventListeners.get(event)?.delete(listener)
  }

  /**
   * Emit an event.
   */
  protected emit(type: ProviderEventType, data?: unknown): void {
    const event: ProviderEvent = {
      type,
      provider: this.provider,
      timestamp: new Date(),
      data
    }

    this.eventListeners.get(type)?.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        this.log('Event listener error', { type, error })
      }
    })
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Create a request context.
   */
  protected createRequestContext(
    messages: AIMessage[],
    options: AICompletionOptions
  ): RequestContext {
    const abortController = new AbortController()
    this.activeAbortControllers.add(abortController)

    // Merge with external abort signal if provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => abortController.abort())
    }

    return {
      requestId: this.generateRequestId(),
      startTime: Date.now(),
      messages,
      options: this.mergeOptions(options),
      abortController,
      retryState: {
        attempt: 0
      }
    }
  }

  /**
   * Merge completion options with defaults.
   */
  protected mergeOptions(options: AICompletionOptions): AICompletionOptions {
    return {
      model: options.model ?? this._config.model,
      maxTokens: options.maxTokens ?? this._config.maxTokens,
      temperature: options.temperature ?? this._config.temperature,
      timeout: options.timeout ?? this._config.timeout,
      ...options
    }
  }

  /**
   * Generate a unique request ID.
   */
  protected generateRequestId(): string {
    return `${this.provider}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * Sleep for a specified duration.
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Ensure provider is initialized.
   */
  protected ensureInitialized(): void {
    if (!this._isInitialized) {
      throw createAIProviderError(
        AIErrorCode.INVALID_REQUEST,
        'Provider not initialized. Call initialize() first.',
        this.provider,
        { retryable: false }
      )
    }
  }

  /**
   * Log a debug message.
   */
  protected log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[${this.provider}] ${message}`, data ?? '')
    }
  }
}
