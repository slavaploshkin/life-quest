import { format } from 'date-fns'
import type { AppActions } from '../hooks/useAppData'
import type { WorkoutExercise, WorkoutSession } from '../types'
import { formatDateRu } from '../lib/stats'
import styles from './WorkoutSessionView.module.css'

interface WorkoutSessionViewProps {
  session: WorkoutSession
  actions: AppActions
}

function exerciseCounts(exercises: WorkoutExercise[]) {
  const active = exercises.filter((e) => e.name.trim())
  const done = active.filter((e) => e.done).length
  return { done, remaining: active.length - done, total: active.length }
}

export function WorkoutSessionView({ session, actions }: WorkoutSessionViewProps) {
  const counts = exerciseCounts(session.exercises)

  const patch = (exerciseId: string, patch: Partial<WorkoutExercise>) => {
    actions.updateExercise(session.id, exerciseId, patch)
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Тренировка №{session.number}</h2>
          <span className={styles.date}>{formatDateRu(session.date)}</span>
        </div>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={() => {
            if (confirm('Удалить эту тренировку?')) actions.deleteWorkout(session.id)
          }}
        >
          ✕
        </button>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colNum}>#</th>
              <th className={styles.colName}>Упражнения</th>
              <th className={styles.colSets}>П</th>
              <th colSpan={3} className={styles.colWeightsHead}>
                Веса
              </th>
              <th className={styles.colCheck} />
            </tr>
            <tr className={styles.subHead}>
              <th colSpan={3} />
              <th>Тек</th>
              <th>Пред</th>
              <th>Р-ца</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {session.exercises.map((ex, i) => {
              const diff =
                ex.weightCurrent != null && ex.weightPrevious != null
                  ? ex.weightCurrent - ex.weightPrevious
                  : null
              return (
                <tr key={ex.id} className={ex.done ? styles.rowDone : ''}>
                  <td className={styles.num}>{i + 1}</td>
                  <td>
                    <input
                      className={styles.nameInput}
                      value={ex.name}
                      placeholder="упражнение"
                      onChange={(e) => patch(ex.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.numInput}
                      type="number"
                      min={1}
                      value={ex.sets}
                      onChange={(e) => patch(ex.id, { sets: Number(e.target.value) || 1 })}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.numInput}
                      type="number"
                      step="0.5"
                      value={ex.weightCurrent ?? ''}
                      placeholder="—"
                      onChange={(e) =>
                        patch(ex.id, {
                          weightCurrent: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.numInput}
                      type="number"
                      step="0.5"
                      value={ex.weightPrevious ?? ''}
                      placeholder="—"
                      onChange={(e) =>
                        patch(ex.id, {
                          weightPrevious: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </td>
                  <td className={styles.diff}>
                    {diff != null && (
                      <span className={diff >= 0 ? styles.diffUp : styles.diffDown}>
                        {diff >= 0 ? '+' : ''}
                        {diff}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.check} ${ex.done ? styles.checked : ''}`}
                      onClick={() => patch(ex.id, { done: !ex.done })}
                      disabled={!ex.name.trim()}
                      aria-pressed={ex.done}
                    >
                      {ex.done && '✓'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.summary}>
        <div>
          <span className={styles.summaryLabel}>Выполнено</span>
          <span className={styles.summaryVal}>{counts.done}</span>
        </div>
        <div>
          <span className={styles.summaryLabel}>Осталось</span>
          <span className={styles.summaryVal}>{counts.remaining}</span>
        </div>
      </div>
    </section>
  )
}

export function WorkoutList({
  sessions,
  actions,
  onCreate,
}: {
  sessions: WorkoutSession[]
  actions: AppActions
  onCreate: () => void
}) {
  return (
    <div className={styles.list}>
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>Тренировки</h2>
        <button type="button" className={styles.newBtn} onClick={onCreate}>
          + Новая
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className={styles.empty}>Нет тренировок. Создай первую!</p>
      ) : (
        sessions.map((s) => <WorkoutSessionView key={s.id} session={s} actions={actions} />)
      )}
    </div>
  )
}

export function createTodayWorkout(actions: AppActions) {
  return actions.createWorkout(format(new Date(), 'yyyy-MM-dd'))
}
