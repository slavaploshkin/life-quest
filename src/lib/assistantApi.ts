import type { AssistantContext } from './assistantContext'
import { getApiAuthPayload } from './auth'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface QuestSuggestion {
  title: string
  date: string
  recurrence: 'once' | 'daily' | 'weekdays' | 'weekends'
}

export interface AssistantResponse {
  reply: string
  suggestions: QuestSuggestion[]
}

export class AssistantApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AssistantApiError'
    this.status = status
  }
}

export async function sendAssistantMessage(
  messages: ChatMessage[],
  context: AssistantContext,
): Promise<AssistantResponse> {
  const auth = getApiAuthPayload()
  if (!auth) {
    throw new AssistantApiError('Log out and sign in again to use Coach.')
  }

  const response = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...auth, messages, context }),
  })

  const raw = await response.text()
  let payload: { error?: string; reply?: string; suggestions?: QuestSuggestion[] } = {}
  try {
    payload = JSON.parse(raw) as typeof payload
  } catch {
    payload = {}
  }

  if (!response.ok) {
    const fallback =
      response.status === 404
        ? 'Coach API is unavailable — wait for deploy to finish.'
        : response.status === 401
          ? 'Log out and sign in again to use Coach.'
          : response.status === 503
            ? 'OPENAI_API_KEY is not configured on the server.'
            : raw.trim().slice(0, 220) || `Coach is unavailable (${response.status})`
    throw new AssistantApiError(payload.error ?? fallback, response.status)
  }

  return {
    reply: payload.reply ?? '',
    suggestions: payload.suggestions ?? [],
  }
}
