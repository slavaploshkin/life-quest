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

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    reply?: string
    suggestions?: QuestSuggestion[]
  }

  if (!response.ok) {
    throw new AssistantApiError(payload.error ?? 'Coach is unavailable right now.', response.status)
  }

  return {
    reply: payload.reply ?? '',
    suggestions: payload.suggestions ?? [],
  }
}
