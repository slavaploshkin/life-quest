import styles from './ProgressRing.module.css'

interface ProgressRingProps {
  pct: number
  size?: number
  stroke?: number
  label?: string
  large?: boolean
  glow?: boolean
}

export function ProgressRing({ pct, size = 72, stroke = 4, label, large, glow }: ProgressRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c

  return (
    <div
      className={`${styles.wrap} ${large ? styles.large : ''} ${glow ? styles.glow : ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className={styles.bg}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className={styles.fg}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className={styles.text}>{label ?? `${pct}%`}</span>
    </div>
  )
}
