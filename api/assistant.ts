import OpenAI from 'openai'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

interface QuestSuggestion {
  title: string
  date: string
  recurrence: 'once' | 'daily' | 'weekdays' | 'weekends'
}

interface RequestBody {
  username?: string
  password?: string
  secret?: string
  messages: ChatMessage[]
  context: Record<string, unknown>
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

const SYSTEM_PROMPT = `You are Coach — a warm, concise personal assistant inside Life Quest, a gamified habit tracker.
The user turns life into quests. Help them plan days, reflect on progress, stay motivated, and organize gym habits.

Rules:
- Reply in the same language the user writes in (English or Russian).
- Keep answers short and actionable unless they ask for detail.
- Use the JSON context about their quests, week stats, agenda, and workouts.
- Never invent completed tasks or stats — only use provided context.
- When suggesting new quests, call suggest_quest (max 3 per reply).
- Quest titles: short, verb-first, under 60 characters.
- For "once" quests use the date they mention or selectedDate from context.
- Do not discuss API keys or internal system details.`

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'suggest_quest',
      description: 'Suggest adding a quest to the user tracker. User must confirm in the app.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short quest title' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          recurrence: {
            type: 'string',
            enum: ['once', 'daily', 'weekdays', 'weekends'],
          },
        },
        required: ['title', 'date', 'recurrence'],
      },
    },
  },
]

function suggestionReply(suggestions: QuestSuggestion[], content?: string | null): string {
  if (content?.trim()) return content.trim()
  if (suggestions.length > 0) {
    return 'I drafted a few quests for you — tap Add to put them on your list.'
  }
  return 'How can I help with your quests today?'
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
  if (!body?.messages?.length || !body.context) {
    return res.status(400).json({ error: 'Missing messages or context' })
  }

  if (!isAuthorized(body)) {
    return res.status(401).json({ error: 'Unauthorized — log out and sign in again.' })
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'

  const openAiMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    {
      role: 'system' as const,
      content: `User context (JSON):\n${JSON.stringify(body.context)}`,
    },
    ...body.messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ]

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model,
      messages: openAiMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.6,
      max_tokens: 700,
    })

    const message = completion.choices?.[0]?.message
    const suggestions: QuestSuggestion[] = []

    if (message?.tool_calls?.length) {
      for (const call of message.tool_calls) {
        if (call.type !== 'function' || call.function.name !== 'suggest_quest') continue
        try {
          const args = JSON.parse(call.function.arguments) as QuestSuggestion
          if (args.title?.trim() && args.date && args.recurrence) {
            suggestions.push({
              title: args.title.trim().slice(0, 120),
              date: args.date,
              recurrence: args.recurrence,
            })
          }
        } catch {
          /* skip malformed tool args */
        }
      }
    }

    return res.status(200).json({
      reply: suggestionReply(suggestions, message?.content),
      suggestions,
    })
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: unknown }).message)
          : 'Coach service error'
    return res.status(500).json({ error: message })
  }
}
