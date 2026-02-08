/**
 * Supabase Edge Function: ai-chat-proxy
 *
 * Proxies AI chat requests to Groq and OpenRouter APIs.
 * API keys are read from Supabase secrets (synced from Doppler).
 *
 * This keeps API keys secure and allows dynamic updates via Doppler
 * without rebuilding the frontend.
 *
 * Supported providers:
 * - groq: Groq LLM API (Llama, Mixtral, Gemma models)
 * - openrouter: OpenRouter API (access to Claude, GPT-4, Llama, etc.)
 *
 * @see BUG-1131 in MASTER_PLAN.md - Move All Exposed API Keys to Backend Proxy
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIChatRequest {
  provider: 'groq' | 'openrouter'
  messages: ChatMessage[]
  model?: string
  stream?: boolean
  max_tokens?: number
  temperature?: number
  top_p?: number
  stop_sequences?: string[]
}

// ============================================================================
// CORS Headers
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ============================================================================
// Provider Configuration
// ============================================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Default models
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'
const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet' // Can be changed to any model

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get API key for a provider from environment variables
 */
function getApiKey(provider: 'groq' | 'openrouter'): string | null {
  if (provider === 'groq') {
    return Deno.env.get('GROQ_API_KEY') || null
  }
  if (provider === 'openrouter') {
    return Deno.env.get('OPENROUTER_API_KEY') || null
  }
  return null
}

/**
 * Build request body (OpenAI-compatible format for both providers)
 */
function buildRequestBody(request: AIChatRequest, defaultModel: string): object {
  return {
    model: request.model || defaultModel,
    messages: request.messages,
    stream: request.stream ?? false,
    max_tokens: request.max_tokens,
    temperature: request.temperature,
    top_p: request.top_p,
    stop: request.stop_sequences,
  }
}

/**
 * Handle Groq API request
 */
async function handleGroqRequest(
  request: AIChatRequest,
  apiKey: string
): Promise<Response> {
  const body = buildRequestBody(request, DEFAULT_GROQ_MODEL)

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Groq API error:', response.status, errorText)
    return new Response(
      JSON.stringify({ error: 'Groq API error', details: errorText }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Handle streaming response
  if (request.stream && response.body) {
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // Handle non-streaming response
  const data = await response.json()
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Handle OpenRouter API request
 */
async function handleOpenRouterRequest(
  request: AIChatRequest,
  apiKey: string
): Promise<Response> {
  const body = buildRequestBody(request, DEFAULT_OPENROUTER_MODEL)

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': Deno.env.get('SITE_URL') || 'https://in-theflow.com', // Required by OpenRouter
      'X-Title': 'FlowState', // Optional but recommended
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('OpenRouter API error:', response.status, errorText)
    return new Response(
      JSON.stringify({ error: 'OpenRouter API error', details: errorText }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Handle streaming response
  if (request.stream && response.body) {
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // Handle non-streaming response
  const data = await response.json()
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const request: AIChatRequest = await req.json()

    // Validate provider
    if (!request.provider || !['groq', 'openrouter'].includes(request.provider)) {
      return new Response(
        JSON.stringify({ error: 'Invalid provider. Supported: groq, openrouter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate messages
    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get API key
    const apiKey = getApiKey(request.provider)
    if (!apiKey) {
      const envVar = request.provider === 'groq' ? 'GROQ_API_KEY' : 'OPENROUTER_API_KEY'
      console.error(`${envVar} not configured in Supabase secrets`)
      return new Response(
        JSON.stringify({ error: `${request.provider} service not configured` }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route to appropriate handler
    if (request.provider === 'groq') {
      return await handleGroqRequest(request, apiKey)
    } else {
      return await handleOpenRouterRequest(request, apiKey)
    }

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
