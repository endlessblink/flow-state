/**
 * DeepSeek Provider Tests
 *
 * Tests the DeepSeek AI provider implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DeepSeekProvider, createDeepSeekProvider } from '../deepseek'
import { AIProvider, AIErrorCode } from '@/types/ai'

// Mock fetch
global.fetch = vi.fn()

describe('DeepSeekProvider', () => {
  let provider: DeepSeekProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = createDeepSeekProvider('test-api-key', {
      endpoint: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      maxTokens: 2048,
      temperature: 0.7
    })
  })

  describe('initialization', () => {
    it('should initialize with correct configuration', async () => {
      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'test-api-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      expect(provider.isInitialized).toBe(true)
      expect(provider.config.endpoint).toBe('https://api.deepseek.com/v1')
      expect(provider.config.model).toBe('deepseek-chat')
    })
  })

  describe('complete', () => {
    it('should generate a non-streaming completion', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 9,
          total_tokens: 19
        }
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'test-api-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      const response = await provider.complete([
        { role: 'user', content: 'Hello!' }
      ])

      expect(response.content).toBe('Hello! How can I help you today?')
      expect(response.provider).toBe(AIProvider.OPENAI)
      expect(response.model).toBe('deepseek-chat')
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 9,
        totalTokens: 19
      })
    })

    it('should include system prompt in request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      }

      let capturedRequest: any

      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url, options) => {
        capturedRequest = JSON.parse(options.body)
        return {
          ok: true,
          json: async () => mockResponse
        }
      })

      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'test-api-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      await provider.complete(
        [{ role: 'user', content: 'Hello!' }],
        { systemPrompt: 'You are a helpful assistant.' }
      )

      expect(capturedRequest.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.'
      })
      expect(capturedRequest.messages[1]).toEqual({
        role: 'user',
        content: 'Hello!'
      })
    })

    it('should handle HTTP errors correctly', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: { message: 'Invalid API key' }
        })
      })

      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'invalid-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      await expect(
        provider.complete([{ role: 'user', content: 'Hello!' }])
      ).rejects.toMatchObject({
        code: AIErrorCode.AUTH_ERROR,
        message: 'Invalid API key',
        provider: AIProvider.OPENAI
      })
    })
  })

  describe('stream', () => {
    it('should generate a streaming completion', async () => {
      const sseData = [
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"deepseek-chat","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}\n',
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"deepseek-chat","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}\n',
        'data: [DONE]\n'
      ]

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          for (const line of sseData) {
            controller.enqueue(encoder.encode(line))
          }
          controller.close()
        }
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: stream
      })

      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'test-api-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      const chunks: string[] = []
      const generator = provider.stream([{ role: 'user', content: 'Hi!' }])

      for await (const chunk of generator) {
        if (chunk.content) {
          chunks.push(chunk.content)
        }
      }

      expect(chunks).toEqual(['Hello', '!'])
    })
  })

  describe('getModels', () => {
    it('should fetch available models', async () => {
      const mockModelsResponse = {
        object: 'list',
        data: [
          {
            id: 'deepseek-chat',
            object: 'model',
            created: 1677649963,
            owned_by: 'deepseek'
          },
          {
            id: 'deepseek-reasoner',
            object: 'model',
            created: 1677649963,
            owned_by: 'deepseek'
          }
        ]
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockModelsResponse
      })

      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'test-api-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      const models = await provider.getModels()

      expect(models).toHaveLength(2)
      expect(models[0].id).toBe('deepseek-chat')
      expect(models[0].description).toBe('DeepSeek V3.2 - General purpose chat model')
      expect(models[0].contextWindow).toBe(64000)
      expect(models[1].id).toBe('deepseek-reasoner')
      expect(models[1].description).toBe('DeepSeek R1 - Reasoning model')
    })
  })

  describe('healthCheck', () => {
    it('should return healthy status when API is accessible', async () => {
      const mockModelsResponse = {
        object: 'list',
        data: [
          { id: 'deepseek-chat', object: 'model', created: 1677649963, owned_by: 'deepseek' }
        ]
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        // Add a small delay to ensure latencyMs > 0
        await new Promise(resolve => setTimeout(resolve, 1))
        return {
          ok: true,
          json: async () => mockModelsResponse
        }
      })

      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'test-api-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.availableModels).toEqual(['deepseek-chat'])
      expect(health.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('should return unhealthy status when API is not accessible', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'test-api-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.error).toBeDefined()
    })
  })

  describe('abort', () => {
    it('should abort in-flight requests', async () => {
      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'test-api-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      // Mock a slow request that respects abort signal
      ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url, options) => new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal
          if (signal) {
            signal.addEventListener('abort', () => {
              const error = new Error('Request aborted')
              error.name = 'AbortError'
              reject(error)
            })
          }
        })
      )

      const completionPromise = provider.complete([{ role: 'user', content: 'Hello!' }])

      // Abort after a short delay
      setTimeout(() => provider.abort(), 10)

      await expect(completionPromise).rejects.toMatchObject({
        code: AIErrorCode.TIMEOUT,
        message: 'Request was aborted'
      })
    }, 10000)
  })

  describe('dispose', () => {
    it('should clean up resources', async () => {
      await provider.initialize({
        provider: AIProvider.OPENAI,
        enabled: true,
        endpoint: 'https://api.deepseek.com/v1',
        apiKey: 'test-api-key',
        model: 'deepseek-chat',
        maxTokens: 2048,
        temperature: 0.7,
        timeout: 60000
      })

      provider.dispose()

      expect(provider.isInitialized).toBe(false)
    })
  })
})
