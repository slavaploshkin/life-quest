import type { AppData, DayLog, Habit } from '../types'

const STORAGE_KEY = 'life-quest-data-v3'
const AGENDA_KEY = 'life-quest-agenda-v1'

function storageKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`
}

function agendaKey(userId: string): string {
  return `${AGENDA_KEY}:${userId}`
}

function defaultData(): AppData {
  return {
    habits: [],
    dayLogs: {},
    workoutSessions: [],
    nextWorkoutNumber: 1,
  }
}

function migrateHabit(h: Habit): Habit {
  return { ...h, recurrence: h.recurrence ?? 'daily' }
}

function migrateDayLog(log: DayLog): DayLog {
  return { ...log, extraTasks: log.extraTasks ?? [] }
}

export function loadData(userId: string): AppData {
  try {
    const v3 = localStorage.getItem(storageKey(userId))
    if (v3) {
      const parsed = JSON.parse(v3) as AppData
      return {
        ...defaultData(),
        ...parsed,
        habits: (parsed.habits ?? []).map(migrateHabit),
        dayLogs: Object.fromEntries(
          Object.entries(parsed.dayLogs ?? {}).map(([k, v]) => [k, migrateDayLog(v as DayLog)]),
        ),
      }
    }
    // Fresh start — ignore old v1/v2 task lists
    return defaultData()
  } catch {
    return defaultData()
  }
}

export function saveData(userId: string, data: AppData): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(data))
}

export function emptyDayLog(date: string): DayLog {
  return {
    date,
    completions: {},
    extraTasks: [],
    lesson: '',
    sleepHours: null,
    energy: null,
    mood: null,
  }
}

export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function importData(userId: string, json: string): AppData {
  const parsed = JSON.parse(json) as AppData
  const data = {
    ...parsed,
    habits: (parsed.habits ?? []).map(migrateHabit),
    dayLogs: Object.fromEntries(
      Object.entries(parsed.dayLogs ?? {}).map(([k, v]) => [k, migrateDayLog(v as DayLog)]),
    ),
  }
  saveData(userId, data)
  return data
}

export function loadAgendaItems(userId: string): string[] {
  try {
    const items = localStorage.getItem(agendaKey(userId))
    if (!items) return []
    const parsed = JSON.parse(items)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function saveAgendaItems(userId: string, items: string[]): void {
  localStorage.setItem(agendaKey(userId), JSON.stringify(items))
}
