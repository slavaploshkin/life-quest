import { useState } from 'react'
import type { AppActions } from '../hooks/useAppData'
import type { DayLog, Habit, Mood, Recurrence } from '../types'
import { tasksForDay, dayTaskCounts, RECURRENCE_LABELS } from '../lib/tasks'
import { formatDateRu, formatDayNameEn, isToday } from '../lib/stats'
import styles from './DayColumn.module.css'

const MOODS: Mood[] = ['😢', '😐', '🙂', '😊', '🤩']
const SLEEP_OPTIONS = [5, 6, 7, 8, 9, 10]
const RECURRENCES: Recurrence[] = ['once', 'daily', 'weekdays', 'weekends']

interface DayColumnProps {
  date: string
  log: DayLog
  habits: Habit[]
  actions: AppActions
  active?: boolean
  showAddQuest?: boolean
  onAgendaQuestDropped?: (title: string) => void
}

export function DayColumn({
  date,
  log,
  habits,
  actions,
  active,
  showAddQuest = true,
  onAgendaQuestDropped,
}: DayColumnProps) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('once')
  const [dragOver, setDragOver] = useState(false)

  const tasks = tasksForDay(date, habits, log)
  const counts = dayTaskCounts(tasks)
  const today = isToday(date)
  const hasProgress = counts.done > 0

  const handleReset = () => {
    if (!hasProgress) return
    if (confirm('Сбросить все галочки за этот день?')) {
      actions.resetDayPlan(date)
    }
  }

  const submitQuest = () => {
    const title = text.trim()
    if (!title) return
    actions.addTask(title, recurrence, date)
    setText('')
    setAdding(false)
    setRecurrence('once')
  }

  const addDroppedQuest = (title: string) => {
    const clean = title.trim()
    if (!clean) return
    actions.addTask(clean, 'once', date)
    onAgendaQuestDropped?.(clean)
    setDragOver(false)
  }

  return (
    <article
      className={`${styles.col} ${active ? styles.active : ''} ${today ? styles.today : ''} ${dragOver ? styles.dropTarget : ''}`}
      onDragOver={(event) => {
        const title = event.dataTransfer.types.includes('text/plain')
        if (!title) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDragOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragOver(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        addDroppedQuest(event.dataTransfer.getData('text/plain'))
      }}
    >
      <div className={styles.dropHint}>Drop into {formatDayNameEn(date)}</div>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h3 className={styles.dayName}>{formatDayNameEn(date)}</h3>
          <span className={styles.date}>{formatDateRu(date)}</span>
        </div>
        {today && <span className={styles.badge}>today</span>}
      </header>

      <div className={styles.taskScroll}>
        {tasks.length === 0 && !adding ? (
          <p className={styles.empty}>No quests yet — write one below</p>
        ) : (
          <ul className={styles.tasks}>
            {tasks.map((task) => (
              <li key={`${task.kind}-${task.id}`} className={styles.task}>
                <span className={`${styles.taskText} ${task.done ? styles.done : ''}`}>{task.title}</span>
                <div className={styles.taskActions}>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => actions.removeTask(task.id, task.kind, date)}
                    title="Удалить"
                    aria-label="Удалить задачу"
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    className={`${styles.check} ${task.done ? styles.checked : ''}`}
                    onClick={() => actions.toggleTask(date, task.id, task.kind)}
                    aria-label={task.done ? 'Отменить' : 'Выполнено'}
                    aria-pressed={task.done}
                  >
                    {task.done && <span className={styles.checkMark}>✓</span>}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAddQuest && (
        <div className={styles.addSection}>
          {!adding ? (
            <button type="button" className={styles.plusBtn} onClick={() => setAdding(true)} aria-label="Добавить квест">
              +
            </button>
          ) : (
            <div className={styles.addForm}>
              <input
                className={styles.addInput}
                type="text"
                placeholder="Новый квест..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitQuest()
                  if (e.key === 'Escape') {
                    setAdding(false)
                    setText('')
                  }
                }}
                autoFocus
              />
              <div className={styles.addPills}>
                {RECURRENCES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.addPill} ${recurrence === r ? styles.addPillActive : ''}`}
                    onClick={() => setRecurrence(r)}
                  >
                    {RECURRENCE_LABELS[r]}
                  </button>
                ))}
              </div>
              <div className={styles.addActions}>
                <button type="button" className={styles.addCancel} onClick={() => { setAdding(false); setText('') }}>
                  Отмена
                </button>
                <button type="button" className={styles.addSubmit} onClick={submitQuest} disabled={!text.trim()}>
                  Добавить
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.summary}>
        <div>
          <span className={styles.summaryLabel}>Выполнено</span>
          <span className={styles.summaryVal}>{counts.done}</span>
        </div>
        <div>
          <span className={styles.summaryLabel}>Осталось</span>
          <span className={styles.summaryVal}>{counts.remaining}</span>
        </div>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={handleReset}
          disabled={!hasProgress}
          title="Сбросить все галочки за день"
        >
          Сброс дня
        </button>
      </div>

      <details className={styles.details}>
        <summary className={styles.detailsSummary}>День · урок · метрики</summary>

        <div className={styles.reflect}>
          <label className={styles.reflectLabel}>урок дня</label>
          <textarea
            className={styles.lesson}
            placeholder="Чему научился..."
            value={log.lesson}
            onChange={(e) => actions.updateDayField(date, 'lesson', e.target.value)}
            rows={2}
          />
        </div>

        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Сон</span>
            <select
              className={styles.select}
              value={log.sleepHours ?? ''}
              onChange={(e) =>
                actions.updateDayField(date, 'sleepHours', e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">—</option>
              {SLEEP_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h} ч
                </option>
              ))}
            </select>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>Энергия</span>
            <div className={styles.energy}>
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`${styles.bolt} ${(log.energy ?? 0) >= level ? styles.boltOn : ''}`}
                  onClick={() => actions.updateDayField(date, 'energy', level as 1 | 2 | 3 | 4)}
                  aria-label={`Энергия ${level}`}
                >
                  ⚡
                </button>
              ))}
            </div>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>Настроение</span>
            <select
              className={styles.select}
              value={log.mood ?? ''}
              onChange={(e) => actions.updateDayField(date, 'mood', (e.target.value || null) as Mood | null)}
            >
              <option value="">—</option>
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>
    </article>
  )
}
