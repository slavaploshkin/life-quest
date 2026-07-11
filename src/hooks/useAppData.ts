import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData, DayLog, Recurrence, WorkoutExercise, WorkoutSession } from '../types'
import {
  fetchCloudSnapshot,
  hasMeaningfulData,
  saveCloudSnapshot,
  subscribeCloudSnapshot,
} from '../lib/cloud'
import { emptyDayLog, loadAgendaItems, loadData, saveAgendaItems, saveData } from '../lib/storage'
import { isCloudEnabled } from '../lib/auth'
import { tasksForDay } from '../lib/tasks'

const SAVE_DEBOUNCE_MS = 700

export function useAppData(userId: string) {
  const [data, setData] = useState<AppData>(() => loadData(userId))
  const [agendaItems, setAgendaItems] = useState<string[]>(() => loadAgendaItems(userId))
  const [ready, setReady] = useState(!isCloudEnabled())
  const [syncing, setSyncing] = useState(false)

  const skipSaveRef = useRef(true)
  const saveTimerRef = useRef<number | null>(null)
  const lastSavedAtRef = useRef(0)
  const lastRemoteAtRef = useRef('')
  const applyingRemoteRef = useRef(false)

  const persistSnapshot = useCallback(
    async (nextData: AppData, nextAgenda: string[]) => {
      if (!isCloudEnabled()) return
      setSyncing(true)
      const updatedAt = await saveCloudSnapshot(userId, nextData, nextAgenda)
      if (updatedAt) {
        lastSavedAtRef.current = Date.parse(updatedAt)
        lastRemoteAtRef.current = updatedAt
      }
      setSyncing(false)
    },
    [userId],
  )

  const schedulePersist = useCallback(
    (nextData: AppData, nextAgenda: string[]) => {
      saveData(userId, nextData)
      saveAgendaItems(userId, nextAgenda)

      if (skipSaveRef.current || !isCloudEnabled()) return

      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = window.setTimeout(() => {
        void persistSnapshot(nextData, nextAgenda)
      }, SAVE_DEBOUNCE_MS)
    },
    [persistSnapshot, userId],
  )

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      skipSaveRef.current = true
      setReady(false)

      const localData = loadData(userId)
      const localAgenda = loadAgendaItems(userId)

      if (!isCloudEnabled()) {
        if (!cancelled) {
          setData(localData)
          setAgendaItems(localAgenda)
          skipSaveRef.current = false
          setReady(true)
        }
        return
      }

      const cloud = await fetchCloudSnapshot(userId)
      if (cancelled) return

      if (cloud) {
        lastRemoteAtRef.current = cloud.updated_at
        lastSavedAtRef.current = Date.parse(cloud.updated_at)
        setData(cloud.app_data)
        setAgendaItems(cloud.agenda)
        saveData(userId, cloud.app_data)
        saveAgendaItems(userId, cloud.agenda)
      } else if (hasMeaningfulData(localData) || localAgenda.length > 0) {
        setData(localData)
        setAgendaItems(localAgenda)
        await persistSnapshot(localData, localAgenda)
      } else {
        setData(localData)
        setAgendaItems(localAgenda)
      }

      skipSaveRef.current = false
      setReady(true)
    }

    void bootstrap()

    return () => {
      cancelled = true
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current)
    }
  }, [persistSnapshot, userId])

  useEffect(() => {
    if (!isCloudEnabled() || !ready) return

    return subscribeCloudSnapshot(userId, (snapshot) => {
      const remoteTime = Date.parse(snapshot.updated_at)
      if (remoteTime <= lastSavedAtRef.current) return
      if (snapshot.updated_at === lastRemoteAtRef.current) return

      applyingRemoteRef.current = true
      lastRemoteAtRef.current = snapshot.updated_at
      lastSavedAtRef.current = remoteTime
      setData(snapshot.app_data)
      setAgendaItems(snapshot.agenda)
      saveData(userId, snapshot.app_data)
      saveAgendaItems(userId, snapshot.agenda)
      window.setTimeout(() => {
        applyingRemoteRef.current = false
      }, 0)
    })
  }, [ready, userId])

  useEffect(() => {
    if (skipSaveRef.current || applyingRemoteRef.current) return
    schedulePersist(data, agendaItems)
  }, [agendaItems, data, schedulePersist])

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

  const replaceData = useCallback((nextData: AppData) => {
    setData(nextData)
  }, [])

  const addAgendaItem = useCallback((title: string) => {
    const clean = title.trim()
    if (!clean) return
    setAgendaItems((items) => [clean, ...items])
  }, [])

  const removeAgendaItem = useCallback((title: string) => {
    setAgendaItems((items) => {
      const index = items.findIndex((item) => item === title)
      if (index < 0) return items
      return [...items.slice(0, index), ...items.slice(index + 1)]
    })
  }, [])

  const sortedHabits = [...data.habits].sort((a, b) => a.order - b.order)

  return {
    data,
    habits: sortedHabits,
    agendaItems,
    ready,
    syncing,
    getDayLog,
    toggleTask,
    updateDayField,
    addTask,
    removeTask,
    resetDayPlan,
    createWorkout,
    deleteWorkout,
    updateExercise,
    setData: replaceData,
    addAgendaItem,
    removeAgendaItem,
  }
}

export type AppActions = ReturnType<typeof useAppData>
