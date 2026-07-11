import { useState } from 'react'
import type { AppActions } from '../hooks/useAppData'
import type { Recurrence } from '../types'
import { RECURRENCE_LABELS } from '../lib/tasks'
import styles from './QuestInputBar.module.css'

const RECURRENCES: Recurrence[] = ['once', 'daily', 'weekdays', 'weekends']

interface QuestInputBarProps {
  selectedDate: string
  actions: AppActions
  onAgendaQuestAdded?: (title: string) => void
}

export function QuestInputBar({ selectedDate, actions, onAgendaQuestAdded }: QuestInputBarProps) {
  const [text, setText] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('once')
  const [showOptions, setShowOptions] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const submit = () => {
    const title = text.trim()
    if (!title) return
    actions.addTask(title, recurrence, selectedDate)
    setText('')
    setShowOptions(false)
  }

  const addDroppedQuest = (title: string) => {
    const clean = title.trim()
    if (!clean) return
    actions.addTask(clean, 'once', selectedDate)
    onAgendaQuestAdded?.(clean)
    setText('')
    setShowOptions(false)
  }

  return (
    <div className={styles.bar}>
      <div
        className={`${styles.glass} ${dragOver ? styles.dropActive : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          addDroppedQuest(event.dataTransfer.getData('text/plain'))
        }}
      >
        {showOptions && (
          <div className={styles.options}>
            {RECURRENCES.map((r) => (
              <button
                key={r}
                type="button"
                className={`${styles.pill} ${recurrence === r ? styles.pillActive : ''}`}
                onClick={() => setRecurrence(r)}
              >
                {RECURRENCE_LABELS[r]}
              </button>
            ))}
          </div>
        )}

        <div className={styles.row}>
          <button
            type="button"
            className={styles.optionsBtn}
            onClick={() => setShowOptions((v) => !v)}
            title="Повтор"
            aria-expanded={showOptions}
          >
            ⋯
          </button>
          <input
            className={styles.input}
            type="text"
            placeholder="Things to do…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            autoComplete="off"
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={submit}
            disabled={!text.trim()}
            aria-label="Добавить"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
