import { useState } from 'react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import type { AppActions } from '../hooks/useAppData'
import type { Recurrence } from '../types'
import { RECURRENCE_LABELS } from '../lib/tasks'
import { formatDateShort, isToday } from '../lib/stats'
import styles from './TaskInputPanel.module.css'

const RECURRENCES: Recurrence[] = ['daily', 'once', 'weekdays', 'weekends']

interface TaskInputPanelProps {
  selectedDate: string
  onDateChange: (date: string) => void
  actions: AppActions
}

export function TaskInputPanel({ selectedDate, onDateChange, actions }: TaskInputPanelProps) {
  const [text, setText] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('daily')

  const today = format(new Date(), 'yyyy-MM-dd')

  const submit = () => {
    const title = text.trim()
    if (!title) return
    actions.addTask(title, recurrence, selectedDate)
    setText('')
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Новый квест</h2>

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          type="text"
          placeholder="Что нужно сделать?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoComplete="off"
        />
        <button type="button" className={styles.addBtn} onClick={submit} disabled={!text.trim()}>
          Добавить
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>День</span>
        <div className={styles.dateControls}>
          <button type="button" className={styles.dateBtn} onClick={() => onDateChange(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}>
            ←
          </button>
          <input
            type="date"
            className={styles.datePicker}
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
          <button type="button" className={styles.dateBtn} onClick={() => onDateChange(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}>
            →
          </button>
          {!isToday(selectedDate) && (
            <button type="button" className={styles.todayBtn} onClick={() => onDateChange(today)}>
              Сегодня
            </button>
          )}
        </div>
        <span className={styles.dateHint}>{formatDateShort(selectedDate)}</span>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Повтор</span>
        <div className={styles.pills}>
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
      </div>
    </section>
  )
}
