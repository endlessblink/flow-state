/**
 * TASK-1667: Edge Function Tests (5 tests)
 *
 * Tests for the ai-chat-proxy and google-calendar-proxy edge function clients:
 * 1. Edge function invoke uses correct function name / URL
 * 2. Request payload matches expected shape
 * 3. Response parsed correctly
 * 4. Error response handled (non-200 status)
 * 5. Auth header passed to edge function
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// Module-level mocks
// ============================================================================

const mockTauriFetch = vi.fn()
const mockGetSession = vi.fn()

vi.mock('@/services/ai/utils/tauriHttp', () => ({
  tauriFetch: mockTauriFetch,
  tauriFetchWithTimeout: mockTauriFetch,
  isTauriEnvironment: vi.fn().mockReturnValue(false),
}))

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}))

const mockEdgeSupabase = {
  auth: {
    getSession: mockGetSession,
  },
}
vi.mock('@/composables/supabase/_infrastructure', () => ({
  supabase: mockEdgeSupabase,
  getSupabase: vi.fn(() => mockEdgeSupabase),
}))

// ============================================================================
// Tests
// ============================================================================

describe('Edge Function Client — aiChatProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'bearer-test-token' } },
    })

    // Default: mock environment
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('VITE_USE_LOCAL_SUPABASE', 'false')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-test')
  })

  it('1. proxyAIChat calls the correct edge function endpoint URL', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'chat-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama-3.3-70b-versatile',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    }
    mockTauriFetch.mockResolvedValue(mockResponse)

    const { proxyAIChat } = await import('@/services/ai/proxy/aiChatProxy')

    await proxyAIChat({
      provider: 'groq',
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'llama-3.3-70b-versatile',
    })

    expect(mockTauriFetch).toHaveBeenCalledTimes(1)
    const [calledUrl] = mockTauriFetch.mock.calls[0]
    expect(calledUrl).toContain('functions/v1/ai-chat-proxy')
  })

  it('2. request payload contains provider, messages, and model fields', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'chat-456',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama-3.3-70b-versatile',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
    }
    mockTauriFetch.mockResolvedValue(mockResponse)

    const { proxyAIChat } = await import('@/services/ai/proxy/aiChatProxy')

    await proxyAIChat({
      provider: 'groq',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Plan my day' },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 512,
    })

    const [, fetchOptions] = mockTauriFetch.mock.calls[0]
    const body = JSON.parse(fetchOptions.body as string)

    expect(body.provider).toBe('groq')
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].content).toBe('Plan my day')
    expect(body.model).toBe('llama-3.3-70b-versatile')
    expect(body.temperature).toBe(0.7)
    expect(body.max_tokens).toBe(512)
  })

  it('3. response is correctly parsed into AIResponse shape', async () => {
    mockTauriFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'resp-789',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama-3.3-70b-versatile',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'Here is your plan.' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      }),
    })

    const { proxyAIChat } = await import('@/services/ai/proxy/aiChatProxy')

    const result = await proxyAIChat({
      provider: 'groq',
      messages: [{ role: 'user', content: 'Plan my week' }],
    })

    expect(result.content).toBe('Here is your plan.')
    expect(result.id).toBe('resp-789')
    expect(result.model).toBe('llama-3.3-70b-versatile')
    expect(result.usage).toEqual({
      promptTokens: 20,
      completionTokens: 10,
      totalTokens: 30,
    })
    expect(result.finishReason).toBe('stop')
  })

  it('4. non-200 HTTP status throws an error with descriptive message', async () => {
    mockTauriFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({ error: 'Rate limit exceeded' }),
    })

    const { proxyAIChat } = await import('@/services/ai/proxy/aiChatProxy')

    await expect(
      proxyAIChat({
        provider: 'groq',
        messages: [{ role: 'user', content: 'Hello' }],
      })
    ).rejects.toThrow()
  })

  it('5. auth header (Bearer token) is included in the request headers', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'my-jwt-access-token' } },
    })

    mockTauriFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'auth-test',
        object: 'chat.completion',
        created: 1234567890,
        model: 'llama-3.3-70b-versatile',
        choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
    })

    const { proxyAIChat } = await import('@/services/ai/proxy/aiChatProxy')

    await proxyAIChat({
      provider: 'groq',
      messages: [{ role: 'user', content: 'Auth test' }],
    })

    const [, fetchOptions] = mockTauriFetch.mock.calls[0]
    const headers = fetchOptions.headers as Record<string, string>

    expect(headers['Authorization']).toBe('Bearer my-jwt-access-token')
  })
})
