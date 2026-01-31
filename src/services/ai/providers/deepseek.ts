/**
 * DeepSeek AI Provider
 *
 * Implements the AIProvider interface for DeepSeek's API.
 * Features:
 * - OpenAI-compatible API format (https://api.deepseek.com/v1)
 * - Support for both V3.2 and R1 models
 * - Streaming responses via Server-Sent Events
 * - Full BaseAIProvider capabilities (retry, rate limiting, error handling)
 *
 * Supported Models:
 * - deepseek-chat (V3.2) - General purpose chat model
 * - deepseek-reasoner (R1) - Reasoning model
 *
 * @see https://api-docs.deepseek.com/
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 */

import { BaseAIProvider } from './BaseAIProvider'
import type { RequestContext } from './types'
import {
  AIProvider,
  AIErrorCode,
  createAIProviderError
} from '@/types/ai'
import type {
  AIProviderConfig,
  AIResponse,
  AIStreamChunk,
  AIModelInfo,
  AIHealthCheckResult
} from '@/types/ai'

// ============================================================================
// DeepSeek API Types
// ============================================================================

/**
 * DeepSeek API request format (OpenAI-compatible).
 */
interface DeepSeekChatRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  stream?: boolean
  max_tokens?: number
  temperature?: number
  top_p?: number
  stop?: string[]
}

/**
 * DeepSeek API response format (OpenAI-compatible).
 */
interface DeepSeekChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * DeepSeek streaming chunk format (OpenAI-compatible SSE).
 */
interface DeepSeekStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * DeepSeek models list response.
 */
interface DeepSeekModelsResponse {
  object: string
  data: Array<{
    id: string
    object: string
    created: number
    owned_by: string
  }>
}

// ============================================================================
// DeepSeek Provider Configuration
// ============================================================================

/**
 * Default configuration for DeepSeek provider.
 */
const DEFAULT_DEEPSEEK_CONFIG: Omit<AIProviderConfig, 'apiKey'> = {
  provider: AIProvider.OPENAI, // DeepSeek uses OpenAI-compatible format
  enabled: false,
  endpoint: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000
}

// ============================================================================
// DeepSeek Provider Implementation
// ============================================================================

/**
 * DeepSeek AI provider implementation.
 *
 * Extends BaseAIProvider to inherit:
 * - Retry logic with exponential backoff
 * - Rate limiting with token bucket
 * - Error handling and normalization
 * - Metrics collection
 * - Event emission
 */
export class DeepSeekProvider extends BaseAIProvider {
  readonly provider = AIProvider.OPENAI // Using OpenAI enum value for compatibility

  /**
   * Execute a non-streaming completion request.
   */
  protected async executeComplete(context: RequestContext): Promise<AIResponse> {
    const startTime = Date.now()

    const request: DeepSeekChatRequest = {
      model: context.options.model || this._config.model,
      messages: context.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: false,
      max_tokens: context.options.maxTokens,
      temperature: context.options.temperature,
      top_p: context.options.topP,
      stop: context.options.stopSequences
    }

    // Add system prompt if provided
    if (context.options.systemPrompt) {
      request.messages.unshift({
        role: 'system',
        content: context.options.systemPrompt
      })
    }

    try {
      const response = await fetch(`${this._config.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._config.apiKey}`,
          ...context.options.headers
        },
        body: JSON.stringify(request),
        signal: context.abortController.signal
      })

      if (!response.ok) {
        throw await this.handleHttpError(response)
      }

      const data: DeepSeekChatResponse = await response.json()

      // Validate response structure
      if (!data.choices || data.choices.length === 0) {
        throw createAIProviderError(
          AIErrorCode.SERVICE_ERROR,
          'DeepSeek returned empty choices',
          this.provider
        )
      }

      const choice = data.choices[0]

      return {
        id: data.id,
        content: choice.message.content,
        provider: this.provider,
        model: data.model,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        latencyMs: Date.now() - startTime,
        finishReason: choice.finish_reason,
        raw: data
      }
    } catch (error) {
      // Normalize error before throwing
      throw this.normalizeError(error)
    }
  }

  /**
   * Execute a streaming completion request.
   */
  protected async *executeStream(
    context: RequestContext
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    const request: DeepSeekChatRequest = {
      model: context.options.model || this._config.model,
      messages: context.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: true,
      max_tokens: context.options.maxTokens,
      temperature: context.options.temperature,
      top_p: context.options.topP,
      stop: context.options.stopSequences
    }

    // Add system prompt if provided
    if (context.options.systemPrompt) {
      request.messages.unshift({
        role: 'system',
        content: context.options.systemPrompt
      })
    }

    try {
      const response = await fetch(`${this._config.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._config.apiKey}`,
          ...context.options.headers
        },
        body: JSON.stringify(request),
        signal: context.abortController.signal
      })

      if (!response.ok) {
        throw await this.handleHttpError(response)
      }

      if (!response.body) {
        throw createAIProviderError(
          AIErrorCode.SERVICE_ERROR,
          'Response body is null',
          this.provider
        )
      }

      // Process Server-Sent Events stream
      yield* this.processSSEStream(response.body, context)
    } catch (error) {
      throw this.normalizeError(error)
    }
  }

  /**
   * Fetch available models from DeepSeek API.
   */
  protected async fetchModels(): Promise<AIModelInfo[]> {
    try {
      const response = await fetch(`${this._config.endpoint}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this._config.apiKey}`
        }
      })

      if (!response.ok) {
        throw await this.handleHttpError(response)
      }

      const data: DeepSeekModelsResponse = await response.json()

      return data.data.map(model => ({
        id: model.id,
        name: model.id,
        provider: this.provider,
        contextWindow: this.getContextWindowForModel(model.id),
        maxOutputTokens: this._config.maxTokens,
        supportsStreaming: true,
        capabilities: ['chat', 'completion'],
        description: this.getModelDescription(model.id)
      }))
    } catch (error) {
      this.log('Failed to fetch models', { error })
      throw this.normalizeError(error)
    }
  }

  /**
   * Perform a health check on the DeepSeek API.
   */
  protected async performHealthCheck(): Promise<AIHealthCheckResult> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${this._config.endpoint}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this._config.apiKey}`
        },
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        throw await this.handleHttpError(response)
      }

      const data: DeepSeekModelsResponse = await response.json()
      const availableModels = data.data.map(m => m.id)

      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
        availableModels,
        timestamp: new Date()
      }
    } catch (error) {
      const normalizedError = this.normalizeError(error)

      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: normalizedError.message,
        timestamp: new Date()
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Process Server-Sent Events stream from DeepSeek API.
   */
  private async *processSSEStream(
    body: ReadableStream<Uint8Array>,
    context: RequestContext
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalUsage: AIStreamChunk['usage'] | undefined

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE messages
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          // SSE format: "data: {...}" or "data: [DONE]"
          if (!line.startsWith('data: ')) continue

          const dataStr = line.slice(6).trim()

          if (dataStr === '[DONE]') {
            // Final chunk
            yield {
              content: '',
              done: true,
              usage: finalUsage
            }
            return
          }

          try {
            const chunk: DeepSeekStreamChunk = JSON.parse(dataStr)

            if (!chunk.choices || chunk.choices.length === 0) continue

            const choice = chunk.choices[0]
            const content = choice.delta.content || ''

            // Store usage from final chunk
            if (chunk.usage) {
              finalUsage = {
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens
              }
            }

            yield {
              content,
              done: choice.finish_reason !== null,
              usage: chunk.usage ? finalUsage : undefined,
              finishReason: choice.finish_reason || undefined
            }

            if (choice.finish_reason) {
              return
            }
          } catch (parseError) {
            this.log('Failed to parse SSE chunk', { line, parseError })
          }
        }

        // Check for abort
        if (context.abortController.signal.aborted) {
          throw this.createAbortError()
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Handle HTTP error responses from DeepSeek API.
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`

    try {
      const errorData = await response.json()
      if (errorData.error?.message) {
        errorMessage = errorData.error.message
      }
    } catch {
      // Failed to parse error response, use default message
    }

    const error = createAIProviderError(
      this.httpStatusToErrorCode(response.status),
      errorMessage,
      this.provider,
      { context: { status: response.status } }
    )

    // Convert AIProviderError to Error for throwing
    const throwableError = new Error(error.message)
    throwableError.name = error.code
    Object.assign(throwableError, error)
    throw throwableError
  }

  /**
   * Map HTTP status code to AIErrorCode.
   */
  private httpStatusToErrorCode(status: number): AIErrorCode {
    switch (status) {
      case 401:
      case 403:
        return AIErrorCode.AUTH_ERROR
      case 429:
        return AIErrorCode.RATE_LIMIT
      case 400:
        return AIErrorCode.INVALID_REQUEST
      case 404:
        return AIErrorCode.MODEL_NOT_FOUND
      case 408:
      case 504:
        return AIErrorCode.TIMEOUT
      case 500:
      case 502:
      case 503:
        return AIErrorCode.SERVICE_ERROR
      default:
        return AIErrorCode.UNKNOWN
    }
  }

  /**
   * Get context window size for a model.
   */
  private getContextWindowForModel(modelId: string): number {
    // DeepSeek V3.2 and R1 have different context windows
    if (modelId.includes('deepseek-chat')) {
      return 64000 // V3.2 has 64K context window
    }
    if (modelId.includes('deepseek-reasoner')) {
      return 64000 // R1 also has 64K context window
    }
    return 32000 // Default fallback
  }

  /**
   * Get human-readable description for a model.
   */
  private getModelDescription(modelId: string): string {
    if (modelId.includes('deepseek-chat')) {
      return 'DeepSeek V3.2 - General purpose chat model'
    }
    if (modelId.includes('deepseek-reasoner')) {
      return 'DeepSeek R1 - Reasoning model'
    }
    return 'DeepSeek model'
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new DeepSeek provider instance.
 *
 * @param apiKey - DeepSeek API key (from VITE_DEEPSEEK_API_KEY)
 * @param config - Optional configuration overrides
 * @returns Initialized DeepSeek provider
 *
 * @example
 * ```typescript
 * const provider = createDeepSeekProvider(
 *   import.meta.env.VITE_DEEPSEEK_API_KEY,
 *   { model: 'deepseek-reasoner' }
 * )
 * await provider.initialize({
 *   ...DEFAULT_PROVIDER_CONFIGS[AIProvider.OPENAI],
 *   apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
 *   endpoint: 'https://api.deepseek.com/v1'
 * })
 * ```
 */
export function createDeepSeekProvider(
  apiKey: string,
  config: Partial<AIProviderConfig> = {}
): DeepSeekProvider {
  const fullConfig: AIProviderConfig = {
    ...DEFAULT_DEEPSEEK_CONFIG,
    ...config,
    apiKey,
    provider: AIProvider.OPENAI
  }

  return new DeepSeekProvider({ config: fullConfig })
}

/**
 * Auto-detect and create a DeepSeek provider from environment variables.
 * Returns null if API key is not found.
 *
 * @param config - Optional configuration overrides
 * @returns DeepSeek provider or null
 *
 * @example
 * ```typescript
 * const provider = await autoDetectDeepSeek()
 * if (provider) {
 *   const response = await provider.complete([
 *     { role: 'user', content: 'Hello!' }
 *   ])
 *   console.log(response.content)
 * }
 * ```
 */
export async function autoDetectDeepSeek(
  config: Partial<AIProviderConfig> = {}
): Promise<DeepSeekProvider | null> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY

  if (!apiKey) {
    console.warn('[DeepSeek] No API key found in VITE_DEEPSEEK_API_KEY')
    return null
  }

  const provider = createDeepSeekProvider(apiKey, config)

  const fullConfig: AIProviderConfig = {
    ...DEFAULT_DEEPSEEK_CONFIG,
    ...config,
    apiKey,
    provider: AIProvider.OPENAI
  }

  await provider.initialize(fullConfig)

  // Verify health
  const health = await provider.healthCheck()
  if (!health.healthy) {
    console.warn('[DeepSeek] Health check failed:', health.error)
    provider.dispose()
    return null
  }

  return provider
}
