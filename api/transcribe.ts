import { isAuthorized } from './_shared/auth'

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

interface RequestBody {
  username?: string
  password?: string
  secret?: string
  audio: string
  mimeType?: string
}

function parseBody(raw: unknown): RequestBody | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as RequestBody
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as RequestBody
  return null
}

function normalizeMimeType(raw?: string): string {
  const base = (raw?.split(';')[0] ?? 'audio/webm').trim().toLowerCase()
  if (base === 'audio/x-m4a' || base === 'audio/aac') return 'audio/mp4'
  return base
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'audio/webm':
      return 'webm'
    case 'audio/mp4':
      return 'm4a'
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3'
    case 'audio/wav':
    case 'audio/wave':
    case 'audio/x-wav':
      return 'wav'
    case 'audio/ogg':
      return 'ogg'
    default:
      return 'webm'
  }
}

function decodeBase64Audio(input: string): Buffer {
  const normalized = input.includes(',') ? (input.split(',').pop() ?? input) : input
  return Buffer.from(normalized, 'base64')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server.' })
  }

  const body = parseBody(req.body)
  if (!body?.audio || !isAuthorized(body)) {
    return res.status(body?.audio ? 401 : 400).json({ error: body?.audio ? 'Unauthorized' : 'Missing audio' })
  }

  try {
    const mimeType = normalizeMimeType(body.mimeType)
    const extension = extensionForMime(mimeType)
    const buffer = decodeBase64Audio(body.audio)

    if (buffer.byteLength < 800) {
      return res.status(400).json({ error: 'Recording too short — try again.' })
    }

    if (buffer.byteLength > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'Recording too long — keep it under 45 seconds.' })
    }

    const bytes = Uint8Array.from(buffer)
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mimeType }), `voice.${extension}`)
    form.append('model', 'whisper-1')
    form.append('response_format', 'json')

    const whisper = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    const raw = await whisper.text()
    let payload: { text?: string; error?: { message?: string } } = {}
    try {
      payload = JSON.parse(raw) as { text?: string; error?: { message?: string } }
    } catch {
      payload = {}
    }

    if (!whisper.ok) {
      const detail = payload.error?.message ?? raw.trim().slice(0, 220)
      return res.status(whisper.status).json({
        error: detail || 'Whisper could not transcribe this recording.',
      })
    }

    return res.status(200).json({ text: payload.text?.trim() ?? '' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription service error'
    return res.status(500).json({ error: message })
  }
}
