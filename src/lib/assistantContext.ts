import type { AppData, Recurrence } from '../types'
import { dayCounts, todayInLosAngeles, weekAverage, weekStats } from './stats'
import { tasksForDay } from './tasks'

export interface AssistantContext {
  userName: string
  today: string
  selectedDate: string
  todayQuests: { title: string; done: boolean; kind: string }[]
  selectedDayQuests: { title: string; done: boolean; kind: string }[]
  weekAveragePct: number
  weekDays: { date: string; label: string; pct: number; done: number; total: number }[]
  agenda: string[]
  recurringHabits: { title: string; recurrence: Recurrence }[]
  latestWorkout: { date: string; number: number; exercises: string[] } | null
  todayWellness: {
    sleepHours: number | null
    energy: number | null
    mood: string | null
    lesson: string
  } | null
}

export function buildAssistantContext(
  data: AppData,
  agenda: string[],
  userName: string,
  selectedDate: string,
): AssistantContext {
  const today = todayInLosAngeles()
  const habits = [...data.habits].sort((a, b) => a.order - b.order)
  const rawTodayLog = data.dayLogs[today]
  const todayLog =
    rawTodayLog ??
    ({
      date: today,
      completions: {},
      extraTasks: [],
      lesson: '',
      sleepHours: null,
      energy: null,
      mood: null,
    } as const)

  const selectedLog =
    data.dayLogs[selectedDate] ??
    ({
      date: selectedDate,
      completions: {},
      extraTasks: [],
      lesson: '',
      sleepHours: null,
      energy: null,
      mood: null,
    } as const)

  const week = weekStats(data, new Date())
  const todayTasks = tasksForDay(today, habits, todayLog)
  const selectedTasks = tasksForDay(selectedDate, habits, selectedLog)

  const sessions = [...data.workoutSessions].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sessions[0]

  return {
    userName,
    today,
    selectedDate,
    todayQuests: todayTasks.map((t) => ({ title: t.title, done: t.done, kind: t.kind })),
    selectedDayQuests: selectedTasks.map((t) => ({ title: t.title, done: t.done, kind: t.kind })),
    weekAveragePct: weekAverage(week),
    weekDays: week.map((d) => {
      const counts = dayCounts(d.log, habits, d.date)
      return {
        date: d.date,
        label: d.shortLabel,
        pct: d.pct,
        done: counts.done,
        total: counts.total,
      }
    }),
    agenda,
    recurringHabits: habits.map((h) => ({ title: h.title, recurrence: h.recurrence ?? 'daily' })),
    latestWorkout: latest
      ? {
          date: latest.date,
          number: latest.number,
          exercises: latest.exercises.filter((e) => e.name.trim()).map((e) => e.name.trim()),
        }
      : null,
    todayWellness: rawTodayLog
      ? {
          sleepHours: rawTodayLog.sleepHours,
          energy: rawTodayLog.energy,
          mood: rawTodayLog.mood,
          lesson: rawTodayLog.lesson.trim(),
        }
      : null,
  }
}
