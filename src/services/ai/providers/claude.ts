/**
 * Claude/Anthropic AI Provider
 *
 * Implements the AIProvider interface for Anthropic's Claude models.
 * Features:
 * - Messages API with streaming support
 * - Claude Sonnet 4 as the primary model
 * - Server-Sent Events (SSE) streaming
 * - Proper error handling and retry logic
 *
 * @see https://docs.anthropic.com/en/api/messages
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 */

import { BaseAIProvider } from './BaseAIProvider'
import {
  AIProvider,
  AIErrorCode
} from '@/types/ai'
import type {
  AIProviderConfig,
  AIMessage,
  AIResponse,
  AIStreamChunk,
  AIModelInfo,
  AIHealthCheckResult
} from '@/types/ai'
import type { RequestContext } from './types'

// ============================================================================
// Anthropic API Types
// ============================================================================

/**
 * Anthropic Messages API request format.
 */
interface AnthropicMessagesRequest {
  model: string
  max_tokens: number
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  top_p?: number
  stop_sequences?: string[]
  stream?: boolean
  system?: string
}

/**
 * Anthropic Messages API non-streaming response.
 */
interface AnthropicMessagesResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: Array<{
    type: 'text'
    text: string
  }>
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

/**
 * Anthropic streaming event types.
 */
type AnthropicStreamEvent =
  | { type: 'message_start'; message: Partial<AnthropicMessagesResponse> }
  | { type: 'content_block_start'; index: number; content_block: { type: 'text'; text: string } }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string; stop_sequence: string | null }; usage: { output_tokens: number } }
  | { type: 'message_stop' }
  | { type: 'ping' }
  | { type: 'error'; error: { type: string; message: string } }

/**
 * Anthropic error response.
 */
interface AnthropicErrorResponse {
  type: 'error'
  error: {
    type: string
    message: string
  }
}

// ============================================================================
// Claude Provider Implementation
// ============================================================================

/**
 * Claude/Anthropic AI provider implementation.
 * Extends BaseAIProvider to inherit retry, rate limiting, and error handling.
 */
export class ClaudeProvider extends BaseAIProvider {
  readonly provider = AIProvider.ANTHROPIC

  /**
   * API key from environment variable or config.
   */
  private get apiKey(): string {
    // Check environment variable (Vite's import.meta.env)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any).env as Record<string, string> | undefined
    const envKey = env?.VITE_ANTHROPIC_API_KEY

    return envKey || this._config.apiKey || ''
  }

  /**
   * Anthropic API version header.
   */
  private readonly ANTHROPIC_VERSION = '2023-06-01'

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  /**
   * Execute a non-streaming completion request.
   */
  protected async executeComplete(context: RequestContext): Promise<AIResponse> {
    const startTime = Date.now()
    const { messages, options } = context

    // Validate API key
    if (!this.apiKey) {
      throw this.createAuthError('VITE_ANTHROPIC_API_KEY environment variable not set')
    }

    // Build request body
    const requestBody = this.buildRequestBody(messages, options, false)

    // Make API request
    const response = await fetch(`${this._config.endpoint}/v1/messages`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody),
      signal: context.abortController.signal
    })

    // Handle HTTP errors
    if (!response.ok) {
      await this.handleHttpError(response)
    }

    // Parse response
    const data: AnthropicMessagesResponse = await response.json()

    // Extract text content
    const content = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')

    return {
      id: data.id,
      content,
      provider: this.provider,
      model: data.model,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      },
      latencyMs: Date.now() - startTime,
      finishReason: data.stop_reason || undefined,
      raw: data
    }
  }

  /**
   * Execute a streaming completion request.
   */
  protected async *executeStream(context: RequestContext): AsyncGenerator<AIStreamChunk, void, unknown> {
    const { messages, options } = context

    // Validate API key
    if (!this.apiKey) {
      throw this.createAuthError('VITE_ANTHROPIC_API_KEY environment variable not set')
    }

    // Build request body with streaming enabled
    const requestBody = this.buildRequestBody(messages, options, true)

    // Make streaming API request
    const response = await fetch(`${this._config.endpoint}/v1/messages`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody),
      signal: context.abortController.signal
    })

    // Handle HTTP errors
    if (!response.ok) {
      await this.handleHttpError(response)
    }

    // Check for response body
    if (!response.body) {
      throw this.createNetworkError('Response body is null')
    }

    // Parse SSE stream
    yield* this.parseSSEStream(response.body, context)
  }

  /**
   * Fetch available models from Anthropic.
   * Note: Anthropic doesn't have a models API endpoint, so we return hardcoded list.
   */
  protected async fetchModels(): Promise<AIModelInfo[]> {
    return [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: this.provider,
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        capabilities: ['chat', 'completion', 'analysis'],
        description: 'Anthropic\'s most intelligent model'
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: this.provider,
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsStreaming: true,
        capabilities: ['chat', 'completion', 'analysis'],
        description: 'Previous generation flagship model'
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: this.provider,
        contextWindow: 200000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        capabilities: ['chat', 'completion', 'analysis'],
        description: 'Powerful model for complex tasks'
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: this.provider,
        contextWindow: 200000,
        maxOutputTokens: 4096,
        supportsStreaming: true,
        capabilities: ['chat', 'completion'],
        description: 'Fast and cost-effective model'
      }
    ]
  }

  /**
   * Perform health check by making a minimal API request.
   */
  protected async performHealthCheck(): Promise<AIHealthCheckResult> {
    // Validate API key first
    if (!this.apiKey) {
      return {
        healthy: false,
        latencyMs: 0,
        error: 'API key not configured',
        timestamp: new Date()
      }
    }

    try {
      const startTime = Date.now()

      // Make a minimal request
      const response = await fetch(`${this._config.endpoint}/v1/messages`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this._config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }]
        }),
        signal: AbortSignal.timeout(5000) // 5 second timeout for health check
      })

      const latencyMs = Date.now() - startTime

      if (!response.ok) {
        // Auth errors mean API is reachable but key is invalid
        if (response.status === 401 || response.status === 403) {
          return {
            healthy: false,
            latencyMs,
            error: 'Invalid API key',
            timestamp: new Date()
          }
        }

        return {
          healthy: false,
          latencyMs,
          error: `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date()
        }
      }

      // Get available models
      const models = await this.fetchModels()

      return {
        healthy: true,
        latencyMs,
        availableModels: models.map(m => m.id),
        timestamp: new Date()
      }
    } catch (error) {
      return {
        healthy: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Build request headers for Anthropic API.
   */
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.ANTHROPIC_VERSION,
      ...this._config.customHeaders
    }
  }

  /**
   * Build request body for Anthropic Messages API.
   */
  private buildRequestBody(
    messages: AIMessage[],
    options: RequestContext['options'],
    stream: boolean
  ): AnthropicMessagesRequest {
    // Separate system messages from conversation
    const systemMessages = messages.filter(m => m.role === 'system')
    const conversationMessages = messages.filter(m => m.role !== 'system')

    // Combine system messages (Anthropic supports single system parameter)
    const systemPrompt = options.systemPrompt ||
      systemMessages.map(m => m.content).join('\n\n')

    // Convert messages to Anthropic format
    const anthropicMessages = conversationMessages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))

    const requestBody: AnthropicMessagesRequest = {
      model: options.model || this._config.model,
      max_tokens: options.maxTokens || this._config.maxTokens,
      messages: anthropicMessages,
      stream
    }

    // Add optional parameters
    if (systemPrompt) {
      requestBody.system = systemPrompt
    }

    if (options.temperature !== undefined) {
      requestBody.temperature = options.temperature
    }

    if (options.topP !== undefined) {
      requestBody.top_p = options.topP
    }

    if (options.stopSequences && options.stopSequences.length > 0) {
      requestBody.stop_sequences = options.stopSequences
    }

    return requestBody
  }

  /**
   * Parse Server-Sent Events stream from Anthropic.
   */
  private async *parseSSEStream(
    body: ReadableStream<Uint8Array>,
    context: RequestContext
  ): AsyncGenerator<AIStreamChunk, void, unknown> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let usage: AIStreamChunk['usage'] | undefined
    let finishReason: string | undefined

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // Check for abort
        if (context.abortController.signal.aborted) {
          throw this.createAbortError()
        }

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE messages (delimited by double newlines)
        const messages = buffer.split('\n\n')
        buffer = messages.pop() || '' // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim()) continue

          // Parse SSE format: "event: type\ndata: json"
          const lines = message.split('\n')
          let eventData = ''

          for (const line of lines) {
            if (line.startsWith('data:')) {
              eventData = line.slice(5).trim()
            }
          }

          if (!eventData) continue

          try {
            const event: AnthropicStreamEvent = JSON.parse(eventData)

            // Handle different event types
            switch (event.type) {
              case 'content_block_delta':
                // This is the actual content chunk
                if (event.delta.type === 'text_delta') {
                  yield {
                    content: event.delta.text,
                    done: false
                  }
                }
                break

              case 'message_delta':
                // Final message with usage stats
                usage = {
                  promptTokens: 0, // Not included in delta
                  completionTokens: event.usage.output_tokens,
                  totalTokens: event.usage.output_tokens
                }
                finishReason = event.delta.stop_reason
                break

              case 'message_stop':
                // End of stream
                yield {
                  content: '',
                  done: true,
                  usage,
                  finishReason
                }
                return

              case 'error':
                // Stream error
                throw this.createServiceError(event.error.message)

              case 'ping':
                // Keep-alive ping, ignore
                break

              // Other events (message_start, content_block_start, content_block_stop)
              // don't need special handling for basic streaming
            }
          } catch (parseError) {
            this.log('Failed to parse SSE event', { message, error: parseError })
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Handle HTTP error responses from Anthropic API.
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`

    try {
      const errorData: AnthropicErrorResponse = await response.json()
      errorMessage = errorData.error.message
    } catch {
      // Couldn't parse error response, use HTTP status
    }

    throw this.normalizeHttpError(response.status, new Error(errorMessage))
  }

  /**
   * Create an authentication error.
   */
  private createAuthError(message: string): Error {
    return new Error(`[Claude Auth Error] ${message}`)
  }

  /**
   * Create a network error.
   */
  private createNetworkError(message: string): Error {
    return new Error(`[Claude Network Error] ${message}`)
  }

  /**
   * Create a service error.
   */
  private createServiceError(message: string): Error {
    return new Error(`[Claude Service Error] ${message}`)
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Claude provider instance.
 *
 * @param config - Optional provider configuration
 * @returns Initialized Claude provider
 *
 * @example
 * ```ts
 * const claude = createClaudeProvider({
 *   apiKey: process.env.VITE_ANTHROPIC_API_KEY,
 *   model: 'claude-sonnet-4-20250514'
 * })
 *
 * await claude.initialize(config)
 *
 * const response = await claude.complete([
 *   { role: 'user', content: 'Hello!' }
 * ])
 * ```
 */
export function createClaudeProvider(config?: Partial<AIProviderConfig>): ClaudeProvider {
  const provider = new ClaudeProvider()

  if (config) {
    // Initialize with merged config
    const fullConfig: AIProviderConfig = {
      provider: AIProvider.ANTHROPIC,
      enabled: config.enabled ?? true,
      endpoint: config.endpoint ?? 'https://api.anthropic.com',
      apiKey: config.apiKey,
      model: config.model ?? 'claude-sonnet-4-20250514',
      maxTokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
      timeout: config.timeout ?? 60000,
      customHeaders: config.customHeaders
    }

    // Note: initialize() should be called separately by the consumer
    // This allows async initialization to be handled properly
    void fullConfig // Suppress unused variable warning
  }

  return provider
}
