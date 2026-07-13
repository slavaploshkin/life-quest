import OpenAI, { toFile } from 'openai'

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

function isAuthorized(body: { username?: string; password?: string; secret?: string }): boolean {
  const assistantSecret =
    process.env.ASSISTANT_SECRET?.trim() || process.env.VITE_ASSISTANT_SECRET?.trim()
  if (body.secret && assistantSecret && body.secret === assistantSecret) return true
  if (!body.username || !body.password) return false

  const pairs = [
    [process.env.VITE_ACCOUNT_1_USERNAME, process.env.VITE_ACCOUNT_1_PASSWORD],
    [process.env.ACCOUNT_1_USERNAME, process.env.ACCOUNT_1_PASSWORD],
    [process.env.VITE_ACCOUNT_2_USERNAME, process.env.VITE_ACCOUNT_2_PASSWORD],
    [process.env.ACCOUNT_2_USERNAME, process.env.ACCOUNT_2_PASSWORD],
  ]

  const cleanUser = body.username.trim().toLowerCase()
  const cleanPass = body.password.trim()

  return pairs.some(([user, pass]) => {
    if (!user || !pass) return false
    return user.trim().toLowerCase() === cleanUser && pass.trim() === cleanPass
  })
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

    const openai = new OpenAI({ apiKey })
    const file = await toFile(buffer, `voice.${extension}`, { type: mimeType })
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    })

    return res.status(200).json({ text: transcription.text?.trim() ?? '' })
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: unknown }).message)
          : 'Transcription service error'
    return res.status(500).json({ error: message })
  }
}
