import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppActions } from '../hooks/useAppData'
import type { Recurrence } from '../types'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { RECURRENCE_LABELS } from '../lib/tasks'
import { formatDateLabel } from '../lib/stats'
import { DatePickerPopover } from './DatePickerPopover'
import { MicIcon, VoiceRecorderBar } from './VoiceRecorderBar'
import styles from './QuestInputBar.module.css'

const RECURRENCES: Recurrence[] = ['once', 'daily', 'weekdays', 'weekends']

interface QuestInputBarProps {
  selectedDate: string
  onDateChange: (date: string) => void
  actions: AppActions
  onAgendaQuestAdded?: (title: string) => void
}

export function QuestInputBar({
  selectedDate,
  onDateChange,
  actions,
  onAgendaQuestAdded,
}: QuestInputBarProps) {
  const [text, setText] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('once')
  const [showOptions, setShowOptions] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [taskDate, setTaskDate] = useState(selectedDate)
  const calendarBtnRef = useRef<HTMLButtonElement>(null)

  const submitWithTitle = useCallback(
    (title: string) => {
      const clean = title.trim()
      if (!clean) return
      actions.addTask(clean, recurrence, taskDate)
      setText('')
      setShowOptions(false)
      setShowCalendar(false)
    },
    [actions, recurrence, taskDate],
  )

  const voice = useVoiceRecorder()

  useEffect(() => {
    setTaskDate(selectedDate)
  }, [selectedDate])

  const submit = () => {
    submitWithTitle(text)
  }

  const startVoice = async () => {
    setShowOptions(false)
    setShowCalendar(false)
    voice.clearError()
    await voice.startRecording()
  }

  const confirmVoice = async () => {
    const transcript = await voice.confirmRecording()
    if (transcript) submitWithTitle(transcript)
  }

  const addDroppedQuest = (title: string) => {
    const clean = title.trim()
    if (!clean) return
    actions.addTask(clean, 'once', taskDate)
    onAgendaQuestAdded?.(clean)
    setText('')
    setShowOptions(false)
    setShowCalendar(false)
  }

  const pickDate = (date: string) => {
    setTaskDate(date)
    onDateChange(date)
  }

  const taskDateLabel = formatDateLabel(taskDate)

  const toggleCalendar = () => {
    setShowOptions(false)
    setShowCalendar((open) => !open)
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

        {taskDate !== selectedDate && (
          <p className={styles.dateHint}>Quest for {taskDateLabel}</p>
        )}

        {voice.error && <p className={styles.voiceError}>{voice.error}</p>}

        <div className={styles.row}>
          {voice.recording || voice.transcribing ? (
            <VoiceRecorderBar
              voice={voice}
              onCancel={voice.cancelRecording}
              onConfirm={() => void confirmVoice()}
            />
          ) : (
            <>
              <button
                type="button"
                className={styles.optionsBtn}
                onClick={() => {
                  setShowOptions((value) => !value)
                  setShowCalendar(false)
                }}
                title="Repeat"
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
              <div className={styles.calendarWrap}>
                <button
                  ref={calendarBtnRef}
                  type="button"
                  className={`${styles.calendarBtn} ${showCalendar ? styles.calendarBtnActive : ''}`}
                  onClick={toggleCalendar}
                  title={`Choose day · ${taskDateLabel}`}
                  aria-label="Choose day"
                  aria-expanded={showCalendar}
                >
                  📅
                </button>
              </div>
              <button
                type="button"
                className={styles.micBtn}
                onClick={() => void startVoice()}
                title="Voice quest (AI)"
                aria-label="Add quest by voice"
              >
                <MicIcon />
              </button>
              <button
                type="button"
                className={styles.sendBtn}
                onClick={submit}
                disabled={!text.trim()}
                aria-label="Add quest"
              >
                ↑
              </button>
            </>
          )}
        </div>
      </div>
      {showCalendar && (
        <DatePickerPopover
          value={taskDate}
          anchorRef={calendarBtnRef}
          onChange={pickDate}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  )
}
