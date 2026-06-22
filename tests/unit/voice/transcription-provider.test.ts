import { describe, expect, it, vi } from 'vitest'
import { createTranscriptionService } from '@/services/transcription/provider'
import type { TranscriptionProvider } from '@/services/transcription/types'

const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

function provider(
  id: TranscriptionProvider['id'],
  available: boolean,
  transcript: string,
): TranscriptionProvider {
  return {
    id,
    status: vi.fn().mockResolvedValue({
      id,
      available,
      modelConfigured: available,
      reason: available ? undefined : `${id} unavailable`
    }),
    transcribe: vi.fn().mockResolvedValue({
      transcript,
      language: 'he',
      duration: 1,
      provider: id
    })
  }
}

describe('transcription provider routing', () => {
  it('uses Android Gemma first in auto mode when available', async () => {
    const androidGemma = provider('android-gemma-local', true, 'local transcript')
    const whisper = provider('whisper-cloud', true, 'cloud transcript')
    const service = createTranscriptionService({ androidGemmaProvider: androidGemma, whisperProvider: whisper })

    const result = await service.transcribe({ audioBlob, mimeType: audioBlob.type })

    expect(result.provider).toBe('android-gemma-local')
    expect(result.transcript).toBe('local transcript')
    expect(androidGemma.transcribe).toHaveBeenCalledOnce()
    expect(whisper.transcribe).not.toHaveBeenCalled()
  })

  it('falls back to Whisper in auto mode when Android Gemma is unavailable', async () => {
    const androidGemma = provider('android-gemma-local', false, 'local transcript')
    const whisper = provider('whisper-cloud', true, 'cloud transcript')
    const service = createTranscriptionService({ androidGemmaProvider: androidGemma, whisperProvider: whisper })

    const result = await service.transcribe({ audioBlob, mimeType: audioBlob.type })

    expect(result.provider).toBe('whisper-cloud')
    expect(result.transcript).toBe('cloud transcript')
    expect(androidGemma.transcribe).not.toHaveBeenCalled()
    expect(whisper.transcribe).toHaveBeenCalledOnce()
  })

  it('does not silently fall back when Android Gemma local-only mode is selected', async () => {
    const androidGemma = provider('android-gemma-local', false, 'local transcript')
    const whisper = provider('whisper-cloud', true, 'cloud transcript')
    const service = createTranscriptionService({
      provider: 'android-gemma-local',
      androidGemmaProvider: androidGemma,
      whisperProvider: whisper
    })

    await expect(service.transcribe({ audioBlob, mimeType: audioBlob.type })).rejects.toThrow('android-gemma-local unavailable')
    expect(whisper.transcribe).not.toHaveBeenCalled()
  })
})
