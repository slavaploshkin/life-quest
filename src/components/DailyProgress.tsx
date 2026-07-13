import { formatDayNameEn, formatDateLabel, isToday } from '../lib/stats'
import { dayTaskCounts, dayTaskPct, habitStreak, tasksForDay, taskAppliesToDay } from '../lib/tasks'
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

  const skipped = new Set(log.skippedHabitIds ?? [])
  const bestStreak = habits
    .filter((h) => taskAppliesToDay(h, date) && !skipped.has(h.id))
    .reduce((max, h) => Math.max(max, habitStreak(data, h, date)), 0)

  const hint = (() => {
    if (counts.total === 0) return 'No quests yet — add one below.'
    if (counts.remaining === 0) return today ? 'All done — great day! 🎉' : 'All done ✓'
    const left = `${counts.remaining} left`
    if (bestStreak >= 2) return `🔥 ${bestStreak}-day streak · ${left}`
    return today ? `${left} today` : left
  })()

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
          <p className={styles.hint}>{hint}</p>
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
