import { isAuthorized } from './_shared/auth'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured on the server.' })
  }

  const body = req.body as RequestBody
  if (!body?.messages?.length || !body.context) {
    return res.status(400).json({ error: 'Missing messages or context' })
  }

  if (!isAuthorized(body)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'

  const openAiMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    {
      role: 'system' as const,
      content: `User context (JSON):\n${JSON.stringify(body.context)}`,
    },
    ...body.messages.slice(-12).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  try {
    const first = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: openAiMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.6,
        max_tokens: 700,
      }),
    })

    const firstPayload = (await first.json()) as {
      error?: { message?: string }
      choices?: Array<{
        message?: {
          content?: string | null
          tool_calls?: Array<{
            id: string
            function: { name: string; arguments: string }
          }>
        }
      }>
    }

    if (!first.ok) {
      return res.status(first.status).json({
        error: firstPayload.error?.message ?? 'OpenAI request failed',
      })
    }

    const firstMessage = firstPayload.choices?.[0]?.message
    const suggestions: QuestSuggestion[] = []

    if (firstMessage?.tool_calls?.length) {
      for (const call of firstMessage.tool_calls) {
        if (call.function.name !== 'suggest_quest') continue
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

      const followUp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...openAiMessages,
            firstMessage,
            ...firstMessage.tool_calls.map((call) => ({
              role: 'tool' as const,
              tool_call_id: call.id,
              content: JSON.stringify({ ok: true, pending_user_confirmation: true }),
            })),
          ],
          temperature: 0.6,
          max_tokens: 500,
        }),
      })

      const followPayload = (await followUp.json()) as {
        error?: { message?: string }
        choices?: Array<{ message?: { content?: string | null } }>
      }

      if (!followUp.ok) {
        return res.status(followUp.status).json({
          error: followPayload.error?.message ?? 'OpenAI follow-up failed',
        })
      }

      return res.status(200).json({
        reply: followPayload.choices?.[0]?.message?.content?.trim() ?? 'Here are some quest ideas for you.',
        suggestions,
      })
    }

    return res.status(200).json({
      reply: firstMessage?.content?.trim() ?? 'How can I help with your quests today?',
      suggestions,
    })
  } catch {
    return res.status(500).json({ error: 'Coach service error' })
  }
}
