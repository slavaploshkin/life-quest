import { useCallback, useEffect, useRef, useState } from 'react'
import { transcribeAudio, TranscribeApiError } from '../lib/transcribeApi'

const BAR_COUNT = 28
const CHUNK_MS = 1000
const WHISPER_SAMPLE_RATE = 16_000
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function shouldUseWavFallback(): boolean {
  const mime = pickMimeType()
  if (!mime) return true
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? ''
  return base === 'audio/mp4' || base === 'audio/aac' || base === 'audio/x-m4a'
}

function normalizeMimeType(raw: string): string {
  const base = raw.split(';')[0]?.trim().toLowerCase() ?? 'audio/webm'
  if (base === 'audio/x-m4a' || base === 'audio/aac') return 'audio/mp4'
  return base
}

function downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate) return samples
  const ratio = fromRate / toRate
  const length = Math.max(1, Math.floor(samples.length / ratio))
  const output = new Float32Array(length)
  for (let index = 0; index < length; index += 1) {
    output[index] = samples[Math.min(samples.length - 1, Math.floor(index * ratio))] ?? 0
  }
  return output
}
function mergeFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0.15))

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const pcmChunksRef = useRef<Float32Array[]>([])
  const wavModeRef = useRef(false)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const smoothLevelsRef = useRef<number[]>(Array(BAR_COUNT).fill(0.15))

  const stopWaveform = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    processorRef.current?.disconnect()
    processorRef.current = null
    analyserRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    setLevels(Array(BAR_COUNT).fill(0.15))
    smoothLevelsRef.current = Array(BAR_COUNT).fill(0.15)
  }, [])

  const cleanupStream = useCallback(() => {
    stopWaveform()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [stopWaveform])

  useEffect(() => cleanupStream, [cleanupStream])

  const collectBlob = useCallback(async (): Promise<Blob | null> => {
    if (wavModeRef.current) {
      const sampleRate = audioContextRef.current?.sampleRate ?? 44100
      const samples = mergeFloat32(pcmChunksRef.current)
      pcmChunksRef.current = []
      wavModeRef.current = false
      cleanupStream()
      setRecording(false)
      setElapsedSec(0)

      if (samples.length < 4000) return null
      const compact = downsample(samples, sampleRate, WHISPER_SAMPLE_RATE)
      return encodeWav(compact, WHISPER_SAMPLE_RATE)
    }

    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return null

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const rawType = recorder.mimeType || pickMimeType() || 'audio/webm'
        const mimeType = normalizeMimeType(rawType)
        resolve(new Blob(chunksRef.current, { type: mimeType }))
      }
      if (typeof recorder.requestData === 'function' && recorder.state === 'recording') {
        recorder.requestData()
      }
      recorder.stop()
    })

    recorderRef.current = null
    cleanupStream()
    setRecording(false)
    setElapsedSec(0)
    return blob
  }, [cleanupStream])

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      if (typeof recorder.requestData === 'function' && recorder.state === 'recording') {
        recorder.requestData()
      }
      recorder.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
    pcmChunksRef.current = []
    wavModeRef.current = false
    cleanupStream()
    setRecording(false)
    setElapsedSec(0)
    setError(null)
  }, [cleanupStream])

  const confirmRecording = useCallback(async (): Promise<string | null> => {
    if (!recording || transcribing) return null

    const blob = await collectBlob()
    if (!blob || blob.size < 800) {
      setError('Recording too short — try again.')
      return null
    }

    if (blob.size > MAX_UPLOAD_BYTES) {
      setError('Recording too long — keep it under 45 seconds.')
      return null
    }

    setTranscribing(true)
    setError(null)

    try {
      const text = await transcribeAudio(blob)
      if (!text) {
        setError('Could not hear anything — try again.')
        return null
      }
      return text
    } catch (err) {
      setError(err instanceof TranscribeApiError ? err.message : 'Microphone unavailable')
      return null
    } finally {
      setTranscribing(false)
    }
  }, [collectBlob, recording, transcribing])

  const startWaveform = useCallback((stream: MediaStream, capturePcm: boolean) => {
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 64
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)
    audioContextRef.current = audioContext
    analyserRef.current = analyser

    if (capturePcm) {
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (event) => {
        pcmChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)))
      }
      source.connect(processor)
      processor.connect(audioContext.destination)
      processorRef.current = processor
    }

    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteFrequencyData(data)
      const next = smoothLevelsRef.current.map((prev, index) => {
        const sample = data[Math.floor((index / BAR_COUNT) * data.length)] ?? 0
        const normalized = Math.min(1, sample / 180)
        const shaped = Math.pow(normalized, 0.72)
        const target = 0.14 + shaped * 0.62
        return prev * 0.62 + target * 0.38
      })
      smoothLevelsRef.current = next
      setLevels(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    startedAtRef.current = Date.now()
    setElapsedSec(0)
    timerRef.current = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)
  }, [])

  const startRecording = useCallback(async () => {
    if (recording || transcribing) return false

    setError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone is not supported in this browser.')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      pcmChunksRef.current = []

      const useWav = shouldUseWavFallback()
      wavModeRef.current = useWav

      if (useWav) {
        setRecording(true)
        startWaveform(stream, true)
        return true
      }

      const mimeType = pickMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.start(CHUNK_MS)
      setRecording(true)
      startWaveform(stream, false)
      return true
    } catch {
      cleanupStream()
      setError('Microphone permission denied.')
      return false
    }
  }, [cleanupStream, recording, startWaveform, transcribing])

  return {
    recording,
    transcribing,
    error,
    elapsedSec,
    elapsedLabel: formatElapsed(elapsedSec),
    levels,
    startRecording,
    cancelRecording,
    confirmRecording,
    clearError: () => setError(null),
  }
}
