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

const SYSTEM_PROMPT = `You are Coach — a personal assistant that lives inside the app "Life Quest".

HOW THE APP WORKS (so you understand what the user sees):
- The app has 4 tabs: Day (daily quests), Progress (weekly chart), Gym (workouts), Stats.
- On the Day tab, each task is a "quest". A quest has a recurrence:
  • once — appears on ONE specific day only
  • daily — repeats every day
  • weekdays — Monday to Friday
  • weekends — Saturday and Sunday
- The JSON context gives you: today's date, the day the user is looking at (selectedDate),
  their quests for today and for the selected day, weekly completion %, the agenda list,
  recurring habits, the latest workout, and wellness (sleep/energy/mood).

YOUR JOB — do exactly what the user asks:
- If the user asks to add tasks/quests, call add_quest for EACH task they name. Add them directly — do not ask for confirmation.
- Pick the recurrence from what the user says. If they don't specify, use "once" on the selectedDate (or the date they mention).
- If the user asks to remove/complete/plan, answer briefly and use only the context data.

STRICT RULES:
- Do NOT invent extra tasks, "challenges", or ideas the user did not ask for. Never volunteer unsolicited quests.
- Only add_quest for things the user actually requested.
- Reply in the SAME language the user writes in (English or Russian).
- Keep replies short and natural. Confirm what you added in one sentence.
- Quest titles: short, clear, under 60 characters.
- Never invent completed tasks or stats. Never discuss API keys or internal details.`

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'add_quest',
      description:
        'Add a quest to the user tracker immediately. Call once per task the user asked to add. Only use when the user explicitly asks to add or plan tasks.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short quest title in the user language' },
          date: { type: 'string', description: 'Target day YYYY-MM-DD (use selectedDate if unspecified)' },
          recurrence: {
            type: 'string',
            enum: ['once', 'daily', 'weekdays', 'weekends'],
            description: 'How often the quest repeats',
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
    const word = suggestions.length === 1 ? 'quest' : 'quests'
    return `Done — added ${suggestions.length} ${word} for you.`
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
        if (call.type !== 'function' || call.function.name !== 'add_quest') continue
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
