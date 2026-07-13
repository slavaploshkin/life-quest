import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { enUS } from 'date-fns/locale'
import type { WorkoutSession } from '../types'
import styles from './WorkoutAnalytics.module.css'

interface ExerciseStat {
  name: string
  avgSets: number
  avgWeight: number
  maxWeight: number
  minWeight: number
  total: number
  history: { date: string; weight: number; diff: number | null }[]
}

function buildStats(sessions: WorkoutSession[]): ExerciseStat[] {
  const map = new Map<string, { sets: number[]; weights: number[]; history: ExerciseStat['history'] }>()

  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (!ex.name.trim() || ex.weightCurrent == null) continue
      const key = ex.name.trim().toLowerCase()
      const entry = map.get(key) ?? { sets: [], weights: [], history: [] }
      entry.sets.push(ex.sets)
      entry.weights.push(ex.weightCurrent)
      const prev = entry.history.length > 0 ? entry.history[entry.history.length - 1].weight : ex.weightPrevious
      entry.history.push({
        date: session.date,
        weight: ex.weightCurrent,
        diff: prev != null ? ex.weightCurrent - prev : null,
      })
      map.set(key, entry)
    }
  }

  return [...map.entries()]
    .map(([key, data]) => ({
      name: sessions.flatMap((s) => s.exercises).find((e) => e.name.trim().toLowerCase() === key)?.name.trim() ?? key,
      avgSets: data.sets.reduce((a, b) => a + b, 0) / data.sets.length,
      avgWeight: data.weights.reduce((a, b) => a + b, 0) / data.weights.length,
      maxWeight: Math.max(...data.weights),
      minWeight: Math.min(...data.weights),
      total: data.weights.length,
      history: data.history.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => b.total - a.total)
}

interface WorkoutAnalyticsProps {
  sessions: WorkoutSession[]
}

export function WorkoutAnalytics({ sessions }: WorkoutAnalyticsProps) {
  const stats = useMemo(() => buildStats(sessions), [sessions])
  const [selected, setSelected] = useState<string | null>(null)

  const active = stats.find((s) => s.name === selected) ?? stats[0] ?? null
  const totalWorkouts = sessions.length
  const avgPerDay =
    totalWorkouts > 0
      ? Math.round(
          totalWorkouts /
            Math.max(
              1,
              new Set(sessions.map((s) => s.date)).size,
            ),
        )
      : 0

  const chartMax = active ? Math.max(...active.history.map((h) => h.weight), 10) : 100

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <p className={styles.meta}>Total workouts: {totalWorkouts}</p>
          <p className={styles.meta}>Average per active day: {avgPerDay}</p>
        </div>
        {active && (
          <div className={styles.chartBox}>
            <h3 className={styles.chartTitle}>{active.name}</h3>
            <div className={styles.chart}>
              {active.history.map((h, i) => {
                const pct = (h.weight / chartMax) * 100
                const label = format(parseISO(h.date), 'd MMM', { locale: enUS })
                return (
                  <div key={`${h.date}-${i}`} className={styles.barCol}>
                    {h.diff != null && h.diff !== 0 && (
                      <span className={h.diff > 0 ? styles.diffUp : styles.diffDown}>
                        {h.diff > 0 ? '+' : ''}
                        {h.diff}
                      </span>
                    )}
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ height: `${pct}%` }} />
                    </div>
                    <span className={styles.barDate}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Exercise</th>
              <th>Avg sets</th>
              <th>Avg weight</th>
              <th>Max</th>
              <th>Min</th>
              <th>Total</th>
              <th>Chart</th>
            </tr>
          </thead>
          <tbody>
            {stats.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  Log workouts to see stats here
                </td>
              </tr>
            ) : (
              stats.map((s, i) => (
                <tr key={s.name} className={active?.name === s.name ? styles.selected : ''}>
                  <td className={styles.num}>{i + 1}</td>
                  <td>{s.name}</td>
                  <td>{s.avgSets.toFixed(0)}</td>
                  <td>{s.avgWeight.toFixed(1)}</td>
                  <td className={styles.max}>{s.maxWeight.toFixed(1)}</td>
                  <td className={styles.min}>{s.minWeight.toFixed(1)}</td>
                  <td>{s.total}</td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.check} ${active?.name === s.name ? styles.checked : ''}`}
                      onClick={() => setSelected(s.name)}
                      aria-pressed={active?.name === s.name}
                    >
                      {active?.name === s.name && '✓'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
