/**
 * useGroqWhisper - Groq Whisper composable for Vue
 * TASK-1029: Voice Input - Whisper API Integration
 *
 * Provides a Vue composable interface for Groq Whisper transcription.
 * API-compatible with useSpeechRecognition for easy swapping.
 */

import { ref, computed, readonly, onUnmounted } from 'vue'
import { transcribeWithRetry, isGroqWhisperAvailable } from '@/services/groqWhisper'

export type WhisperStatus = 'idle' | 'starting' | 'recording' | 'processing' | 'error'
export type SupportedLanguage = 'he-IL' | 'en-US' | 'auto'

export interface WhisperResult {
  transcript: string
  confidence: number
  isFinal: boolean
  language?: SupportedLanguage
}

export interface UseGroqWhisperOptions {
  /** Language for recognition ('he-IL', 'en-US', or 'auto') */
  language?: SupportedLanguage
  /** Maximum recording duration in ms (default: 30000) */
  maxDuration?: number
  /** Callback when transcription is received */
  onResult?: (result: WhisperResult) => void
  /** Callback on error */
  onError?: (error: string) => void
}

export function useGroqWhisper(options: UseGroqWhisperOptions = {}) {
  const {
    language = 'auto',
    maxDuration = 30000,
    onResult,
    onError
  } = options

  // State
  const status = ref<WhisperStatus>('idle')
  const transcript = ref('')
  const error = ref<string | null>(null)
  const isSupported = ref(isGroqWhisperAvailable())
  const detectedLanguage = ref<SupportedLanguage | null>(null)
  const recordingDuration = ref(0)
  const currentLanguage = ref<SupportedLanguage>(language)

  // Internal
  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let stream: MediaStream | null = null
  let durationInterval: ReturnType<typeof setInterval> | null = null
  let maxDurationTimeout: ReturnType<typeof setTimeout> | null = null

  // Computed
  const isRecording = computed(() => status.value === 'recording')
  const isProcessing = computed(() => status.value === 'processing')
  const hasError = computed(() => status.value === 'error')
  const displayTranscript = computed(() => transcript.value)

  /**
   * Map language code to Groq format
   */
  const getGroqLanguage = (lang: SupportedLanguage): string | undefined => {
    if (lang === 'auto') return undefined
    if (lang === 'he-IL') return 'he'
    if (lang === 'en-US') return 'en'
    return undefined
  }

  /**
   * Start recording
   */
  const start = async (): Promise<boolean> => {
    if (!isSupported.value) {
      error.value = 'Groq API key not configured. Add VITE_GROQ_API_KEY to Doppler or .env.local.'
      status.value = 'error'
      if (onError) onError(error.value)
      return false
    }

    if (status.value === 'recording') {
      return true
    }

    status.value = 'starting'
    error.value = null
    transcript.value = ''
    audioChunks = []
    recordingDuration.value = 0

    try {
      // Request microphone permission
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Determine best supported MIME type
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
        // Clear timers
        if (durationInterval) {
          clearInterval(durationInterval)
          durationInterval = null
        }
        if (maxDurationTimeout) {
          clearTimeout(maxDurationTimeout)
          maxDurationTimeout = null
        }

        // Stop stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
          stream = null
        }

        // Check if we have audio
        if (audioChunks.length === 0) {
          error.value = 'No audio recorded'
          status.value = 'error'
          if (onError) onError(error.value)
          return
        }

        // Process audio
        status.value = 'processing'
        const audioBlob = new Blob(audioChunks, { type: mimeType })

        if (import.meta.env.DEV) {
          console.log('[VOICE] Processing audio:', {
            size: audioBlob.size,
            duration: recordingDuration.value,
            language: currentLanguage.value
          })
        }

        // BUG-1109: Use transcribeWithRetry for automatic Arabic→Hebrew correction
        // Only pass language hint if explicitly set (not 'auto')
        const result = await transcribeWithRetry(audioBlob, {
          language: getGroqLanguage(currentLanguage.value),
          model: 'whisper-large-v3-turbo'
        })

        if (result.error) {
          error.value = result.error
          status.value = 'error'
          if (onError) onError(result.error)
        } else {
          transcript.value = result.text
          detectedLanguage.value = result.language === 'he' ? 'he-IL' : 'en-US'
          status.value = 'idle'

          if (onResult) {
            onResult({
              transcript: result.text,
              confidence: 1, // Groq doesn't provide confidence
              isFinal: true,
              language: detectedLanguage.value
            })
          }
        }
      }

      mediaRecorder.onerror = () => {
        cleanup()
        error.value = 'Recording failed'
        status.value = 'error'
        if (onError) onError(error.value)
      }

      // Start recording
      mediaRecorder.start(100) // Collect data every 100ms
      status.value = 'recording'

      // Track duration
      const startTime = Date.now()
      durationInterval = setInterval(() => {
        recordingDuration.value = Date.now() - startTime
      }, 100)

      // Auto-stop at max duration
      maxDurationTimeout = setTimeout(() => {
        if (status.value === 'recording') {
          stop()
        }
      }, maxDuration)

      if (import.meta.env.DEV) {
        console.log('[VOICE] Recording started')
      }
      return true
    } catch (e) {
      cleanup()
      const message = e instanceof Error ? e.message : 'Failed to access microphone'
      error.value = message.includes('Permission') || message.includes('NotAllowed')
        ? 'Microphone access denied. Please allow microphone permissions.'
        : message
      status.value = 'error'
      if (onError) onError(error.value)
      return false
    }
  }

  /**
   * Stop recording and process
   */
  const stop = (): void => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
  }

  /**
   * Cancel recording without processing
   */
  const cancel = (): void => {
    cleanup()
    transcript.value = ''
    status.value = 'idle'
  }

  /**
   * Cleanup resources
   */
  const cleanup = (): void => {
    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
    if (maxDurationTimeout) {
      clearTimeout(maxDurationTimeout)
      maxDurationTimeout = null
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop()
      } catch {
        // Already stopped
      }
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }
    audioChunks = []
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

  /**
   * Set the recognition language
   */
  const setLanguage = (lang: SupportedLanguage): void => {
    currentLanguage.value = lang
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // State (readonly for external consumers)
    status: readonly(status),
    transcript: readonly(transcript),
    error: readonly(error),
    isSupported: readonly(isSupported),
    detectedLanguage: readonly(detectedLanguage),
    recordingDuration: readonly(recordingDuration),

    // Computed - API compatible with useSpeechRecognition
    isListening: isRecording, // Alias for compatibility
    isRecording,
    isProcessing,
    hasError,
    displayTranscript,

    // For compatibility with useSpeechRecognition
    interimTranscript: computed(() => ''), // Groq doesn't support interim results

    // Methods
    start,
    stop,
    cancel,
    reset,
    setLanguage
  }
}
