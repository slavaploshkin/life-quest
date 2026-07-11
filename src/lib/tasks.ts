import { getDay, parseISO } from 'date-fns'
import type { DayLog, DisplayTask, Habit, Recurrence } from '../types'

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
  const recurring: DisplayTask[] = habits
    .filter((h) => taskAppliesToDay(h, date))
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

  return [...recurring, ...extra]
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
  daily: 'Каждый день',
  once: 'Только этот день',
  weekdays: 'Будни (Пн–Пт)',
  weekends: 'Выходные',
}
