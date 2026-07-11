export type Mood = '😢' | '😐' | '🙂' | '😊' | '🤩'

/** Как часто задача повторяется */
export type Recurrence = 'daily' | 'once' | 'weekdays' | 'weekends'

export interface Habit {
  id: string
  title: string
  order: number
  recurrence: Recurrence
  /** Только для recurrence === 'once' */
  onceDate?: string
}

/** Задача только на один конкретный день */
export interface DayTask {
  id: string
  title: string
  done: boolean
}

export interface DayLog {
  date: string
  completions: Record<string, boolean>
  extraTasks: DayTask[]
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

/** Задача, отображаемая в карточке дня (рекуррентная или разовая) */
export interface DisplayTask {
  id: string
  title: string
  kind: 'habit' | 'extra'
  done: boolean
}
