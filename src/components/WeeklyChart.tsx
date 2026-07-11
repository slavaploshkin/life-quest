import type { WeekDayStat } from '../lib/stats'
import { weekAverage, bestWorstDay } from '../lib/stats'
import { ProgressRing } from './ProgressRing'
import styles from './WeeklyChart.module.css'

interface WeeklyChartProps {
  stats: WeekDayStat[]
  rangeLabel?: string
  compact?: boolean
}

export function WeeklyChart({ stats, rangeLabel, compact }: WeeklyChartProps) {
  const avg = weekAverage(stats)
  const { best, worst } = bestWorstDay(stats)

  return (
    <section className={`${styles.section} ${compact ? styles.compact : ''}`}>
      <div className={styles.layout}>
        <div className={styles.left}>
          <h2 className={styles.title}>Weekly progress</h2>
          {rangeLabel && <p className={styles.subtitle}>{rangeLabel}</p>}

          <div className={styles.chart}>
            {stats.map((d) => (
              <div key={d.date} className={styles.barCol}>
                <span className={styles.barPct}>{d.pct > 0 ? `${d.pct}%` : ''}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ height: `${Math.max(d.pct, d.pct > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className={styles.barLabel}>{d.shortLabel}</span>
              </div>
            ))}
          </div>

          <div className={styles.meta}>
            {best && (
              <span className={styles.best}>
                ↑ best: <strong>{best.shortLabel}</strong> ({best.pct}%)
              </span>
            )}
            {worst && worst.date !== best?.date && (
              <span className={styles.worst}>
                ↓ worst: <strong>{worst.shortLabel}</strong> ({worst.pct}%)
              </span>
            )}
          </div>
        </div>

        <div className={styles.ringCol}>
          <ProgressRing pct={avg} size={88} stroke={7} large glow />
          <span className={styles.ringCaption}>average</span>
        </div>
      </div>
    </section>
  )
}
