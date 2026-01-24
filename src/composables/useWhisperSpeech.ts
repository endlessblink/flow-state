/**
 * useWhisperSpeech - Groq Whisper-based speech recognition
 * TASK-1028: Voice Confirmation UI + Edit Before Submit
 * TASK-1029: Whisper API Fallback (using Groq - 12x cheaper than OpenAI)
 *
 * Uses Groq's Whisper API for accurate multi-language transcription.
 * Supports code-switching (mixing Hebrew and English in same sentence).
 *
 * Groq pricing: $0.04/hour vs OpenAI $0.36/hour
 *
 * Requires VITE_GROQ_API in environment variables.
 * Get your API key at https://console.groq.com/keys
 */

import { ref, computed, readonly, onUnmounted } from 'vue'

export type WhisperStatus = 'idle' | 'recording' | 'processing' | 'error'

export interface WhisperResult {
  transcript: string
  language: string // Detected language code (e.g., 'he', 'en')
  duration: number // Audio duration in seconds
}

export interface UseWhisperSpeechOptions {
  /** Groq API key (defaults to VITE_GROQ_API) */
  apiKey?: string
  /** Whisper model to use (default: 'whisper-large-v3-turbo' - best value) */
  model?: 'whisper-large-v3' | 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en'
  /** Max recording duration in seconds (default: 30) */
  maxDuration?: number
  /** Callback when transcription is complete */
  onResult?: (result: WhisperResult) => void
  /** Callback on error */
  onError?: (error: string) => void
}

const DEFAULT_OPTIONS = {
  model: 'whisper-large-v3-turbo', // Best value: $0.04/hour, excellent quality
  maxDuration: 30
}

// Groq API endpoint (OpenAI-compatible)
const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

export function useWhisperSpeech(options: UseWhisperSpeechOptions = {}) {
  const {
    apiKey = import.meta.env.VITE_GROQ_API,
    model = DEFAULT_OPTIONS.model,
    maxDuration = DEFAULT_OPTIONS.maxDuration,
    onResult,
    onError
  } = options

  // State
  const status = ref<WhisperStatus>('idle')
  const transcript = ref('')
  const error = ref<string | null>(null)
  const isSupported = ref(false)
  const detectedLanguage = ref<string | null>(null)
  const recordingDuration = ref(0)

  // Internal refs
  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let recordingTimer: ReturnType<typeof setInterval> | null = null
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null
  let stream: MediaStream | null = null

  // Check support
  isSupported.value = typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined' &&
    !!apiKey

  // Computed
  const isRecording = computed(() => status.value === 'recording')
  const isProcessing = computed(() => status.value === 'processing')
  const hasError = computed(() => status.value === 'error')
  const hasApiKey = computed(() => !!apiKey)

  /**
   * Start recording audio
   */
  const start = async (): Promise<boolean> => {
    if (!isSupported.value) {
      const msg = !apiKey
        ? 'Groq API key not configured. Add VITE_GROQ_API to your environment or Doppler.'
        : 'Audio recording not supported in this browser.'
      error.value = msg
      status.value = 'error'
      if (onError) onError(msg)
      return false
    }

    if (status.value === 'recording') {
      return true // Already recording
    }

    try {
      // Request microphone access
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000 // Whisper works well with 16kHz
        }
      })

      // Reset state
      transcript.value = ''
      error.value = null
      detectedLanguage.value = null
      audioChunks = []
      recordingDuration.value = 0

      // Create MediaRecorder
      // Prefer webm/opus for smaller file size, fallback to other formats
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : 'audio/wav'

      mediaRecorder = new MediaRecorder(stream, { mimeType })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        clearTimers()

        // Stop all tracks
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
          stream = null
        }

        // Process the audio
        if (audioChunks.length > 0) {
          await processAudio()
        } else {
          status.value = 'idle'
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('[GroqWhisper] MediaRecorder error:', event)
        error.value = 'Recording failed'
        status.value = 'error'
        if (onError) onError(error.value)
      }

      // Start recording
      mediaRecorder.start(1000) // Collect data every second
      status.value = 'recording'

      // Duration tracking
      recordingTimer = setInterval(() => {
        recordingDuration.value++
      }, 1000)

      // Max duration limit
      maxDurationTimer = setTimeout(() => {
        console.log('[GroqWhisper] Max duration reached, stopping')
        stop()
      }, maxDuration * 1000)

      console.log('[GroqWhisper] 🎤 Recording started')
      return true

    } catch (err) {
      console.error('[GroqWhisper] Failed to start recording:', err)
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone permissions.'
        : 'Failed to start recording'
      error.value = msg
      status.value = 'error'
      if (onError) onError(msg)
      return false
    }
  }

  /**
   * Stop recording and process audio
   */
  const stop = (): void => {
    if (mediaRecorder && status.value === 'recording') {
      console.log('[GroqWhisper] 🛑 Stopping recording')
      mediaRecorder.stop()
    }
  }

  /**
   * Cancel recording without processing
   */
  const cancel = (): void => {
    clearTimers()

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }

    audioChunks = []
    transcript.value = ''
    status.value = 'idle'
    console.log('[GroqWhisper] ❌ Recording cancelled')
  }

  /**
   * Process recorded audio with Whisper API
   */
  const processAudio = async (): Promise<void> => {
    status.value = 'processing'
    console.log('[GroqWhisper] 🔄 Processing audio...')

    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunks, { type: audioChunks[0]?.type || 'audio/webm' })

      // Check minimum size (Whisper needs some audio)
      if (audioBlob.size < 1000) {
        console.log('[GroqWhisper] Audio too short, skipping')
        status.value = 'idle'
        return
      }

      // Prepare form data for Whisper API
      const formData = new FormData()

      // Whisper API expects specific file extensions
      const extension = audioBlob.type.includes('webm') ? 'webm'
        : audioBlob.type.includes('mp4') ? 'mp4'
        : audioBlob.type.includes('wav') ? 'wav'
        : 'webm'

      formData.append('file', audioBlob, `audio.${extension}`)
      formData.append('model', model)
      // Don't specify language - let Whisper auto-detect for mixed language support
      formData.append('response_format', 'verbose_json')

      // Call Groq Whisper API (OpenAI-compatible endpoint)
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()

      transcript.value = data.text || ''
      detectedLanguage.value = data.language || null

      console.log('[GroqWhisper] ✅ Transcription complete:', {
        text: transcript.value,
        language: detectedLanguage.value,
        duration: data.duration
      })

      status.value = 'idle'

      if (onResult && transcript.value) {
        onResult({
          transcript: transcript.value,
          language: detectedLanguage.value || 'unknown',
          duration: data.duration || recordingDuration.value
        })
      }

    } catch (err) {
      console.error('[GroqWhisper] Processing error:', err)
      const msg = err instanceof Error ? err.message : 'Failed to process audio'
      error.value = msg
      status.value = 'error'
      if (onError) onError(msg)
    }
  }

  /**
   * Clear all timers
   */
  const clearTimers = (): void => {
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer)
      maxDurationTimer = null
    }
  }

  /**
   * Reset all state
   */
  const reset = (): void => {
    cancel()
    error.value = null
    detectedLanguage.value = null
    recordingDuration.value = 0
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cancel()
  })

  return {
    // State (readonly)
    status: readonly(status),
    transcript: readonly(transcript),
    error: readonly(error),
    isSupported: readonly(isSupported),
    detectedLanguage: readonly(detectedLanguage),
    recordingDuration: readonly(recordingDuration),

    // Computed
    isRecording,
    isProcessing,
    hasError,
    hasApiKey,

    // Methods
    start,
    stop,
    cancel,
    reset
  }
}
