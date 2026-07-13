import { getApiAuthPayload } from './auth'

export class TranscribeApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'TranscribeApiError'
    this.status = status
  }
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const auth = getApiAuthPayload()
  if (!auth) {
    throw new TranscribeApiError('Log out and sign in again to use the microphone.')
  }

  const base64 = await blobToBase64(blob)

  const mimeType = (blob.type || 'audio/webm').split(';')[0]?.trim() || 'audio/webm'

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...auth,
      audio: base64,
      mimeType,
    }),
  })

  const raw = await response.text()
  let payload: { error?: string; text?: string } = {}
  try {
    payload = JSON.parse(raw) as { error?: string; text?: string }
  } catch {
    payload = {}
  }

  if (!response.ok) {
    const fallback =
      response.status === 404
        ? 'Voice API is unavailable — redeploy the app on Vercel.'
        : response.status === 401
          ? 'Log out and sign in again to use the microphone.'
          : response.status === 413
            ? 'Recording too long — keep it under 45 seconds.'
            : raw.trim().slice(0, 220) || `Transcription failed (${response.status})`
    throw new TranscribeApiError(payload.error ?? fallback, response.status)
  }

  return payload.text?.trim() ?? ''
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read recording'))
        return
      }
      const base64 = result.split(',')[1]
      if (!base64) {
        reject(new Error('Could not read recording'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Could not read recording'))
    reader.readAsDataURL(blob)
  })
}
