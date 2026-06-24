import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTranscriptionService } from '@/services/transcription/provider'
import { createWhisperCloudProvider } from '@/services/transcription/whisperCloud'
import type { TranscriptionProvider } from '@/services/transcription/types'

vi.mock('@/composables/supabase/_infrastructure', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } })
    }
  }
}))

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
  it('uses Whisper by default so non-mobile callers do not silently probe Android Gemma', async () => {
    const androidGemma = provider('android-gemma-local', true, 'local transcript')
    const whisper = provider('whisper-cloud', true, 'cloud transcript')
    const service = createTranscriptionService({ androidGemmaProvider: androidGemma, whisperProvider: whisper })

    const result = await service.transcribe({ audioBlob, mimeType: audioBlob.type })

    expect(result.provider).toBe('whisper-cloud')
    expect(result.transcript).toBe('cloud transcript')
    expect(androidGemma.status).not.toHaveBeenCalled()
    expect(androidGemma.transcribe).not.toHaveBeenCalled()
    expect(whisper.transcribe).toHaveBeenCalledOnce()
  })

  it('uses Android Gemma first in auto mode when available', async () => {
    const androidGemma = provider('android-gemma-local', true, 'local transcript')
    const whisper = provider('whisper-cloud', true, 'cloud transcript')
    const service = createTranscriptionService({
      provider: 'auto',
      androidGemmaProvider: androidGemma,
      whisperProvider: whisper
    })

    const result = await service.transcribe({ audioBlob, mimeType: audioBlob.type })

    expect(result.provider).toBe('android-gemma-local')
    expect(result.transcript).toBe('local transcript')
    expect(androidGemma.transcribe).toHaveBeenCalledOnce()
    expect(whisper.transcribe).not.toHaveBeenCalled()
  })

  it('falls back to Whisper in auto mode when Android Gemma is unavailable', async () => {
    const androidGemma = provider('android-gemma-local', false, 'local transcript')
    const whisper = provider('whisper-cloud', true, 'cloud transcript')
    const service = createTranscriptionService({
      provider: 'auto',
      androidGemmaProvider: androidGemma,
      whisperProvider: whisper
    })

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

describe('whisper-cloud language handling (BUG-1885)', () => {
  let lastFormData: FormData | null = null

  beforeEach(() => {
    lastFormData = null
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      lastFormData = init?.body as FormData
      return {
        ok: true,
        json: async () => ({ text: 'hello שלום', language: 'en', duration: 1, segments: [] })
      } as Response
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('auto mode (default) sends no forced language and no Hebrew prompt', async () => {
    const whisper = createWhisperCloudProvider()
    await whisper.transcribe({ audioBlob, mimeType: audioBlob.type, duration: 1 })

    expect(lastFormData).not.toBeNull()
    expect(lastFormData!.get('language')).toBeNull()
    expect(lastFormData!.get('prompt')).toBeNull()
  })

  it('explicit Hebrew forwards language=he', async () => {
    const whisper = createWhisperCloudProvider({ language: 'he' })
    await whisper.transcribe({ audioBlob, mimeType: audioBlob.type, duration: 1 })

    expect(lastFormData!.get('language')).toBe('he')
    expect(lastFormData!.get('prompt')).toBeTruthy()
  })

  it('explicit English forwards language=en', async () => {
    const whisper = createWhisperCloudProvider({ language: 'en' })
    await whisper.transcribe({ audioBlob, mimeType: audioBlob.type, duration: 1 })

    expect(lastFormData!.get('language')).toBe('en')
  })
})
