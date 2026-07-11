import { useState, type ReactNode } from 'react'
import {
  configuredAccounts,
  getRememberedAccount,
  signIn,
  signOut,
  type ActiveAccount,
} from '../lib/auth'
import styles from './PasscodeGate.module.css'

interface PasscodeGateProps {
  children: (props: { account: ActiveAccount; logout: () => void }) => ReactNode
}

export function PasscodeGate({ children }: PasscodeGateProps) {
  const [account, setAccount] = useState<ActiveAccount | null>(() => getRememberedAccount())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const logout = () => {
    signOut()
    setAccount(null)
    setPassword('')
  }

  if (account) return children({ account, logout })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (configuredAccounts.length === 0) {
      setError('Accounts are not configured yet')
      return
    }

    const nextAccount = signIn(username, password)
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
        <p className={styles.subtitle}>Your quests, days, workouts, and agenda stay separate.</p>

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
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.button} type="submit">
          Enter private space
        </button>

        <p className={styles.rememberNote}>This device remembers the account until you log out.</p>
      </form>
    </div>
  )
}
