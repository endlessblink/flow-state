import { registerPlugin } from '@capacitor/core'

export interface AndroidGemmaStatus {
  available: boolean
  modelConfigured: boolean
  reason?: string
}

export interface AndroidGemmaTranscribeOptions {
  audioBase64: string
  mimeType: string
  prompt?: string
}

export interface AndroidGemmaTranscribeResult {
  transcript: string
  language?: string
  duration?: number
}

export interface AndroidGemmaNativePlugin {
  getStatus(): Promise<AndroidGemmaStatus>
  transcribe(options: AndroidGemmaTranscribeOptions): Promise<AndroidGemmaTranscribeResult>
  importModel(options: { uri: string }): Promise<AndroidGemmaStatus>
}

export const AndroidGemmaNative = registerPlugin<AndroidGemmaNativePlugin>('AndroidGemmaTranscription')
