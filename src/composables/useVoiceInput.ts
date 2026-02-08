/**
 * Voice Input Composable
 *
 * Provides speech-to-text functionality using the Web Speech API.
 * Falls back gracefully when not supported (e.g., some Tauri WebView versions).
 *
 * @see TASK-1231 in MASTER_PLAN.md
 */

import { ref, onUnmounted } from 'vue'

export interface UseVoiceInputOptions {
  /** Language for recognition (default: auto-detect from navigator) */
  lang?: string
  /** Whether to continuously listen (default: false - stops after pause) */
  continuous?: boolean
  /** Show interim (partial) results while speaking (default: true) */
  interimResults?: boolean
  /** Auto-stop after this many ms of silence (default: 3000) */
  silenceTimeoutMs?: number
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref<string | null>(null)

  // Check browser support
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  const isSupported = ref(!!SpeechRecognition)

  let recognition: any = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  function createRecognition() {
    if (!SpeechRecognition) return null

    const rec = new SpeechRecognition()
    rec.continuous = options.continuous ?? false
    rec.interimResults = options.interimResults ?? true
    rec.lang = options.lang || navigator.language || 'en-US'
    // Support max alternatives for better accuracy
    rec.maxAlternatives = 1

    rec.onstart = () => {
      isListening.value = true
      error.value = null
    }

    rec.onresult = (event: any) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      if (final) {
        transcript.value += (transcript.value ? ' ' : '') + final.trim()
        interimTranscript.value = ''
      } else {
        interimTranscript.value = interim
      }

      // Reset silence timer on new results
      resetSilenceTimer()
    }

    rec.onerror = (event: any) => {
      console.warn('[VoiceInput] Error:', event.error)
      if (event.error === 'not-allowed') {
        error.value = 'Microphone access denied. Please allow microphone access in your browser settings.'
      } else if (event.error === 'no-speech') {
        // Normal - just no speech detected, not a real error
        error.value = null
      } else if (event.error === 'network') {
        error.value = 'Network error. Speech recognition requires an internet connection.'
      } else {
        error.value = `Speech recognition error: ${event.error}`
      }
      isListening.value = false
      clearSilenceTimer()
    }

    rec.onend = () => {
      isListening.value = false
      interimTranscript.value = ''
      clearSilenceTimer()
    }

    return rec
  }

  function resetSilenceTimer() {
    clearSilenceTimer()
    const timeout = options.silenceTimeoutMs ?? 3000
    silenceTimer = setTimeout(() => {
      if (isListening.value) {
        stopListening()
      }
    }, timeout)
  }

  function clearSilenceTimer() {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  function startListening() {
    if (!isSupported.value) {
      error.value = 'Speech recognition is not supported in this browser.'
      return
    }

    if (isListening.value) return

    // Reset state
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null

    recognition = createRecognition()
    if (!recognition) return

    try {
      recognition.start()
      resetSilenceTimer()
    } catch (e) {
      console.error('[VoiceInput] Failed to start:', e)
      error.value = 'Failed to start speech recognition.'
      isListening.value = false
    }
  }

  function stopListening() {
    if (recognition && isListening.value) {
      try {
        recognition.stop()
      } catch {
        // Already stopped
      }
    }
    isListening.value = false
    interimTranscript.value = ''
    clearSilenceTimer()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopListening()
  })

  return {
    /** Whether the browser supports speech recognition */
    isSupported,
    /** Whether currently listening for speech */
    isListening,
    /** Final transcribed text */
    transcript,
    /** Interim (partial) transcription while speaking */
    interimTranscript,
    /** Error message if any */
    error,
    /** Start listening for speech */
    startListening,
    /** Stop listening */
    stopListening,
  }
}
