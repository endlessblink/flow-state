/**
 * Groq Proxy Provider
 *
 * Implements the AIProvider interface for Groq via Supabase Edge Function proxy.
 * API keys are kept server-side only, preventing exposure in client bundles.
 *
 * @see BUG-1131 in MASTER_PLAN.md - Move All Exposed API Keys to Backend Proxy
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
} from '../types'
import { proxyAIChat, proxyAIChatStream, isProxyAvailable } from '../proxy/aiChatProxy'

// ============================================================================
// Groq Proxy Provider Implementation
// ============================================================================

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const DEFAULT_TIMEOUT = 60000

/**
 * Groq AI provider implementation using Edge Function proxy.
 * All API calls are routed through Supabase Edge Functions to keep keys secure.
 */
export class GroqProxyProvider implements AIProvider {
  readonly type: AIProviderType = 'groq'
  readonly name = 'Groq (Proxy)'
  readonly requiresApiKey = false // Key is server-side only

  private initialized = false
  private lastHealthCheck: ProviderHealthStatus | null = null
  private defaultModel: string
  private timeout: number

  constructor(config: { defaultModel?: string; timeout?: number } = {}) {
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<boolean> {
    if (this.initialized) return true

    try {
      // Check if proxy is available by making a test request
      const available = await isProxyAvailable('groq')
      this.initialized = available
      return this.initialized
    } catch (error) {
      console.error('[GroqProxy] Initialization failed:', error)
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
      const available = await isProxyAvailable('groq')

      this.lastHealthCheck = {
        isHealthy: available,
        status: available ? 'connected' : 'error',
        lastConnected: available ? new Date() : undefined,
        lastError: available ? undefined : 'Proxy not available or Groq service not configured',
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
    return [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        description: 'Fast, high quality general purpose model',
        contextLength: 128000,
        supportsStreaming: true,
        capabilities: ['chat', 'completion'],
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        description: 'Ultra-fast, efficient model',
        contextLength: 128000,
        supportsStreaming: true,
        capabilities: ['chat', 'completion'],
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        description: 'Large context window MoE model',
        contextLength: 32768,
        supportsStreaming: true,
        capabilities: ['chat', 'completion'],
      },
      {
        id: 'gemma2-9b-it',
        name: 'Gemma 2 9B',
        description: 'Google open model',
        contextLength: 8192,
        supportsStreaming: true,
        capabilities: ['chat', 'completion'],
      },
    ]
  }

  // ============================================================================
  // Generation
  // ============================================================================

  async generate(
    messages: ChatMessage[],
    options: GenerateOptions
  ): Promise<GenerateResponse> {
    const startTime = Date.now()

    try {
      const signal = AbortSignal.timeout(options.timeout || this.timeout)
      const response = await proxyAIChat({
        provider: 'groq',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        model: options.model || this.defaultModel,
        stream: false,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stop_sequences: options.stopSequences,
        tools: options.tools?.map(t => ({ type: t.type, function: t.function })),
        tool_choice: options.toolChoice,
      }, signal)

      return {
        content: response.content,
        model: response.model,
        totalTokens: response.usage?.totalTokens,
        promptTokens: response.usage?.promptTokens,
        completionTokens: response.usage?.completionTokens,
        generationTimeMs: Date.now() - startTime,
        stopReason: this.mapFinishReason(response.finishReason),
      }
    } catch (error) {
      console.error('[GroqProxy] Generation failed:', error)
      throw error
    }
  }

  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions
  ): AsyncGenerator<StreamChunk> {
    try {
      const stream = proxyAIChatStream({
        provider: 'groq',
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        model: options.model || this.defaultModel,
        stream: true,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stop_sequences: options.stopSequences,
        tools: options.tools?.map(t => ({ type: t.type, function: t.function })),
        tool_choice: options.toolChoice,
      })

      for await (const chunk of stream) {
        yield {
          content: chunk.content,
          done: chunk.done,
          toolCalls: chunk.toolCalls,
        }

        if (chunk.done) break
      }
    } catch (error) {
      console.error('[GroqProxy] Stream generation failed:', error)
      yield { content: '', done: true, error: String(error) }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapFinishReason(reason?: string): GenerateResponse['stopReason'] {
    switch (reason) {
      case 'stop':
        return 'stop'
      case 'length':
        return 'length'
      default:
        return 'stop'
    }
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
 * Create a new Groq proxy provider instance.
 * No API key needed - it's stored server-side.
 *
 * @param config - Optional configuration overrides
 * @returns Groq proxy provider
 */
export function createGroqProxyProvider(
  config: { defaultModel?: string; timeout?: number } = {}
): GroqProxyProvider {
  return new GroqProxyProvider(config)
}
