import { supabase } from '@/composables/supabase/_infrastructure'
import type { TranscriptionProvider, TranscriptionRequest, TranscriptionResult } from './types'

const getWhisperEndpoint = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  if (supabaseUrl.startsWith('/')) {
    return `${window.location.origin}${supabaseUrl}/functions/v1/whisper-transcribe`
  }
  return `${supabaseUrl}/functions/v1/whisper-transcribe`
}

const getAudioExtension = (mimeType: string) => {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export type WhisperLanguage = 'auto' | 'he' | 'en'

export interface WhisperCloudOptions {
  model?: 'whisper-large-v3' | 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en'
  /**
   * BUG-1885: Spoken language hint.
   * - 'auto' (default): omit `language` so Whisper auto-detects. Required for mixed
   *   Hebrew+English dictation — forcing a single language transliterates the other
   *   into gibberish.
   * - 'he' | 'en': forward the language for users who dictate in one language only.
   */
  language?: WhisperLanguage
}

// Neutral, language-agnostic hint preserving English tech terms verbatim. A prior
// all-Hebrew prompt forced Hebrew-script output for English speech (BUG-1885), so it
// is only used when the user explicitly forces a language; auto mode sends no prompt.
const TECH_TERM_PROMPT = 'Preserve these terms as-is: email, meeting, Zoom, GitHub, Slack, '
  + 'FlowState, Supabase, deadline, update, review, deploy, PR, bug, feature, sprint, '
  + 'backlog, standup, sync, TODO, ASAP, FYI.'

export function createWhisperCloudProvider(options: WhisperCloudOptions = {}): TranscriptionProvider {
  const model = options.model || 'whisper-large-v3'
  const language: WhisperLanguage = options.language || 'auto'

  return {
    id: 'whisper-cloud',
    async status() {
      return { id: 'whisper-cloud', available: true, modelConfigured: true }
    },
    async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
      const formData = new FormData()
      formData.append('file', request.audioBlob, `audio.${getAudioExtension(request.mimeType)}`)
      formData.append('model', model)
      // BUG-1885: only force a language when the user explicitly picked one. In 'auto'
      // mode we omit both `language` and the prompt so Whisper detects the dominant
      // language instead of transliterating English dictation into Hebrew script.
      if (language !== 'auto') {
        formData.append('language', language)
        formData.append('prompt', TECH_TERM_PROMPT)
      }
      formData.append('temperature', '0')

      const headers: Record<string, string> = {}
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }

      const response = await fetch(getWhisperEndpoint(), {
        method: 'POST',
        headers,
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      let transcript = data.text || ''

      if (data.segments && data.segments.length > 0) {
        const filtered = data.segments
          .filter((seg: { no_speech_prob?: number; avg_logprob?: number; text?: string }) => {
            const noSpeechProb = seg.no_speech_prob ?? 0
            const avgLogprob = seg.avg_logprob ?? 0
            return noSpeechProb < 0.6 && avgLogprob > -1.0
          })
          .map((seg: { text?: string }) => seg.text?.trim() || '')
          .filter(Boolean)

        transcript = filtered.length > 0 ? filtered.join(' ') : transcript
      }

      return {
        transcript,
        language: data.language || 'unknown',
        duration: data.duration || request.duration || 0,
        segments: data.segments,
        provider: 'whisper-cloud'
      }
    }
  }
}
