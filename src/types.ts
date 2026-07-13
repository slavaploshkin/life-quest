export type Mood = '😢' | '😐' | '🙂' | '😊' | '🤩'

/** How often a quest repeats */
export type Recurrence = 'daily' | 'once' | 'weekdays' | 'weekends'

export interface Habit {
  id: string
  title: string
  order: number
  recurrence: Recurrence
  /** Only when recurrence === 'once' */
  onceDate?: string
}

/** One-off quest for a specific day */
export interface DayTask {
  id: string
  title: string
  done: boolean
}

export interface DayLog {
  date: string
  completions: Record<string, boolean>
  extraTasks: DayTask[]
  /** Recurring habit ids hidden for this specific day only */
  skippedHabitIds?: string[]
  lesson: string
  sleepHours: number | null
  energy: 1 | 2 | 3 | 4 | null
  mood: Mood | null
}

export interface WorkoutExercise {
  id: string
  name: string
  sets: number
  weightCurrent: number | null
  weightPrevious: number | null
  done: boolean
}

export interface WorkoutSession {
  id: string
  date: string
  number: number
  exercises: WorkoutExercise[]
}

export interface AppData {
  habits: Habit[]
  dayLogs: Record<string, DayLog>
  workoutSessions: WorkoutSession[]
  nextWorkoutNumber: number
}

export type Tab = 'day' | 'progress' | 'workout' | 'analytics'

/** Quest shown in a day card (recurring or one-off) */
export interface DisplayTask {
  id: string
  title: string
  kind: 'habit' | 'extra'
  done: boolean
}
