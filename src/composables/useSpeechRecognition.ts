/**
 * useSpeechRecognition - Web Speech API composable
 * TASK-1024: Voice Input - Web Speech API Integration
 *
 * Provides real-time speech-to-text transcription using the Web Speech API.
 * Supports Hebrew and English with auto-detection.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
 */

import { ref, computed, readonly, onUnmounted } from 'vue'

export type SpeechRecognitionStatus = 'idle' | 'starting' | 'listening' | 'processing' | 'error'

export type SupportedLanguage = 'he-IL' | 'en-US' | 'auto'

export interface SpeechResult {
  transcript: string
  confidence: number
  isFinal: boolean
  language?: SupportedLanguage
}

export interface UseSpeechRecognitionOptions {
  /** Language for recognition. 'auto' starts with English and detects Hebrew */
  language?: SupportedLanguage
  /** Continuous recognition (default: false for single utterance) */
  continuous?: boolean
  /** Show interim results (default: true) */
  interimResults?: boolean
  /** Auto-stop after silence in ms (default: 2000) */
  silenceTimeout?: number
  /** Callback when final result is received */
  onResult?: (result: SpeechResult) => void
  /** Callback on error */
  onError?: (error: string) => void
}

const DEFAULT_OPTIONS: Required<Omit<UseSpeechRecognitionOptions, 'onResult' | 'onError'>> = {
  language: 'auto',
  continuous: false,
  interimResults: true,
  silenceTimeout: 2000
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    language = DEFAULT_OPTIONS.language,
    continuous = DEFAULT_OPTIONS.continuous,
    interimResults = DEFAULT_OPTIONS.interimResults,
    silenceTimeout = DEFAULT_OPTIONS.silenceTimeout,
    onResult,
    onError
  } = options

  // State
  const status = ref<SpeechRecognitionStatus>('idle')
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref<string | null>(null)
  const isSupported = ref(false)
  const detectedLanguage = ref<SupportedLanguage | null>(null)
  const confidence = ref(0)

  // Internal refs
  let recognition: SpeechRecognition | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  // Check browser support
  const SpeechRecognitionAPI = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

  isSupported.value = !!SpeechRecognitionAPI

  // Debug logging
  console.log('[SpeechRecognition] Browser support check:', {
    hasWindow: typeof window !== 'undefined',
    hasSpeechRecognition: typeof window !== 'undefined' && !!window.SpeechRecognition,
    hasWebkitSpeechRecognition: typeof window !== 'undefined' && !!window.webkitSpeechRecognition,
    isSupported: isSupported.value
  })

  // Computed
  const isListening = computed(() => status.value === 'listening')
  const isProcessing = computed(() => status.value === 'processing')
  const hasError = computed(() => status.value === 'error')
  const displayTranscript = computed(() => interimTranscript.value || transcript.value)
  const hasTranscript = computed(() => transcript.value.trim().length > 0)

  // Track current language for dynamic switching
  const currentLanguage = ref<SupportedLanguage>(language)

  /**
   * Detect browser/system language preference
   */
  const detectBrowserLanguage = (): SupportedLanguage => {
    if (typeof navigator === 'undefined') return 'en-US'

    // Check navigator.language and navigator.languages
    const browserLang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en-US'

    // If browser language starts with 'he', use Hebrew
    if (browserLang.toLowerCase().startsWith('he')) {
      console.log('[SpeechRecognition] Browser language is Hebrew, using he-IL')
      return 'he-IL'
    }

    return 'en-US'
  }

  /**
   * Get language code for Speech API
   */
  const getLanguageCode = (lang: SupportedLanguage): string => {
    if (lang === 'auto') {
      // Detect from browser language preference
      return detectBrowserLanguage()
    }
    return lang
  }

  /**
   * Detect language from text based on character ranges
   * Hebrew characters: \u0590-\u05FF
   */
  const detectLanguageFromText = (text: string): SupportedLanguage => {
    const hebrewRegex = /[\u0590-\u05FF]/
    return hebrewRegex.test(text) ? 'he-IL' : 'en-US'
  }

  /**
   * Initialize recognition instance
   */
  const initRecognition = (): SpeechRecognition | null => {
    if (!SpeechRecognitionAPI) {
      error.value = 'Speech recognition not supported in this browser. Try Chrome, Edge, or Safari.'
      return null
    }

    const rec = new SpeechRecognitionAPI()
    rec.continuous = continuous
    rec.interimResults = interimResults
    rec.maxAlternatives = 1
    // Use currentLanguage.value for dynamic language switching
    const langCode = getLanguageCode(currentLanguage.value)
    rec.lang = langCode
    console.log('[SpeechRecognition] 🎤 Initializing with language:', {
      requested: currentLanguage.value,
      resolved: langCode,
      browserLang: typeof navigator !== 'undefined' ? navigator.language : 'N/A'
    })

    rec.onstart = () => {
      console.log('[SpeechRecognition] Started listening')
      status.value = 'listening'
      error.value = null
      resetSilenceTimer()
    }

    rec.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer()

      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript
        const conf = result[0].confidence

        if (result.isFinal) {
          finalText += text
          confidence.value = conf

          // Detect language from final text
          const detected = detectLanguageFromText(text)
          if (detectedLanguage.value !== detected) {
            detectedLanguage.value = detected
            console.log(`[SpeechRecognition] Detected language: ${detected}`)
          }
        } else {
          interimText += text
        }
      }

      if (finalText) {
        transcript.value += finalText
        interimTranscript.value = ''

        if (onResult) {
          onResult({
            transcript: finalText,
            confidence: confidence.value,
            isFinal: true,
            language: detectedLanguage.value || undefined
          })
        }
      } else {
        interimTranscript.value = interimText
      }

      console.log('[SpeechRecognition] Transcript:', transcript.value + interimTranscript.value)
    }

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearSilenceTimer()
      console.error('[SpeechRecognition] Error:', event.error, event.message)

      const errorMessages: Record<string, string> = {
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'No microphone found. Please check your device.',
        'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
        'network': 'Network error. Check your internet connection.',
        'service-not-allowed': 'Speech recognition service not allowed.',
        'language-not-supported': 'The selected language is not supported.',
        'aborted': '' // User aborted, not an error to display
      }

      const errorMessage = errorMessages[event.error] || `Speech recognition error: ${event.error}`

      if (event.error !== 'aborted' && errorMessage) {
        error.value = errorMessage
        status.value = 'error'
        if (onError) {
          onError(errorMessage)
        }
      }
    }

    rec.onend = () => {
      console.log('[SpeechRecognition] Ended')
      clearSilenceTimer()
      if (status.value === 'listening' || status.value === 'processing') {
        status.value = 'idle'
      }
    }

    rec.onspeechend = () => {
      console.log('[SpeechRecognition] Speech ended')
      status.value = 'processing'
    }

    return rec
  }

  /**
   * Silence timer management
   */
  const resetSilenceTimer = () => {
    clearSilenceTimer()
    if (!continuous && silenceTimeout > 0) {
      silenceTimer = setTimeout(() => {
        console.log('[SpeechRecognition] Silence timeout, stopping')
        stop()
      }, silenceTimeout)
    }
  }

  const clearSilenceTimer = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  /**
   * Start speech recognition
   */
  const start = async (): Promise<boolean> => {
    if (!isSupported.value) {
      error.value = 'Speech recognition not supported in this browser'
      status.value = 'error'
      if (onError) onError(error.value)
      return false
    }

    // Check if already listening
    if (status.value === 'listening') {
      return true
    }

    status.value = 'starting'

    // Request microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop())
    } catch (e) {
      console.error('[SpeechRecognition] Microphone permission denied:', e)
      error.value = 'Microphone access denied. Please allow microphone permissions.'
      status.value = 'error'
      if (onError) onError(error.value)
      return false
    }

    // Reset state
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null
    detectedLanguage.value = null
    confidence.value = 0

    // Initialize and start
    recognition = initRecognition()
    if (recognition) {
      try {
        recognition.start()
        return true
      } catch (e) {
        console.error('[SpeechRecognition] Failed to start:', e)
        error.value = 'Failed to start speech recognition'
        status.value = 'error'
        if (onError) onError(error.value)
        return false
      }
    }
    return false
  }

  /**
   * Stop speech recognition (allows final processing)
   */
  const stop = (): void => {
    clearSilenceTimer()
    if (recognition && (status.value === 'listening' || status.value === 'starting')) {
      try {
        recognition.stop()
        status.value = 'processing'
      } catch {
        // Already stopped
        status.value = 'idle'
      }
    }
  }

  /**
   * Cancel/abort speech recognition immediately
   */
  const cancel = (): void => {
    clearSilenceTimer()
    if (recognition) {
      try {
        recognition.abort()
      } catch {
        // Already stopped
      }
    }
    transcript.value = ''
    interimTranscript.value = ''
    status.value = 'idle'
  }

  /**
   * Reset all state
   */
  const reset = (): void => {
    cancel()
    error.value = null
    detectedLanguage.value = null
    confidence.value = 0
  }

  /**
   * Set the recognition language (restarts recognition if currently listening)
   */
  const setLanguage = async (lang: SupportedLanguage): Promise<void> => {
    const wasListening = status.value === 'listening'
    currentLanguage.value = lang

    if (wasListening) {
      // Restart with new language
      cancel()
      await start()
    } else if (recognition) {
      recognition.lang = getLanguageCode(lang)
    }
  }

  /**
   * Toggle between Hebrew and English
   */
  const toggleLanguage = async (): Promise<void> => {
    const newLang = currentLanguage.value === 'he-IL' ? 'en-US' : 'he-IL'
    await setLanguage(newLang)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cancel()
  })

  return {
    // State (readonly for external consumers)
    status: readonly(status),
    transcript: readonly(transcript),
    interimTranscript: readonly(interimTranscript),
    error: readonly(error),
    isSupported: readonly(isSupported),
    detectedLanguage: readonly(detectedLanguage),
    confidence: readonly(confidence),
    currentLanguage: readonly(currentLanguage),

    // Computed
    isListening,
    isProcessing,
    hasError,
    hasTranscript,
    displayTranscript,

    // Methods
    start,
    stop,
    cancel,
    reset,
    setLanguage,
    toggleLanguage
  }
}
