/**
 * Groq AI Provider
 *
 * Implements the AIProvider interface for Groq's API.
 * Features:
 * - OpenAI-compatible API format (https://api.groq.com/openai/v1)
 * - Ultra-fast inference with Groq LPU
 * - Support for Llama, Mixtral, and Gemma models
 * - Streaming responses via Server-Sent Events
 *
 * Supported Models:
 * - llama-3.3-70b-versatile - Fast, high quality general purpose
 * - llama-3.1-8b-instant - Ultra-fast, smaller model
 * - mixtral-8x7b-32768 - Large context window
 * - gemma2-9b-it - Google's Gemma 2
 *
 * @see https://console.groq.com/docs/
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 */

import type {
  AIProvider,
  AIProviderType,
  AIModel,
  ChatMessage,
  GenerateOptions,
  GenerateResponse,
  StreamChunk,
  ProviderHealthStatus,
  GroqConfig,
} from '../types'
// TASK-1186: Use Tauri HTTP for CORS-free requests in desktop app
import { tauriFetch } from '../utils/tauriHttp'

// ============================================================================
// Groq API Types (OpenAI-compatible)
// ============================================================================

/**
 * Groq API request format (OpenAI-compatible).
 */
interface GroqChatRequest {
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
 * Groq API response format (OpenAI-compatible).
 */
interface GroqChatResponse {
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
    queue_time?: number
    prompt_time?: number
    completion_time?: number
    total_time?: number
  }
}

/**
 * Groq streaming chunk format (OpenAI-compatible SSE).
 */
interface GroqStreamChunk {
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
 * Groq models list response.
 */
interface GroqModelsResponse {
  object: string
  data: Array<{
    id: string
    object: string
    created: number
    owned_by: string
    active: boolean
    context_window: number
  }>
}

// ============================================================================
// Groq Provider Configuration
// ============================================================================

const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const DEFAULT_TIMEOUT = 60000

// ============================================================================
// Groq Provider Implementation
// ============================================================================

/**
 * Groq AI provider implementation.
 *
 * Uses Groq's OpenAI-compatible API for ultra-fast inference.
 */
export class GroqProvider implements AIProvider {
  readonly type: AIProviderType = 'groq'
  readonly name = 'Groq'
  readonly requiresApiKey = true

  private apiKey: string
  private config: GroqConfig
  private initialized = false
  private lastHealthCheck: ProviderHealthStatus | null = null

  constructor(config: { apiKey: string } & Partial<GroqConfig>) {
    this.apiKey = config.apiKey
    this.config = {
      enabled: config.enabled ?? true,
      apiKey: config.apiKey,
      defaultModel: config.defaultModel ?? DEFAULT_MODEL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<boolean> {
    if (this.initialized) return true

    try {
      // Verify API key by fetching models
      const health = await this.getHealth()
      this.initialized = health.isHealthy
      return this.initialized
    } catch (error) {
      console.error('[Groq] Initialization failed:', error)
      return false
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.initialized) return false
    const health = await this.getHealth()
    return health.isHealthy
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async getHealth(): Promise<ProviderHealthStatus> {
    const startTime = Date.now()

    try {
      const response = await tauriFetch(`${GROQ_API_ENDPOINT}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        const error = await this.parseError(response)
        this.lastHealthCheck = {
          isHealthy: false,
          status: 'error',
          lastError: error,
          latencyMs: Date.now() - startTime,
        }
        return this.lastHealthCheck
      }

      this.lastHealthCheck = {
        isHealthy: true,
        status: 'connected',
        lastConnected: new Date(),
        latencyMs: Date.now() - startTime,
      }
      return this.lastHealthCheck
    } catch (error) {
      this.lastHealthCheck = {
        isHealthy: false,
        status: 'error',
        lastError: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      }
      return this.lastHealthCheck
    }
  }

  // ============================================================================
  // Model Management
  // ============================================================================

  async listModels(): Promise<AIModel[]> {
    try {
      const response = await tauriFetch(`${GROQ_API_ENDPOINT}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(await this.parseError(response))
      }

      const data: GroqModelsResponse = await response.json()

      return data.data
        .filter(model => model.active)
        .map(model => ({
          id: model.id,
          name: model.id,
          description: this.getModelDescription(model.id),
          contextLength: model.context_window,
          supportsStreaming: true,
          capabilities: ['chat', 'completion'] as const,
        }))
    } catch (error) {
      console.error('[Groq] Failed to list models:', error)
      return []
    }
  }

  // ============================================================================
  // Generation
  // ============================================================================

  async generate(
    messages: ChatMessage[],
    options: GenerateOptions
  ): Promise<GenerateResponse> {
    const startTime = Date.now()

    const request: GroqChatRequest = {
      model: options.model || this.config.defaultModel || DEFAULT_MODEL,
      messages: this.formatMessages(messages, options.systemPrompt),
      stream: false,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stop: options.stopSequences,
    }

    try {
      const response = await tauriFetch(`${GROQ_API_ENDPOINT}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(options.timeout || this.config.timeout || DEFAULT_TIMEOUT),
      })

      if (!response.ok) {
        throw new Error(await this.parseError(response))
      }

      const data: GroqChatResponse = await response.json()

      if (!data.choices || data.choices.length === 0) {
        throw new Error('Groq returned empty choices')
      }

      const choice = data.choices[0]

      return {
        content: choice.message.content,
        model: data.model,
        totalTokens: data.usage?.total_tokens,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        generationTimeMs: Date.now() - startTime,
        stopReason: this.mapFinishReason(choice.finish_reason),
      }
    } catch (error) {
      console.error('[Groq] Generation failed:', error)
      throw error
    }
  }

  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions
  ): AsyncGenerator<StreamChunk> {
    const request: GroqChatRequest = {
      model: options.model || this.config.defaultModel || DEFAULT_MODEL,
      messages: this.formatMessages(messages, options.systemPrompt),
      stream: true,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stop: options.stopSequences,
    }

    try {
      const response = await tauriFetch(`${GROQ_API_ENDPOINT}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(options.timeout || this.config.timeout || DEFAULT_TIMEOUT),
      })

      if (!response.ok) {
        throw new Error(await this.parseError(response))
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      yield* this.processSSEStream(response.body)
    } catch (error) {
      console.error('[Groq] Stream generation failed:', error)
      yield { content: '', done: true, error: String(error) }
    }
  }

  // ============================================================================
  // SSE Stream Processing
  // ============================================================================

  private async *processSSEStream(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<StreamChunk> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

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
            yield { content: '', done: true }
            return
          }

          try {
            const chunk: GroqStreamChunk = JSON.parse(dataStr)

            if (!chunk.choices || chunk.choices.length === 0) continue

            const choice = chunk.choices[0]
            const content = choice.delta.content || ''

            yield {
              content,
              done: choice.finish_reason !== null,
            }

            if (choice.finish_reason) {
              return
            }
          } catch (parseError) {
            console.warn('[Groq] Failed to parse SSE chunk:', line)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private formatMessages(
    messages: ChatMessage[],
    systemPrompt?: string
  ): GroqChatRequest['messages'] {
    const formatted = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    if (systemPrompt) {
      formatted.unshift({
        role: 'system' as const,
        content: systemPrompt,
      })
    }

    return formatted
  }

  private async parseError(response: Response): Promise<string> {
    try {
      const errorData = await response.json()
      if (errorData.error?.message) {
        return errorData.error.message
      }
    } catch {
      // Failed to parse error response
    }
    return `HTTP ${response.status}: ${response.statusText}`
  }

  private mapFinishReason(reason: string): GenerateResponse['stopReason'] {
    switch (reason) {
      case 'stop':
        return 'stop'
      case 'length':
        return 'length'
      default:
        return 'stop'
    }
  }

  private getModelDescription(modelId: string): string {
    if (modelId.includes('llama-3.3-70b')) {
      return 'Llama 3.3 70B - Fast, high quality general purpose'
    }
    if (modelId.includes('llama-3.1-8b')) {
      return 'Llama 3.1 8B - Ultra-fast, efficient model'
    }
    if (modelId.includes('mixtral')) {
      return 'Mixtral 8x7B - Large context window MoE model'
    }
    if (modelId.includes('gemma')) {
      return 'Gemma 2 - Google open model'
    }
    return 'Groq model'
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.initialized = false
    this.lastHealthCheck = null
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Groq provider instance.
 *
 * @param apiKey - Groq API key (from VITE_GROQ_API)
 * @param config - Optional configuration overrides
 * @returns Initialized Groq provider
 *
 * @example
 * ```typescript
 * const provider = createGroqProvider(import.meta.env.VITE_GROQ_API)
 * await provider.initialize()
 * const response = await provider.generate([
 *   { role: 'user', content: 'Hello!' }
 * ], { model: 'llama-3.3-70b-versatile' })
 * ```
 */
export function createGroqProvider(
  apiKey: string,
  config: Partial<GroqConfig> = {}
): GroqProvider {
  return new GroqProvider({
    ...config,
    apiKey,
  })
}

/**
 * Auto-detect and create a Groq provider from environment variables.
 * Returns null if API key is not found.
 *
 * @param config - Optional configuration overrides
 * @returns Groq provider or null
 */
export async function autoDetectGroq(
  config: Partial<GroqConfig> = {}
): Promise<GroqProvider | null> {
  const apiKey = import.meta.env.VITE_GROQ_API

  if (!apiKey) {
    console.warn('[Groq] No API key found in VITE_GROQ_API')
    return null
  }

  const provider = createGroqProvider(apiKey, config)
  const success = await provider.initialize()

  if (!success) {
    console.warn('[Groq] Initialization failed')
    provider.dispose()
    return null
  }

  return provider
}
