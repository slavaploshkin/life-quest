import { formatDayNameEn, formatDateLabel, isToday } from '../lib/stats'
import { dayTaskCounts, dayTaskPct, tasksForDay } from '../lib/tasks'
import type { AppData, DayLog, Habit } from '../types'
import { ProgressRing } from './ProgressRing'
import styles from './DailyProgress.module.css'

interface DailyProgressProps {
  date: string
  data: AppData
  habits: Habit[]
}

export function DailyProgress({ date, data, habits }: DailyProgressProps) {
  const log =
    data.dayLogs[date] ??
    ({
      date,
      completions: {},
      extraTasks: [],
      lesson: '',
      sleepHours: null,
      energy: null,
      mood: null,
    } satisfies DayLog)

  const tasks = tasksForDay(date, habits, log)
  const counts = dayTaskCounts(tasks)
  const pct = dayTaskPct(tasks)
  const today = isToday(date)

  return (
    <section className={styles.section}>
      <div className={styles.layout}>
        <div className={styles.info}>
          <h2 className={styles.title}>Daily progress</h2>
          <p className={styles.subtitle}>
            {formatDayNameEn(date)} · {formatDateLabel(date)}
            {today && <span className={styles.todayBadge}>today</span>}
          </p>
          <div className={styles.counts}>
            <span className={styles.countDone}>{counts.done} done</span>
            <span className={styles.countSep}>·</span>
            <span className={styles.countLeft}>{counts.remaining} left</span>
          </div>
        </div>
        <div className={styles.ringCol}>
          <ProgressRing pct={pct} size={76} stroke={6} glow label={`${pct}%`} />
          <span className={styles.ringCaption}>
            {counts.total === 0 ? 'no quests' : `${counts.done}/${counts.total}`}
          </span>
        </div>
      </div>
    </section>
  )
}
