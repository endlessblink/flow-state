import { isCapacitor } from '@/utils/platform'
import { AndroidGemmaNative } from './androidGemmaBridge'
import type { TranscriptionProvider, TranscriptionRequest, TranscriptionResult } from './types'

const TASK_PROMPT = 'Transcribe this FlowState task capture. Preserve Hebrew and English words exactly where possible.'

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function createAndroidGemmaLocalProvider(): TranscriptionProvider {
  return {
    id: 'android-gemma-local',
    async status() {
      if (!isCapacitor()) {
        return {
          id: 'android-gemma-local',
          available: false,
          modelConfigured: false,
          reason: 'Android Gemma transcription is only available in the Capacitor Android app.'
        }
      }

      try {
        const status = await AndroidGemmaNative.getStatus()
        return {
          id: 'android-gemma-local',
          available: status.available,
          modelConfigured: status.modelConfigured,
          reason: status.reason,
          modelPath: status.modelPath,
          requiresWavAudio: true
        }
      } catch (error) {
        return {
          id: 'android-gemma-local',
          available: false,
          modelConfigured: false,
          reason: error instanceof Error ? error.message : 'Android Gemma bridge is unavailable.'
        }
      }
    },
    async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
      const status = await this.status()
      if (!status.available) {
        throw new Error(status.reason || 'Android Gemma transcription is unavailable.')
      }
      if (!request.mimeType.toLowerCase().includes('wav')) {
        throw new Error(`Android Gemma requires mono WAV audio. Received ${request.mimeType || 'unknown audio type'}.`)
      }

      const result = await AndroidGemmaNative.transcribe({
        audioBase64: await blobToBase64(request.audioBlob),
        mimeType: request.mimeType,
        prompt: TASK_PROMPT
      })

      return {
        transcript: result.transcript,
        language: result.language || 'unknown',
        duration: result.duration || request.duration || 0,
        provider: 'android-gemma-local'
      }
    }
  }
}
