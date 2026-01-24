/**
 * Unit tests for useSpeechRecognition composable
 * TASK-1024: Voice Input - Web Speech API Integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the Web Speech API before importing the composable
const mockRecognition = {
  continuous: false,
  interimResults: false,
  lang: '',
  maxAlternatives: 1,
  onstart: null as ((ev: Event) => void) | null,
  onend: null as ((ev: Event) => void) | null,
  onresult: null as ((ev: unknown) => void) | null,
  onerror: null as ((ev: unknown) => void) | null,
  onspeechend: null as ((ev: Event) => void) | null,
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn()
}

const MockSpeechRecognition = vi.fn(() => mockRecognition)

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn()

beforeEach(() => {
  vi.stubGlobal('SpeechRecognition', MockSpeechRecognition)
  vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition)

  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: mockGetUserMedia.mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      })
    }
  })

  // Reset mocks
  MockSpeechRecognition.mockClear()
  mockRecognition.start.mockClear()
  mockRecognition.stop.mockClear()
  mockRecognition.abort.mockClear()
  mockGetUserMedia.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useSpeechRecognition', () => {
  // Dynamic import to ensure mocks are in place
  const importComposable = async () => {
    // Clear module cache to ensure fresh import with mocks
    vi.resetModules()
    const { useSpeechRecognition } = await import('@/composables/useSpeechRecognition')
    return useSpeechRecognition
  }

  describe('Browser Support Detection', () => {
    it('should detect when speech recognition is supported', async () => {
      const useSpeechRecognition = await importComposable()
      const { isSupported } = useSpeechRecognition()
      expect(isSupported.value).toBe(true)
    })

    it('should detect when speech recognition is not supported', async () => {
      vi.stubGlobal('SpeechRecognition', undefined)
      vi.stubGlobal('webkitSpeechRecognition', undefined)

      const useSpeechRecognition = await importComposable()
      const { isSupported } = useSpeechRecognition()
      expect(isSupported.value).toBe(false)
    })
  })

  describe('Starting Recognition', () => {
    it('should request microphone permission before starting', async () => {
      const useSpeechRecognition = await importComposable()
      const { start } = useSpeechRecognition()

      await start()

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true })
    })

    it('should start recognition after permission granted', async () => {
      const useSpeechRecognition = await importComposable()
      const { start, status } = useSpeechRecognition()

      await start()

      expect(mockRecognition.start).toHaveBeenCalled()
      // Status is 'starting' until onstart is called
      expect(status.value).toBe('starting')
    })

    it('should set error when microphone permission denied', async () => {
      mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'))

      const useSpeechRecognition = await importComposable()
      const { start, status, error } = useSpeechRecognition()

      const result = await start()

      expect(result).toBe(false)
      expect(status.value).toBe('error')
      expect(error.value).toContain('Microphone access denied')
    })

    it('should set error when browser not supported', async () => {
      vi.stubGlobal('SpeechRecognition', undefined)
      vi.stubGlobal('webkitSpeechRecognition', undefined)

      const useSpeechRecognition = await importComposable()
      const { start, status, error } = useSpeechRecognition()

      const result = await start()

      expect(result).toBe(false)
      expect(status.value).toBe('error')
      expect(error.value).toContain('not supported')
    })
  })

  describe('Stopping Recognition', () => {
    it('should call stop on recognition instance', async () => {
      const useSpeechRecognition = await importComposable()
      const { start, stop, status } = useSpeechRecognition()

      await start()
      // Simulate recognition started
      mockRecognition.onstart?.(new Event('start'))
      expect(status.value).toBe('listening')

      stop()

      expect(mockRecognition.stop).toHaveBeenCalled()
    })

    it('should call abort and reset state on cancel', async () => {
      const useSpeechRecognition = await importComposable()
      const { start, cancel, transcript, status } = useSpeechRecognition()

      await start()
      // Simulate recognition started
      mockRecognition.onstart?.(new Event('start'))

      cancel()

      expect(mockRecognition.abort).toHaveBeenCalled()
      expect(transcript.value).toBe('')
      expect(status.value).toBe('idle')
    })
  })

  describe('Configuration', () => {
    it('should configure recognition with provided options', async () => {
      const useSpeechRecognition = await importComposable()
      useSpeechRecognition({
        language: 'he-IL',
        continuous: true,
        interimResults: false
      })

      // Configuration is applied when recognition is created (on start)
    })

    it('should default to auto language detection', async () => {
      const useSpeechRecognition = await importComposable()
      const { start } = useSpeechRecognition()

      await start()

      // Auto mode defaults to en-US initially
      expect(mockRecognition.lang).toBe('en-US')
    })

    it('should set Hebrew language when specified', async () => {
      const useSpeechRecognition = await importComposable()
      const { start } = useSpeechRecognition({ language: 'he-IL' })

      await start()

      expect(mockRecognition.lang).toBe('he-IL')
    })
  })

  describe('Result Handling', () => {
    it('should call onResult callback with final transcript', async () => {
      const onResult = vi.fn()
      const useSpeechRecognition = await importComposable()
      const { start } = useSpeechRecognition({ onResult })

      await start()
      mockRecognition.onstart?.(new Event('start'))

      // Simulate result event
      const mockResultEvent = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            0: { transcript: 'Hello world', confidence: 0.95 }
          }
        }
      }

      mockRecognition.onresult?.(mockResultEvent)

      expect(onResult).toHaveBeenCalledWith(
        expect.objectContaining({
          transcript: 'Hello world',
          confidence: 0.95,
          isFinal: true
        })
      )
    })

    it('should call onError callback on error', async () => {
      const onError = vi.fn()
      const useSpeechRecognition = await importComposable()
      const { start, status } = useSpeechRecognition({ onError })

      await start()
      mockRecognition.onstart?.(new Event('start'))

      // Simulate error event
      const mockErrorEvent = {
        error: 'no-speech',
        message: 'No speech detected'
      }

      mockRecognition.onerror?.(mockErrorEvent)

      expect(onError).toHaveBeenCalled()
      expect(status.value).toBe('error')
    })
  })

  describe('Language Detection', () => {
    it('should detect Hebrew from transcript containing Hebrew characters', async () => {
      const useSpeechRecognition = await importComposable()
      const { start, detectedLanguage } = useSpeechRecognition()

      await start()
      mockRecognition.onstart?.(new Event('start'))

      // Simulate Hebrew result
      const mockResultEvent = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            0: { transcript: 'שלום עולם', confidence: 0.9 }
          }
        }
      }

      mockRecognition.onresult?.(mockResultEvent)

      expect(detectedLanguage.value).toBe('he-IL')
    })

    it('should detect English from transcript without Hebrew characters', async () => {
      const useSpeechRecognition = await importComposable()
      const { start, detectedLanguage } = useSpeechRecognition()

      await start()
      mockRecognition.onstart?.(new Event('start'))

      // Simulate English result
      const mockResultEvent = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            0: { transcript: 'Hello world', confidence: 0.9 }
          }
        }
      }

      mockRecognition.onresult?.(mockResultEvent)

      expect(detectedLanguage.value).toBe('en-US')
    })
  })
})
