interface WavRecorderOptions {
  sampleRate?: number
}

export class WavRecorder {
  private readonly targetSampleRate: number
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private samples: Float32Array[] = []

  constructor(options: WavRecorderOptions = {}) {
    this.targetSampleRate = options.sampleRate || 16000
  }

  async start(stream: MediaStream): Promise<void> {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) {
      throw new Error('WAV recording is not supported in this browser.')
    }

    this.audioContext = new AudioContextCtor()
    this.source = this.audioContext.createMediaStreamSource(stream)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.samples = []

    this.processor.onaudioprocess = (event) => {
      this.samples.push(new Float32Array(event.inputBuffer.getChannelData(0)))
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  async stop(): Promise<Blob> {
    const sourceRate = this.audioContext?.sampleRate || this.targetSampleRate
    this.disconnect()
    const merged = mergeBuffers(this.samples)
    const mono = resampleLinear(merged, sourceRate, this.targetSampleRate)
    const wav = encodeMonoWav(mono, this.targetSampleRate)
    return new Blob([wav], { type: 'audio/wav' })
  }

  cancel(): void {
    this.disconnect()
    this.samples = []
  }

  private disconnect(): void {
    if (this.processor) {
      this.processor.disconnect()
      this.processor.onaudioprocess = null
      this.processor = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close()
    }
    this.audioContext = null
  }
}

function mergeBuffers(buffers: Float32Array[]): Float32Array {
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0
  for (const buffer of buffers) {
    merged.set(buffer, offset)
    offset += buffer.length
  }
  return merged
}

function resampleLinear(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate || input.length === 0) {
    return input
  }

  const ratio = sourceRate / targetRate
  const outputLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outputLength)

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio
    const lower = Math.floor(sourceIndex)
    const upper = Math.min(lower + 1, input.length - 1)
    const weight = sourceIndex - lower
    output[i] = input[lower] * (1 - weight) + input[upper] * weight
  }

  return output
}

function encodeMonoWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += bytesPerSample
  }

  return buffer
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}
