/**
 * useWhisperSpeech - Groq Whisper-based speech recognition
 * TASK-1028: Voice Confirmation UI + Edit Before Submit
 * TASK-1029: Whisper API Fallback (using Groq - 12x cheaper than OpenAI)
 *
 * Uses Supabase Edge Function to proxy requests to Groq Whisper API.
 * API key is stored server-side (synced from Doppler) - never exposed to client.
 *
 * Supports code-switching (mixing Hebrew and English in same sentence).
 */

import { ref, computed, readonly, onUnmounted } from 'vue'
import { useOnline } from '@vueuse/core'
import { WavRecorder } from '@/services/audio/wavRecorder'
import { createTranscriptionService } from '@/services/transcription/provider'
import type { TranscriptionProviderId } from '@/services/transcription/types'
import type { WhisperLanguage } from '@/services/transcription/whisperCloud'

export type WhisperStatus = 'idle' | 'recording' | 'processing' | 'error' | 'queued'

export interface WhisperResult {
  transcript: string
  language: string // Detected language code (e.g., 'he', 'en')
  duration: number // Audio duration in seconds
  segments?: Array<{ text: string; start: number; end: number; no_speech_prob: number; avg_logprob: number }>
  provider?: Exclude<TranscriptionProviderId, 'auto'>
}

export interface UseWhisperSpeechOptions {
  /** Whisper model to use (default: 'whisper-large-v3-turbo' - best value) */
  model?: 'whisper-large-v3' | 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en'
  /** Transcription route: auto tries Android Gemma first, then cloud Whisper */
  provider?: TranscriptionProviderId
  /**
   * Spoken-language hint for cloud Whisper (BUG-1885). 'auto' (default) lets Whisper
   * detect the language — required for mixed Hebrew+English dictation.
   */
  language?: WhisperLanguage
  /** Max recording duration in seconds (default: 30) */
  maxDuration?: number
  /** Callback when transcription is complete */
  onResult?: (result: WhisperResult) => void
  /** Callback on error */
  onError?: (error: string) => void
  /** Callback when offline - receives audio blob for queue storage (TASK-1131) */
  onOfflineRecord?: (audioBlob: Blob, mimeType: string) => void
}

const DEFAULT_OPTIONS: Required<Pick<UseWhisperSpeechOptions, 'model' | 'maxDuration'>> = {
  model: 'whisper-large-v3', // Best Hebrew accuracy: $0.111/hour (vs $0.04 for turbo)
  maxDuration: 30
}

export function useWhisperSpeech(options: UseWhisperSpeechOptions = {}) {
  const {
    model = DEFAULT_OPTIONS.model,
    provider = 'whisper-cloud',
    language = 'auto',
    maxDuration = DEFAULT_OPTIONS.maxDuration,
    onResult,
    onError,
    onOfflineRecord
  } = options

  const transcriptionService = createTranscriptionService({ model, provider, language })

  // Online status for offline queue support (TASK-1131)
  const isOnline = useOnline()

  // State
  const status = ref<WhisperStatus>('idle')
  const transcript = ref('')
  const error = ref<string | null>(null)
  const isSupported = ref(false)
  const detectedLanguage = ref<string | null>(null)
  const recordingDuration = ref(0)
  const lastProvider = ref<Exclude<TranscriptionProviderId, 'auto'> | null>(null)

  // Internal refs
  let mediaRecorder: MediaRecorder | null = null
  let wavRecorder: WavRecorder | null = null
  let audioChunks: Blob[] = []
  let recordingTimer: ReturnType<typeof setInterval> | null = null
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null
  let stream: MediaStream | null = null

  // Check support - no longer depends on client-side API key
  isSupported.value = typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  // Debug logging to diagnose PWA support issues (BUG-1070)
  if (import.meta.env.DEV) {
    console.log('[VOICE] Browser support check:', {
      hasNavigator: typeof navigator !== 'undefined',
      hasMediaDevices: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
      hasGetUserMedia: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
      hasMediaRecorder: typeof MediaRecorder !== 'undefined',
      isSupported: isSupported.value,
      isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
      protocol: typeof window !== 'undefined' ? window.location?.protocol : 'N/A'
    })
  }

  // Computed
  const isRecording = computed(() => status.value === 'recording')
  const isProcessing = computed(() => status.value === 'processing')
  const isQueued = computed(() => status.value === 'queued') // TASK-1131: offline queue
  const hasError = computed(() => status.value === 'error')
  const hasApiKey = computed(() => true) // Always true - key is server-side now

  /**
   * Start recording audio
   */
  const start = async (): Promise<boolean> => {
    if (!isSupported.value) {
      const msg = 'Audio recording not supported in this browser.'
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

      if (await shouldRecordWavForGemma()) {
        wavRecorder = new WavRecorder({ sampleRate: 16000 })
        await wavRecorder.start(stream)
      } else {
        // Prefer webm/opus for smaller file size, fallback to other formats.
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
              ? 'audio/ogg;codecs=opus'
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
          stopStream()

          if (audioChunks.length > 0) {
            await processAudio()
          } else {
            status.value = 'idle'
          }
        }

        mediaRecorder.onerror = (event) => {
          console.error('[VOICE] MediaRecorder error:', event)
          error.value = 'Recording failed'
          status.value = 'error'
          if (onError) onError(error.value)
        }
      }

      // Start recording
      if (mediaRecorder) {
        mediaRecorder.start(1000) // Collect data every second
      }
      status.value = 'recording'

      // Duration tracking
      recordingTimer = setInterval(() => {
        recordingDuration.value++
      }, 1000)

      // Max duration limit
      maxDurationTimer = setTimeout(() => {
        if (import.meta.env.DEV) {
          console.log('[VOICE] Max duration reached, stopping')
        }
        stop()
      }, maxDuration * 1000)

      if (import.meta.env.DEV) {
        console.log('[VOICE] Recording started')
      }
      return true

    } catch (err) {
      console.error('[VOICE] Failed to start recording:', err)
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
    if (wavRecorder && status.value === 'recording') {
      if (import.meta.env.DEV) {
        console.log('[VOICE] Stopping WAV recording')
      }
      void stopWavRecording()
      return
    }

    if (mediaRecorder && status.value === 'recording') {
      if (import.meta.env.DEV) {
        console.log('[VOICE] Stopping recording')
      }
      mediaRecorder.stop()
    }
  }

  /**
   * Cancel recording without processing
   */
  const cancel = (): void => {
    clearTimers()

    if (wavRecorder) {
      wavRecorder.cancel()
      wavRecorder = null
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    mediaRecorder = null

    stopStream()

    audioChunks = []
    transcript.value = ''
    status.value = 'idle'
    if (import.meta.env.DEV) {
      console.log('[VOICE] Recording cancelled')
    }
  }

  /**
   * Process recorded audio with Whisper API
   * TASK-1131: Supports offline queuing when onOfflineRecord callback is provided
   */
  const processAudio = async (): Promise<void> => {
    status.value = 'processing'
    if (import.meta.env.DEV) {
      console.log('[VOICE] Processing audio...')
    }

    try {
      // Create audio blob
      const audioBlob = new Blob(audioChunks, { type: audioChunks[0]?.type || 'audio/webm' })
      const mimeType = audioChunks[0]?.type || 'audio/webm'

      // Check minimum size (Whisper needs some audio)
      if (audioBlob.size < 1000) {
        if (import.meta.env.DEV) {
          console.log('[VOICE] Audio too short, skipping')
        }
        status.value = 'idle'
        return
      }

      const localStatus = !isOnline.value
        ? (await transcriptionService.getStatus()).androidGemma
        : null

      // TASK-1131: Check if offline and queue audio for later unless local Android
      // Gemma is actually ready to handle the recording without network access.
      if (!isOnline.value && onOfflineRecord && provider !== 'android-gemma-local' && !localStatus?.available) {
        if (import.meta.env.DEV) {
          console.log('[VOICE] Offline - queuing audio for later transcription')
        }
        onOfflineRecord(audioBlob, mimeType)
        status.value = 'queued'
        // Reset to idle after a brief moment to show queued state
        setTimeout(() => {
          if (status.value === 'queued') {
            status.value = 'idle'
          }
        }, 1500)
        return
      }

      // BUG-1350: Log model for production diagnostics (Whisper model verification)
      console.log('[VOICE] Sending to transcription provider:', { provider, model, language: 'he', audioSize: audioBlob.size, mimeType: audioBlob.type })

      const result = await transcriptionService.transcribe({
        audioBlob,
        mimeType,
        duration: recordingDuration.value,
        preferredProvider: provider
      })

      transcript.value = result.transcript
      detectedLanguage.value = result.language || null
      lastProvider.value = result.provider

      if (import.meta.env.DEV) {
        console.log('[VOICE] Transcription complete:', {
          text: transcript.value,
          language: detectedLanguage.value,
          duration: result.duration,
          provider: result.provider
        })
      }

      status.value = 'idle'

      if (onResult && transcript.value) {
        onResult({
          transcript: transcript.value,
          language: detectedLanguage.value || 'unknown',
          duration: result.duration || recordingDuration.value,
          segments: result.segments,
          provider: result.provider
        })
      }

    } catch (err) {
      console.error('[VOICE] Processing error:', err)
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

  const stopStream = (): void => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }
  }

  const stopWavRecording = async (): Promise<void> => {
    if (!wavRecorder) return

    clearTimers()
    try {
      const audioBlob = await wavRecorder.stop()
      wavRecorder = null
      stopStream()
      audioChunks = [audioBlob]
      await processAudio()
    } catch (err) {
      stopStream()
      const msg = err instanceof Error ? err.message : 'Failed to stop recording'
      error.value = msg
      status.value = 'error'
      if (onError) onError(msg)
    }
  }

  const shouldRecordWavForGemma = async (): Promise<boolean> => {
    if (provider === 'android-gemma-local') return true
    if (provider !== 'auto') return false

    try {
      const localStatus = (await transcriptionService.getStatus()).androidGemma
      return localStatus.available && localStatus.requiresWavAudio !== false
    } catch (err) {
      console.warn('[VOICE] Unable to check Android Gemma status before recording:', err)
      return false
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
    lastProvider: readonly(lastProvider),
    isOnline: readonly(isOnline), // TASK-1131: expose online status

    // Computed
    isRecording,
    isProcessing,
    isQueued, // TASK-1131: offline queue status
    hasError,
    hasApiKey,

    // Methods
    start,
    stop,
    cancel,
    reset
  }
}
