import { format, parseISO, startOfWeek, addDays } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { AppData, DayLog, Habit } from '../types'
import { dayTaskPct, tasksForDay } from './tasks'

const APP_TIME_ZONE = 'America/Los_Angeles'

export function todayInLosAngeles(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  return `${year}-${month}-${day}`
}

export function dayCompletionPct(log: DayLog, habits: Habit[], date: string): number {
  return dayTaskPct(tasksForDay(date, habits, log))
}

export function dayCounts(log: DayLog, habits: Habit[], date: string) {
  const tasks = tasksForDay(date, habits, log)
  const done = tasks.filter((t) => t.done).length
  return { done, remaining: tasks.length - done, total: tasks.length }
}

export interface WeekDayStat {
  date: string
  label: string
  shortLabel: string
  pct: number
  log: DayLog
}

export function weekStats(data: AppData, anchor: Date): WeekDayStat[] {
  const monday = startOfWeek(anchor, { weekStartsOn: 1 })
  const habits = [...data.habits].sort((a, b) => a.order - b.order)

  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i)
    const date = format(d, 'yyyy-MM-dd')
    const log =
      data.dayLogs[date] ??
      ({ date, completions: {}, extraTasks: [], lesson: '', sleepHours: null, energy: null, mood: null } satisfies DayLog)
    return {
      date,
      label: format(d, 'EEEE', { locale: enUS }),
      shortLabel: format(d, 'EEEEE', { locale: enUS }),
      pct: dayCompletionPct(log, habits, date),
      log,
    }
  })
}

export function weekAverage(stats: WeekDayStat[]): number {
  if (stats.length === 0) return 0
  return Math.round(stats.reduce((s, d) => s + d.pct, 0) / stats.length)
}

export function bestWorstDay(stats: WeekDayStat[]): { best: WeekDayStat | null; worst: WeekDayStat | null } {
  const withData = stats.filter((s) => s.pct > 0 || Object.keys(s.log.completions).length > 0 || (s.log.extraTasks?.length ?? 0) > 0)
  if (withData.length === 0) return { best: null, worst: null }
  const sorted = [...withData].sort((a, b) => b.pct - a.pct)
  return { best: sorted[0], worst: sorted[sorted.length - 1] }
}

export function weekRangeLabel(anchor: Date): string {
  const monday = startOfWeek(anchor, { weekStartsOn: 1 })
  const sunday = addDays(monday, 6)
  const fmt = (d: Date) => format(d, 'd MMM', { locale: enUS })
  return `${fmt(monday)} — ${fmt(sunday)}`
}

export function formatDateLabel(dateStr: string): string {
  return format(parseISO(dateStr), 'MMMM d', { locale: enUS })
}

export function formatDayNameEn(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE', { locale: enUS })
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMM', { locale: enUS })
}

/** @deprecated use formatDateLabel */
export function formatDateRu(dateStr: string): string {
  return formatDateLabel(dateStr)
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayInLosAngeles()
}
