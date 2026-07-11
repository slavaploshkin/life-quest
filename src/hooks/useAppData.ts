import { useCallback, useEffect, useState } from 'react'
import type { AppData, DayLog, Recurrence, WorkoutExercise, WorkoutSession } from '../types'
import { emptyDayLog, loadData, saveData } from '../lib/storage'
import { tasksForDay } from '../lib/tasks'

export function useAppData(userId: string) {
  const [data, setData] = useState<AppData>(() => loadData(userId))

  useEffect(() => {
    setData(loadData(userId))
  }, [userId])

  useEffect(() => {
    saveData(userId, data)
  }, [data, userId])

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    setData(fn)
  }, [])

  const getDayLog = useCallback(
    (date: string): DayLog => data.dayLogs[date] ?? emptyDayLog(date),
    [data.dayLogs],
  )

  const ensureDayLog = useCallback((date: string, prev: AppData): DayLog => {
    return prev.dayLogs[date] ?? emptyDayLog(date)
  }, [])

  const toggleTask = useCallback((date: string, taskId: string, kind: 'habit' | 'extra') => {
    update((prev) => {
      const existing = ensureDayLog(date, prev)
      if (kind === 'habit') {
        const completions = { ...existing.completions, [taskId]: !existing.completions[taskId] }
        return {
          ...prev,
          dayLogs: { ...prev.dayLogs, [date]: { ...existing, completions } },
        }
      }
      const extraTasks = existing.extraTasks.map((t) =>
        t.id === taskId ? { ...t, done: !t.done } : t,
      )
      return {
        ...prev,
        dayLogs: { ...prev.dayLogs, [date]: { ...existing, extraTasks } },
      }
    })
  }, [update, ensureDayLog])

  const updateDayField = useCallback(
    <K extends keyof DayLog>(date: string, field: K, value: DayLog[K]) => {
      update((prev) => {
        const existing = ensureDayLog(date, prev)
        return {
          ...prev,
          dayLogs: { ...prev.dayLogs, [date]: { ...existing, [field]: value } },
        }
      })
    },
    [update, ensureDayLog],
  )

  const addTask = useCallback((title: string, recurrence: Recurrence, date: string) => {
    update((prev) => {
      if (recurrence === 'once') {
        const existing = ensureDayLog(date, prev)
        const extraTasks = [
          ...existing.extraTasks,
          { id: crypto.randomUUID(), title, done: false },
        ]
        return {
          ...prev,
          dayLogs: { ...prev.dayLogs, [date]: { ...existing, extraTasks } },
        }
      }

      const habit = {
        id: crypto.randomUUID(),
        title,
        order: prev.habits.length,
        recurrence,
      }

      return {
        ...prev,
        habits: [...prev.habits, habit],
      }
    })
  }, [update, ensureDayLog])

  const removeTask = useCallback((taskId: string, kind: 'habit' | 'extra', date: string) => {
    update((prev) => {
      if (kind === 'habit') {
        return {
          ...prev,
          habits: prev.habits.filter((h) => h.id !== taskId),
        }
      }
      const existing = ensureDayLog(date, prev)
      return {
        ...prev,
        dayLogs: {
          ...prev.dayLogs,
          [date]: { ...existing, extraTasks: existing.extraTasks.filter((t) => t.id !== taskId) },
        },
      }
    })
  }, [update, ensureDayLog])

  const resetDayPlan = useCallback((date: string) => {
    update((prev) => {
      const existing = ensureDayLog(date, prev)
      const tasks = tasksForDay(date, prev.habits, existing)
      const completions = { ...existing.completions }
      for (const t of tasks) {
        if (t.kind === 'habit') completions[t.id] = false
      }
      const extraTasks = existing.extraTasks.map((t) => ({ ...t, done: false }))
      return {
        ...prev,
        dayLogs: { ...prev.dayLogs, [date]: { ...existing, completions, extraTasks } },
      }
    })
  }, [update, ensureDayLog])

  const createWorkout = useCallback((date: string) => {
    let session: WorkoutSession | null = null
    update((prev) => {
      const number = prev.nextWorkoutNumber
      session = {
        id: crypto.randomUUID(),
        date,
        number,
        exercises: Array.from({ length: 15 }, () => ({
          id: crypto.randomUUID(),
          name: '',
          sets: 3,
          weightCurrent: null,
          weightPrevious: null,
          done: false,
        })),
      }
      return {
        ...prev,
        nextWorkoutNumber: number + 1,
        workoutSessions: [session, ...prev.workoutSessions],
      }
    })
    return session!
  }, [update])

  const deleteWorkout = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      workoutSessions: prev.workoutSessions.filter((s) => s.id !== id),
    }))
  }, [update])

  const updateExercise = useCallback(
    (sessionId: string, exerciseId: string, patch: Partial<WorkoutExercise>) => {
      update((prev) => ({
        ...prev,
        workoutSessions: prev.workoutSessions.map((s) => {
          if (s.id !== sessionId) return s
          return {
            ...s,
            exercises: s.exercises.map((e) =>
              e.id === exerciseId ? { ...e, ...patch } : e,
            ),
          }
        }),
      }))
    },
    [update],
  )

  const sortedHabits = [...data.habits].sort((a, b) => a.order - b.order)

  return {
    data,
    habits: sortedHabits,
    getDayLog,
    toggleTask,
    updateDayField,
    addTask,
    removeTask,
    resetDayPlan,
    createWorkout,
    deleteWorkout,
    updateExercise,
    setData,
  }
}

export type AppActions = ReturnType<typeof useAppData>
