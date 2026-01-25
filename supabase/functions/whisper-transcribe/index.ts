/**
 * Supabase Edge Function: whisper-transcribe
 *
 * Proxies audio transcription requests to Groq Whisper API.
 * API key is read from Supabase secrets (synced from Doppler).
 *
 * This keeps the API key secure and allows dynamic updates via Doppler
 * without rebuilding the frontend.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get API key from Supabase secrets (synced from Doppler)
    const groqApiKey = Deno.env.get('GROQ_API_KEY')

    if (!groqApiKey) {
      console.error('GROQ_API_KEY not configured in Supabase secrets')
      return new Response(
        JSON.stringify({ error: 'Whisper service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse the incoming form data
    const formData = await req.formData()
    const audioFile = formData.get('file')
    const model = formData.get('model') || 'whisper-large-v3-turbo'
    const language = formData.get('language') // Optional: can be auto-detected

    if (!audioFile || !(audioFile instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build form data for Groq API
    const groqFormData = new FormData()
    groqFormData.append('file', audioFile)
    groqFormData.append('model', model as string)
    groqFormData.append('response_format', 'verbose_json')

    if (language) {
      groqFormData.append('language', language as string)
    }

    // Call Groq Whisper API
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: groqFormData,
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('Groq API error:', groqResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Transcription failed', details: errorText }),
        { status: groqResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await groqResponse.json()

    return new Response(
      JSON.stringify({
        text: result.text,
        language: result.language,
        duration: result.duration,
        segments: result.segments,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
