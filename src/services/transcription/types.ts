export type TranscriptionProviderId = 'auto' | 'whisper-cloud' | 'android-gemma-local'

export interface TranscriptionResult {
  transcript: string
  language: string
  duration: number
  segments?: Array<{ text: string; start: number; end: number; no_speech_prob: number; avg_logprob: number }>
  provider: Exclude<TranscriptionProviderId, 'auto'>
}

export interface TranscriptionRequest {
  audioBlob: Blob
  mimeType: string
  duration?: number
  preferredProvider?: TranscriptionProviderId
}

export interface TranscriptionProviderStatus {
  id: Exclude<TranscriptionProviderId, 'auto'>
  available: boolean
  reason?: string
  modelConfigured?: boolean
  modelPath?: string
  requiresWavAudio?: boolean
}

export interface TranscriptionProvider {
  id: Exclude<TranscriptionProviderId, 'auto'>
  status(): Promise<TranscriptionProviderStatus>
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>
}
