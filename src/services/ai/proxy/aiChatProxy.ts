/**
 * AI Chat Proxy Client
 *
 * Client service for proxying AI chat requests through Supabase Edge Functions.
 * This keeps API keys server-side only, preventing exposure in client bundles.
 *
 * Supports:
 * - Groq (Llama, Mixtral, Gemma)
 * - OpenRouter (Claude, GPT-4, Llama, etc.)
 *
 * @see BUG-1131 in MASTER_PLAN.md - Move All Exposed API Keys to Backend Proxy
 */

import { supabase } from '@/services/auth/supabase'
import type {
  AIResponse,
  AIStreamChunk,
  AITokenUsage,
} from '@/types/ai'
import { AIProvider as AIProviderEnum, AIErrorCode, createAIProviderError } from '@/types/ai'
// TASK-1186: Use Tauri HTTP for CORS-free requests in desktop app
import { tauriFetch } from '../utils/tauriHttp'

// ============================================================================
// Types
// ============================================================================

/**
 * Provider types supported by the proxy
 */
export type ProxyProvider = 'groq' | 'openrouter'

/**
 * Message format for proxy requests
 */
export interface ProxyMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Request payload for the proxy
 */
export interface ProxyAIChatRequest {
  provider: ProxyProvider
  messages: ProxyMessage[]
  model?: string
  stream?: boolean
  max_tokens?: number
  temperature?: number
  top_p?: number
  stop_sequences?: string[]
}

/**
 * OpenAI-compatible response format (used by both Groq and OpenRouter)
 */
interface OpenAICompatibleResponse {
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the Edge Function URL based on environment
 */
function getProxyUrl(): string {
  // In development with local Supabase, use localhost
  const useLocalSupabase = import.meta.env.VITE_USE_LOCAL_SUPABASE === 'true'
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''

  if (useLocalSupabase) {
    return 'http://localhost:54321/functions/v1/ai-chat-proxy'
  }

  // For production, resolve the URL properly
  if (supabaseUrl.startsWith('/')) {
    // Relative URL - resolve from current origin
    return `${window.location.origin}${supabaseUrl}/functions/v1/ai-chat-proxy`
  }

  // Full URL
  return `${supabaseUrl}/functions/v1/ai-chat-proxy`
}

/**
 * Parse OpenAI-compatible response to standard AIResponse
 */
function parseResponse(data: OpenAICompatibleResponse, latencyMs: number): AIResponse {
  const choice = data.choices[0]

  return {
    id: data.id,
    content: choice?.message?.content || '',
    provider: AIProviderEnum.OPENAI, // Both use OpenAI-compatible format
    model: data.model,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
    latencyMs,
    finishReason: choice?.finish_reason,
    raw: data,
  }
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Make a non-streaming AI chat request through the proxy
 *
 * @param request - Chat request parameters
 * @param signal - Optional abort signal for cancellation
 * @returns Promise resolving to AIResponse
 *
 * @example
 * ```typescript
 * const response = await proxyAIChat({
 *   provider: 'groq',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   model: 'llama-3.3-70b-versatile'
 * })
 * console.log(response.content)
 * ```
 */
export async function proxyAIChat(
  request: ProxyAIChatRequest,
  signal?: AbortSignal
): Promise<AIResponse> {
  const startTime = Date.now()
  const proxyUrl = getProxyUrl()

  // Get auth token if available
  let authHeader: Record<string, string> = {}
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      authHeader = { 'Authorization': `Bearer ${session.access_token}` }
    }
  }

  try {
    const response = await tauriFetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        provider: request.provider,
        messages: request.messages,
        model: request.model,
        stream: false,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
        stop_sequences: request.stop_sequences,
      }),
      signal,
    })

    const latencyMs = Date.now() - startTime

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}`

      throw createAIProviderError(
        response.status === 503 ? AIErrorCode.SERVICE_ERROR :
        response.status === 401 ? AIErrorCode.AUTH_ERROR :
        response.status === 429 ? AIErrorCode.RATE_LIMIT :
        AIErrorCode.UNKNOWN,
        errorMessage,
        AIProviderEnum.OPENAI
      )
    }

    const data = await response.json()
    return parseResponse(data as OpenAICompatibleResponse, latencyMs)

  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw createAIProviderError(
        AIErrorCode.TIMEOUT,
        'Request was cancelled',
        AIProviderEnum.OPENAI
      )
    }

    if (error && typeof error === 'object' && 'code' in error) {
      // Already an AIProviderError
      throw error
    }

    throw createAIProviderError(
      AIErrorCode.NETWORK_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
      AIProviderEnum.OPENAI
    )
  }
}

/**
 * Make a streaming AI chat request through the proxy
 *
 * @param request - Chat request parameters
 * @param signal - Optional abort signal for cancellation
 * @returns AsyncGenerator yielding AIStreamChunks
 *
 * @example
 * ```typescript
 * for await (const chunk of proxyAIChatStream({
 *   provider: 'groq',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   stream: true
 * })) {
 *   process.stdout.write(chunk.content)
 *   if (chunk.done) break
 * }
 * ```
 */
export async function* proxyAIChatStream(
  request: ProxyAIChatRequest,
  signal?: AbortSignal
): AsyncGenerator<AIStreamChunk, void, unknown> {
  const proxyUrl = getProxyUrl()

  // Get auth token if available
  let authHeader: Record<string, string> = {}
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      authHeader = { 'Authorization': `Bearer ${session.access_token}` }
    }
  }

  try {
    const response = await tauriFetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({
        provider: request.provider,
        messages: request.messages,
        model: request.model,
        stream: true,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        top_p: request.top_p,
        stop_sequences: request.stop_sequences,
      }),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}`

      throw createAIProviderError(
        response.status === 503 ? AIErrorCode.SERVICE_ERROR :
        response.status === 401 ? AIErrorCode.AUTH_ERROR :
        response.status === 429 ? AIErrorCode.RATE_LIMIT :
        AIErrorCode.UNKNOWN,
        errorMessage,
        AIProviderEnum.OPENAI
      )
    }

    if (!response.body) {
      throw createAIProviderError(
        AIErrorCode.SERVICE_ERROR,
        'Response body is null',
        AIProviderEnum.OPENAI
      )
    }

    // Process SSE stream (OpenAI-compatible format)
    yield* parseSSEStream(response.body)

  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      yield { content: '', done: true }
      return
    }

    if (error && typeof error === 'object' && 'code' in error) {
      throw error
    }

    throw createAIProviderError(
      AIErrorCode.NETWORK_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
      AIProviderEnum.OPENAI
    )
  }
}

/**
 * Parse Server-Sent Events stream (OpenAI-compatible format)
 */
async function* parseSSEStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<AIStreamChunk, void, unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalUsage: AITokenUsage | undefined

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
        if (!line.startsWith('data:')) continue

        const dataStr = line.slice(5).trim()

        if (dataStr === '[DONE]') {
          yield { content: '', done: true, usage: finalUsage }
          return
        }

        try {
          const chunk = JSON.parse(dataStr)

          if (!chunk.choices || chunk.choices.length === 0) continue

          const choice = chunk.choices[0]
          const content = choice.delta?.content || ''

          if (chunk.usage) {
            finalUsage = {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            }
          }

          yield {
            content,
            done: choice.finish_reason !== null,
            usage: chunk.usage ? finalUsage : undefined,
            finishReason: choice.finish_reason || undefined,
          }

          if (choice.finish_reason) {
            return
          }
        } catch (parseError) {
          // Log but continue processing other chunks
          console.warn('[AIProxy] Failed to parse SSE chunk:', line)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Check if the AI proxy is available and configured for a provider.
 * Uses a lightweight OPTIONS/POST request instead of a full chat completion.
 *
 * @param provider - Provider to check
 * @returns Promise resolving to availability status
 */
export async function isProxyAvailable(provider: ProxyProvider): Promise<boolean> {
  try {
    const proxyUrl = getProxyUrl()

    // Get auth token if available
    let authHeader: Record<string, string> = {}
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        authHeader = { 'Authorization': `Bearer ${session.access_token}` }
      }
    }

    // TASK-1265: Health check using OPTIONS to avoid consuming API tokens.
    // The Edge Function returns 200 'ok' for OPTIONS requests without
    // forwarding to the actual AI provider.
    const response = await tauriFetch(proxyUrl, {
      method: 'OPTIONS',
      headers: authHeader,
      signal: AbortSignal.timeout(5000),
    })

    return response.ok
  } catch {
    return false
  }
}
