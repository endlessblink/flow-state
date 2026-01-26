/**
 * Groq Whisper Service
 * TASK-1029: Voice Input - Whisper API Integration
 *
 * Uses Groq's Whisper API for speech-to-text transcription.
 * Much cheaper than OpenAI ($0.04/hour vs $0.36/hour) and very fast.
 *
 * @see https://console.groq.com/docs/speech-text
 */

export interface GroqWhisperOptions {
  /** Language code (e.g., 'en', 'he') - auto-detected if not specified */
  language?: string
  /** Model to use (default: whisper-large-v3-turbo for best value) */
  model?: 'whisper-large-v3' | 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en'
  /** Response format */
  responseFormat?: 'json' | 'text' | 'verbose_json'
  /** Temperature for sampling (0-1) */
  temperature?: number
}

export interface GroqWhisperResult {
  text: string
  language?: string
  duration?: number
  error?: string
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

/**
 * Get Groq API key from environment
 */
function getApiKey(): string | null {
  return import.meta.env.VITE_GROQ_API_KEY || null
}

/**
 * Check if Groq Whisper is available (API key configured)
 */
export function isGroqWhisperAvailable(): boolean {
  return !!getApiKey()
}

/**
 * Transcribe audio using Groq Whisper API
 *
 * @param audioBlob - Audio blob (webm, mp3, wav, etc.)
 * @param options - Transcription options
 * @returns Transcription result
 */
export async function transcribeAudio(
  audioBlob: Blob,
  options: GroqWhisperOptions = {}
): Promise<GroqWhisperResult> {
  const apiKey = getApiKey()

  if (!apiKey) {
    return {
      text: '',
      error: 'Groq API key not configured. Add VITE_GROQ_API_KEY to Doppler or .env.local file.'
    }
  }

  const {
    language,
    model = 'whisper-large-v3-turbo',
    responseFormat = 'verbose_json',
    temperature = 0
  } = options

  try {
    // Create form data
    const formData = new FormData()

    // Convert blob to file with proper extension
    const audioFile = new File([audioBlob], 'audio.webm', { type: audioBlob.type || 'audio/webm' })
    formData.append('file', audioFile)
    formData.append('model', model)
    formData.append('response_format', responseFormat)
    formData.append('temperature', temperature.toString())

    // Only set language if specified (otherwise Groq auto-detects)
    if (language) {
      formData.append('language', language)
    }

    console.log('[GroqWhisper] Sending audio for transcription...', {
      size: audioBlob.size,
      type: audioBlob.type,
      model,
      language: language || 'auto'
    })

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      console.error('[GroqWhisper] API error:', errorMessage)
      return {
        text: '',
        error: errorMessage
      }
    }

    const data = await response.json()
    console.log('[GroqWhisper] Transcription complete:', data)

    return {
      text: data.text || '',
      language: data.language,
      duration: data.duration
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[GroqWhisper] Request failed:', message)
    return {
      text: '',
      error: `Transcription failed: ${message}`
    }
  }
}

/**
 * Record audio from microphone and transcribe
 *
 * @param durationMs - Maximum recording duration in milliseconds
 * @param options - Transcription options
 * @returns Promise that resolves with transcription when recording stops
 */
export function recordAndTranscribe(
  durationMs: number = 10000,
  options: GroqWhisperOptions = {}
): Promise<GroqWhisperResult> & { stop: () => void; cancel: () => void } {
  let mediaRecorder: MediaRecorder | null = null
  const audioChunks: Blob[] = []
  let resolvePromise: (result: GroqWhisperResult) => void
  let rejectPromise: (error: Error) => void
  let isCancelled = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const promise = new Promise<GroqWhisperResult>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        if (isCancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        // Use webm for best browser support
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4'

        mediaRecorder = new MediaRecorder(stream, { mimeType })

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data)
          }
        }

        mediaRecorder.onstop = async () => {
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop())

          if (isCancelled) {
            resolve({ text: '', error: 'Recording cancelled' })
            return
          }

          if (audioChunks.length === 0) {
            resolve({ text: '', error: 'No audio recorded' })
            return
          }

          const audioBlob = new Blob(audioChunks, { type: mimeType })
          console.log('[GroqWhisper] Recording complete, size:', audioBlob.size)

          const result = await transcribeAudio(audioBlob, options)
          resolve(result)
        }

        mediaRecorder.onerror = (event) => {
          stream.getTracks().forEach(track => track.stop())
          reject(new Error('MediaRecorder error'))
        }

        // Start recording
        mediaRecorder.start(100) // Collect data every 100ms
        console.log('[GroqWhisper] Recording started')

        // Auto-stop after duration
        timeoutId = setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop()
          }
        }, durationMs)
      })
      .catch(error => {
        reject(error)
      })
  }) as Promise<GroqWhisperResult> & { stop: () => void; cancel: () => void }

  // Add stop method to promise
  promise.stop = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
  }

  // Add cancel method to promise
  promise.cancel = () => {
    isCancelled = true
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (mediaRecorder) {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      }
    } else {
      resolvePromise({ text: '', error: 'Recording cancelled' })
    }
  }

  return promise
}
