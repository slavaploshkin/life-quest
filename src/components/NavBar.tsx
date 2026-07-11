import type { Tab } from '../types'
import styles from './NavBar.module.css'

const TABS: { id: Tab; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'progress', label: 'Progress' },
  { id: 'workout', label: 'Gym' },
  { id: 'analytics', label: 'Stats' },
]

interface NavBarProps {
  active: Tab
  accountName: string
  syncing?: boolean
  syncError?: string | null
  onPushSync?: () => void
  onChange: (tab: Tab) => void
  onExport: () => void
  onLogout: () => void
}

function TabIcon({ id }: { id: Tab }) {
  if (id === 'day') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v3M17 3v3M4.5 9h15M6.5 5h11A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10A2.5 2.5 0 0 1 6.5 5Z" />
        <path d="M8 13h3v3H8z" />
      </svg>
    )
  }

  if (id === 'progress') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19V5M5 19h14" />
        <path d="M8 16v-4M12 16V8M16 16v-7" />
      </svg>
    )
  }

  if (id === 'workout') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10v4M8 8v8M16 8v8M20 10v4M8 12h8" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18V6M10 18v-8M15 18V4M20 18v-5" />
      <path d="M4 20h17" />
    </svg>
  )
}

export function NavBar({
  active,
  accountName,
  syncing = false,
  syncError = null,
  onPushSync,
  onChange,
  onExport,
  onLogout,
}: NavBarProps) {
  return (
    <nav className={styles.nav}>
      <div
        className={styles.account}
        title={syncError ? `Sync error: ${syncError}` : accountName}
      >
        {accountName.slice(0, 1).toUpperCase()}
        {syncing && <span className={styles.syncDot} aria-label="Syncing" />}
        {syncError && !syncing && <span className={styles.syncErrorDot} aria-label="Sync error" />}
      </div>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${active === t.id ? styles.active : ''}`}
            onClick={() => onChange(t.id)}
          >
            <span className={styles.tabIcon}>
              <TabIcon id={t.id} />
            </span>
            <span className={styles.tabLabel}>{t.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className={styles.exportBtn} onClick={onExport} title="Экспорт данных">
        ↓
      </button>
      {onPushSync && (
        <button
          type="button"
          className={styles.syncBtn}
          onClick={onPushSync}
          title={syncError ? `Sync error: ${syncError}. Tap to retry.` : 'Upload data to cloud'}
        >
          ↻
        </button>
      )}
      <button type="button" className={styles.logoutBtn} onClick={onLogout} title="Logout">
        out
      </button>
    </nav>
  )
}
