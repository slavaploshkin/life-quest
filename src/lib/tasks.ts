import { getDay, parseISO, format, subDays } from 'date-fns'
import type { AppData, DayLog, DisplayTask, Habit, Recurrence } from '../types'

export function taskAppliesToDay(habit: Habit, date: string): boolean {
  const d = parseISO(date)
  const dow = getDay(d) // 0=Sun, 6=Sat

  switch (habit.recurrence ?? 'daily') {
    case 'daily':
      return true
    case 'once':
      return habit.onceDate === date
    case 'weekdays':
      return dow >= 1 && dow <= 5
    case 'weekends':
      return dow === 0 || dow === 6
    default:
      return true
  }
}

export function tasksForDay(date: string, habits: Habit[], log: DayLog): DisplayTask[] {
  const skipped = new Set(log.skippedHabitIds ?? [])
  const recurring: DisplayTask[] = habits
    .filter((h) => taskAppliesToDay(h, date) && !skipped.has(h.id))
    .sort((a, b) => a.order - b.order)
    .map((h) => ({
      id: h.id,
      title: h.title,
      kind: 'habit' as const,
      done: !!log.completions[h.id],
    }))

  const extra: DisplayTask[] = (log.extraTasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    kind: 'extra' as const,
    done: t.done,
  }))

  const all = [...recurring, ...extra]
  const done = all.filter((task) => task.done)
  const pending = all.filter((task) => !task.done)
  return [...done, ...pending]
}

/**
 * Consecutive completed days for a recurring habit, counting back from refDate.
 * The reference day (usually today) does not break the streak if it is simply
 * not done yet. Non-repeating ("once") habits have no streak.
 */
export function habitStreak(data: AppData, habit: Habit, refDate: string): number {
  if ((habit.recurrence ?? 'daily') === 'once') return 0

  let streak = 0
  let cursor = parseISO(refDate)

  for (let i = 0; i < 366; i += 1) {
    const key = format(cursor, 'yyyy-MM-dd')
    const log = data.dayLogs[key]
    const skipped = log?.skippedHabitIds?.includes(habit.id) ?? false

    if (taskAppliesToDay(habit, key) && !skipped) {
      const done = !!log?.completions[habit.id]
      if (done) {
        streak += 1
      } else if (key !== refDate) {
        break
      }
    }

    cursor = subDays(cursor, 1)
  }

  return streak
}

export function dayTaskCounts(tasks: DisplayTask[]) {
  const done = tasks.filter((t) => t.done).length
  return { done, remaining: tasks.length - done, total: tasks.length }
}

export function dayTaskPct(tasks: DisplayTask[]): number {
  if (tasks.length === 0) return 0
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100)
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: 'Every day',
  once: 'This day only',
  weekdays: 'Weekdays (Mon–Fri)',
  weekends: 'Weekends',
}
