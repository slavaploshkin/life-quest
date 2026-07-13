import type { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import styles from './VoiceRecorderBar.module.css'

type VoiceState = ReturnType<typeof useVoiceRecorder>

interface VoiceRecorderBarProps {
  voice: VoiceState
  onCancel: () => void
  onConfirm: () => void
}

export function VoiceRecorderBar({ voice, onCancel, onConfirm }: VoiceRecorderBarProps) {
  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={onCancel}
        disabled={voice.transcribing}
        aria-label="Cancel recording"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <div className={styles.center}>
        <div className={styles.waveFrame}>
          <div className={styles.wave} aria-hidden="true">
            {voice.levels.map((level, index) => (
              <span
                key={index}
                className={styles.waveBar}
                style={{ transform: `scaleY(${level})` }}
              />
            ))}
          </div>
        </div>
        <span className={styles.timer}>{voice.elapsedLabel}</span>
      </div>

      <button
        type="button"
        className={`${styles.iconBtn} ${styles.confirmBtn}`}
        onClick={onConfirm}
        disabled={voice.transcribing}
        aria-label="Send recording"
      >
        {voice.transcribing ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    </div>
  )
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
    </svg>
  )
}
