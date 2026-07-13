import { useState } from 'react'
import type { AppActions } from '../hooks/useAppData'
import type { DayLog, Habit, Mood, Recurrence } from '../types'
import { tasksForDay, dayTaskCounts, habitStreak, RECURRENCE_LABELS } from '../lib/tasks'
import { formatDateLabel, formatDayNameEn, isToday } from '../lib/stats'
import { TaskRow } from './TaskRow'
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
  carousel?: boolean
  showAddQuest?: boolean
  onAgendaQuestDropped?: (title: string) => void
}

export function DayColumn({
  date,
  log,
  habits,
  actions,
  active,
  carousel = false,
  showAddQuest = true,
  onAgendaQuestDropped,
}: DayColumnProps) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('once')
  const [dragOver, setDragOver] = useState(false)

  const tasks = tasksForDay(date, habits, log)
  const counts = dayTaskCounts(tasks)
  const habitById = new Map(habits.map((h) => [h.id, h]))
  const today = isToday(date)
  const hasProgress = counts.done > 0

  const handleReset = () => {
    if (!hasProgress) return
    if (confirm('Reset all checkmarks for this day?')) {
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
      className={`${styles.col} ${active ? styles.active : ''} ${carousel ? styles.carousel : ''} ${today ? styles.today : ''} ${dragOver ? styles.dropTarget : ''}`}
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
          <span className={styles.date}>{formatDateLabel(date)}</span>
        </div>
        {today && <span className={styles.badge}>today</span>}
      </header>

      <div className={styles.taskScroll}>
        {tasks.length === 0 && !adding ? (
          <p className={styles.empty}>No quests yet — write one below</p>
        ) : (
          <ul className={styles.tasks}>
            {tasks.map((task) => {
              const habit = task.kind === 'habit' ? habitById.get(task.id) : undefined
              const streak = habit ? habitStreak(actions.data, habit, date) : 0
              return (
                <TaskRow
                  key={`${task.kind}-${task.id}`}
                  task={task}
                  date={date}
                  actions={actions}
                  recurrence={habit?.recurrence}
                  streak={streak}
                />
              )
            })}
          </ul>
        )}
      </div>

      {showAddQuest && (
        <div className={styles.addSection}>
          {!adding ? (
            <button type="button" className={styles.plusBtn} onClick={() => setAdding(true)} aria-label="Add quest">
              +
            </button>
          ) : (
            <div className={styles.addForm}>
              <input
                className={styles.addInput}
                type="text"
                placeholder="New quest..."
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
                  Cancel
                </button>
                <button type="button" className={styles.addSubmit} onClick={submitQuest} disabled={!text.trim()}>
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.summary}>
        <div>
          <span className={styles.summaryLabel}>Done</span>
          <span className={styles.summaryVal}>{counts.done}</span>
        </div>
        <div>
          <span className={styles.summaryLabel}>Left</span>
          <span className={styles.summaryVal}>{counts.remaining}</span>
        </div>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={handleReset}
          disabled={!hasProgress}
          title="Reset all checkmarks for this day"
        >
          Reset day
        </button>
      </div>

      <details className={styles.details}>
        <summary className={styles.detailsSummary}>Day · lesson · metrics</summary>

        <div className={styles.reflect}>
          <label className={styles.reflectLabel}>lesson of the day</label>
          <textarea
            className={styles.lesson}
            placeholder="What I learned..."
            value={log.lesson}
            onChange={(e) => actions.updateDayField(date, 'lesson', e.target.value)}
            rows={2}
          />
        </div>

        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Sleep</span>
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
                  {h} h
                </option>
              ))}
            </select>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>Energy</span>
            <div className={styles.energy}>
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`${styles.bolt} ${(log.energy ?? 0) >= level ? styles.boltOn : ''}`}
                  onClick={() => actions.updateDayField(date, 'energy', level as 1 | 2 | 3 | 4)}
                  aria-label={`Energy ${level}`}
                >
                  ⚡
                </button>
              ))}
            </div>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>Mood</span>
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
