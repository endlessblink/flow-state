/**
 * OpenRouter Proxy Provider
 *
 * Implements the AIProvider interface for OpenRouter via Supabase Edge Function proxy.
 * API keys are kept server-side only, preventing exposure in client bundles.
 *
 * OpenRouter provides access to many models through a single API:
 * - Claude (Anthropic)
 * - GPT-4 (OpenAI)
 * - Llama (Meta)
 * - Mistral
 * - And many more
 *
 * @see https://openrouter.ai/docs
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
import { OPENROUTER_MODELS, toAIModels } from '@/config/aiModels'

// ============================================================================
// OpenRouter Proxy Provider Implementation
// ============================================================================

const DEFAULT_MODEL = 'moonshotai/kimi-k2-instruct-0905'
const DEFAULT_TIMEOUT = 60000

/**
 * OpenRouter AI provider implementation using Edge Function proxy.
 * All API calls are routed through Supabase Edge Functions to keep keys secure.
 */
export class OpenRouterProxyProvider implements AIProvider {
  readonly type: AIProviderType = 'openai' // OpenRouter uses OpenAI-compatible format
  readonly name = 'OpenRouter (Proxy)'
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
      const available = await isProxyAvailable('openrouter')
      this.initialized = available
      return this.initialized
    } catch (error) {
      console.error('[OpenRouterProxy] Initialization failed:', error)
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
      const available = await isProxyAvailable('openrouter')

      this.lastHealthCheck = {
        isHealthy: available,
        status: available ? 'connected' : 'error',
        lastConnected: available ? new Date() : undefined,
        lastError: available ? undefined : 'Proxy not available or OpenRouter service not configured',
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
    return toAIModels(OPENROUTER_MODELS)
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
        provider: 'openrouter',
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
      console.error('[OpenRouterProxy] Generation failed:', error)
      throw error
    }
  }

  async *generateStream(
    messages: ChatMessage[],
    options: GenerateOptions
  ): AsyncGenerator<StreamChunk> {
    try {
      const stream = proxyAIChatStream({
        provider: 'openrouter',
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
      console.error('[OpenRouterProxy] Stream generation failed:', error)
      yield { content: '', done: true, error: String(error) }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapFinishReason(reason?: string): GenerateResponse['stopReason'] {
    switch (reason) {
      case 'stop':
      case 'end_turn':
        return 'stop'
      case 'length':
      case 'max_tokens':
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
 * Create a new OpenRouter proxy provider instance.
 * No API key needed - it's stored server-side.
 *
 * @param config - Optional configuration overrides
 * @returns OpenRouter proxy provider
 */
export function createOpenRouterProxyProvider(
  config: { defaultModel?: string; timeout?: number } = {}
): OpenRouterProxyProvider {
  return new OpenRouterProxyProvider(config)
}
