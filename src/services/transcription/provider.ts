import { createAndroidGemmaLocalProvider } from './androidGemmaLocal'
import { createWhisperCloudProvider, type WhisperCloudOptions } from './whisperCloud'
import type { TranscriptionProvider, TranscriptionProviderId, TranscriptionRequest, TranscriptionResult } from './types'

export interface TranscriptionServiceOptions extends WhisperCloudOptions {
  provider?: TranscriptionProviderId
  androidGemmaProvider?: TranscriptionProvider
  whisperProvider?: TranscriptionProvider
}

export function createTranscriptionService(options: TranscriptionServiceOptions = {}) {
  const preferredProvider = options.provider || 'auto'
  const androidGemma = options.androidGemmaProvider || createAndroidGemmaLocalProvider()
  const whisperCloud = options.whisperProvider || createWhisperCloudProvider(options)

  const transcribeWith = async (provider: TranscriptionProvider, request: TranscriptionRequest): Promise<TranscriptionResult> => {
    const status = await provider.status()
    if (!status.available) {
      throw new Error(status.reason || `${provider.id} is unavailable.`)
    }
    return provider.transcribe(request)
  }

  const transcribe = async (request: TranscriptionRequest): Promise<TranscriptionResult> => {
    const provider = request.preferredProvider || preferredProvider

    if (provider === 'android-gemma-local') {
      return transcribeWith(androidGemma, request)
    }

    if (provider === 'whisper-cloud') {
      return transcribeWith(whisperCloud, request)
    }

    try {
      return await transcribeWith(androidGemma, request)
    } catch (error) {
      console.warn('[Transcription] Android Gemma unavailable, falling back to Whisper:', error)
      return transcribeWith(whisperCloud, request)
    }
  }

  const getStatus = async () => ({
    androidGemma: await androidGemma.status(),
    whisperCloud: await whisperCloud.status()
  })

  return {
    transcribe,
    getStatus
  }
}
