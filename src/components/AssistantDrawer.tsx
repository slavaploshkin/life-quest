import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppActions } from '../hooks/useAppData'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import type { ActiveAccount } from '../lib/auth'
import { sendAssistantMessage, type ChatMessage, type QuestSuggestion } from '../lib/assistantApi'
import { buildAssistantContext } from '../lib/assistantContext'
import { formatDateLabel } from '../lib/stats'
import { RECURRENCE_LABELS } from '../lib/tasks'
import { MicIcon, VoiceRecorderBar } from './VoiceRecorderBar'
import styles from './AssistantDrawer.module.css'

interface AssistantDrawerProps {
  open: boolean
  onClose: () => void
  account: ActiveAccount
  selectedDate: string
  actions: AppActions
}

const STARTERS = [
  'What should I focus on today?',
  'How was my week?',
  'Help me plan tomorrow',
]

export function AssistantDrawer({
  open,
  onClose,
  account,
  selectedDate,
  actions,
}: AssistantDrawerProps) {
  const { data, agendaItems, addTask } = actions
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingSuggestions, setPendingSuggestions] = useState<QuestSuggestion[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const context = useMemo(
    () => buildAssistantContext(data, agendaItems, account.displayName, selectedDate),
    [account.displayName, agendaItems, data, selectedDate],
  )

  const voice = useVoiceRecorder()

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pendingSuggestions, loading, open, voice.transcribing])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (voice.recording) voice.cancelRecording()
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open, voice])

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || loading || voice.recording || voice.transcribing) return

      const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: clean }]
      setMessages(nextMessages)
      setInput('')
      setError(null)
      voice.clearError()
      setLoading(true)
      setPendingSuggestions([])

      try {
        const result = await sendAssistantMessage(nextMessages, context)
        setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }])
        setPendingSuggestions(result.suggestions)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Coach unavailable')
      } finally {
        setLoading(false)
        inputRef.current?.focus()
      }
    },
    [context, loading, messages, voice],
  )

  const startVoice = async () => {
    if (loading || voice.transcribing) return
    voice.clearError()
    setError(null)
    await voice.startRecording()
  }

  const confirmVoice = async () => {
    const text = await voice.confirmRecording()
    if (text) void send(text)
  }

  const applySuggestion = (suggestion: QuestSuggestion) => {
    addTask(suggestion.title, suggestion.recurrence, suggestion.date)
    setAppliedIds((prev) => new Set(prev).add(suggestionKey(suggestion)))
  }

  if (!open) return null

  const showRecorder = voice.recording || voice.transcribing

  return (
    <div className={styles.root}>
      <button type="button" className={styles.backdrop} aria-label="Close Coach" onClick={onClose} />
      <aside className={styles.sheet} aria-label="Coach assistant">
        <div className={styles.handleBar}>
          <div className={styles.grabber} aria-hidden="true" />
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <header className={styles.header}>
          <p className={styles.kicker}>Life Quest</p>
          <h2 className={styles.title}>Coach</h2>
          <p className={styles.subtitle}>Your personal assistant — quests, progress, gym.</p>
        </header>

        <div className={styles.messages} ref={scrollRef}>
          {messages.length === 0 && !showRecorder && (
            <div className={styles.empty}>
              <p>Type a message or tap the mic to speak.</p>
              <div className={styles.starters}>
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className={styles.starterBtn}
                    onClick={() => void send(starter)}
                    disabled={loading}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`${styles.bubble} ${message.role === 'user' ? styles.userBubble : styles.assistantBubble}`}
            >
              {message.content}
            </div>
          ))}

          {pendingSuggestions.length > 0 && (
            <div className={styles.suggestions}>
              <p className={styles.suggestionsTitle}>Suggested quests</p>
              {pendingSuggestions.map((suggestion) => {
                const key = suggestionKey(suggestion)
                const applied = appliedIds.has(key)
                return (
                  <div key={key} className={styles.suggestionCard}>
                    <div>
                      <strong>{suggestion.title}</strong>
                      <span>
                        {formatDateLabel(suggestion.date)} · {RECURRENCE_LABELS[suggestion.recurrence]}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.addBtn}
                      disabled={applied}
                      onClick={() => applySuggestion(suggestion)}
                    >
                      {applied ? 'Added' : 'Add'}
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                className={styles.dismissBtn}
                onClick={() => setPendingSuggestions([])}
              >
                Dismiss
              </button>
            </div>
          )}

          {loading && <div className={styles.typing}>Coach is thinking…</div>}
          {(error || voice.error) && (
            <div className={styles.error}>{error ?? voice.error}</div>
          )}
        </div>

        <div className={styles.composerWrap}>
          {showRecorder ? (
            <VoiceRecorderBar
              voice={voice}
              onCancel={voice.cancelRecording}
              onConfirm={() => void confirmVoice()}
            />
          ) : (
            <form
              className={styles.composer}
              onSubmit={(e) => {
                e.preventDefault()
                void send(input)
              }}
            >
              <textarea
                ref={inputRef}
                className={styles.input}
                rows={1}
                value={input}
                placeholder="Message Coach…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                disabled={loading}
              />
              {input.trim() ? (
                <button type="submit" className={styles.sendBtn} disabled={loading} aria-label="Send">
                  ↑
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.micBtn}
                  onClick={() => void startVoice()}
                  disabled={loading}
                  aria-label="Start voice message"
                >
                  <MicIcon />
                </button>
              )}
            </form>
          )}
        </div>
      </aside>
    </div>
  )
}

function suggestionKey(suggestion: QuestSuggestion): string {
  return `${suggestion.title}|${suggestion.date}|${suggestion.recurrence}`
}
