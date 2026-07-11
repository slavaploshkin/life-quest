import { useEffect, useState, type ReactNode } from 'react'
import {
  isCloudEnabled,
  restoreSession,
  signIn,
  signOut,
  type ActiveAccount,
} from '../lib/auth'
import styles from './PasscodeGate.module.css'

interface PasscodeGateProps {
  children: (props: { account: ActiveAccount; logout: () => void }) => ReactNode
}

export function PasscodeGate({ children }: PasscodeGateProps) {
  const [account, setAccount] = useState<ActiveAccount | null>(null)
  const [booting, setBooting] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!isCloudEnabled()) {
        if (!cancelled) {
          setBooting(false)
          setError('Cloud sync is not configured yet')
        }
        return
      }

      const remembered = await restoreSession()
      if (!cancelled) {
        setAccount(remembered)
        setBooting(false)
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [])

  const logout = async () => {
    await signOut()
    setAccount(null)
    setPassword('')
  }

  if (booting) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <p className={styles.label}>Life Quest</p>
          <h1 className={styles.title}>Loading your space…</h1>
        </div>
      </div>
    )
  }

  if (account) return children({ account, logout })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isCloudEnabled()) {
      setError('Cloud sync is not configured yet')
      return
    }

    setSubmitting(true)
    const nextAccount = await signIn(username, password)
    setSubmitting(false)

    if (nextAccount) {
      setAccount(nextAccount)
      setError('')
      return
    }

    setError('Wrong login or password')
  }

  return (
    <div className={styles.screen}>
      <div className={styles.orbOne} aria-hidden="true" />
      <div className={styles.orbTwo} aria-hidden="true" />
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.brandMark} aria-hidden="true">
          LQ
        </div>
        <p className={styles.label}>Life Quest</p>
        <h1 className={styles.title}>Enter your account</h1>
        <p className={styles.subtitle}>
          Your quests sync across phone and computer in real time.
        </p>

        <label className={styles.field}>
          <span>Login</span>
          <input
            className={styles.input}
            type="text"
            autoComplete="username"
            placeholder="your login"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError('')
            }}
            autoFocus
            disabled={submitting}
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
            disabled={submitting}
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Enter private space'}
        </button>

        <p className={styles.rememberNote}>This device remembers the account until you log out.</p>
      </form>
    </div>
  )
}
