import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'

export interface LocalAccount {
  username: string
  password: string
  displayName: string
  storageId: string
}

export interface ActiveAccount {
  userId: string
  storageId: string
  username: string
  displayName: string
}

const ACTIVE_ACCOUNT_KEY = 'life-quest-active-account'
const AUTH_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN?.trim() || 'life-quest.app'

const rawAccounts: LocalAccount[] = [
  {
    username: import.meta.env.VITE_ACCOUNT_1_USERNAME ?? '',
    password: import.meta.env.VITE_ACCOUNT_1_PASSWORD ?? '',
    displayName: import.meta.env.VITE_ACCOUNT_1_NAME ?? '',
    storageId: 'account-1',
  },
  {
    username: import.meta.env.VITE_ACCOUNT_2_USERNAME ?? '',
    password: import.meta.env.VITE_ACCOUNT_2_PASSWORD ?? '',
    displayName: import.meta.env.VITE_ACCOUNT_2_NAME ?? '',
    storageId: 'account-2',
  },
]

export const configuredAccounts = rawAccounts
  .map((account) => ({
    ...account,
    username: account.username.trim(),
    password: account.password.trim(),
    displayName: account.displayName.trim() || account.username.trim(),
  }))
  .filter((account) => account.username && account.password)

function authEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_DOMAIN}`
}

function findLocalAccount(username: string, password: string): LocalAccount | null {
  const cleanUsername = username.trim().toLowerCase()
  const cleanPassword = password.trim()
  const account = configuredAccounts.find(
    (item) => item.username.toLowerCase() === cleanUsername && item.password === cleanPassword,
  )
  return account ?? null
}

function toActiveAccount(account: LocalAccount, userId: string): ActiveAccount {
  return {
    userId,
    storageId: account.storageId,
    username: account.username,
    displayName: account.displayName,
  }
}

function accountFromSession(session: Session): ActiveAccount | null {
  const email = session.user.email ?? ''
  const username = email.split('@')[0]?.toLowerCase() ?? ''
  const account = configuredAccounts.find((item) => item.username.toLowerCase() === username)
  if (!account) return null
  return toActiveAccount(account, session.user.id)
}

async function ensureSupabaseSession(account: LocalAccount, password: string): Promise<Session | null> {
  if (!supabase) return null

  const email = authEmail(account.username)
  const cleanPassword = password.trim()

  const signInResult = await supabase.auth.signInWithPassword({
    email,
    password: cleanPassword,
  })

  if (signInResult.data.session) return signInResult.data.session

  const signUpResult = await supabase.auth.signUp({
    email,
    password: cleanPassword,
  })

  if (signUpResult.error && !signUpResult.data.session) return null
  if (signUpResult.data.session) return signUpResult.data.session

  const retry = await supabase.auth.signInWithPassword({
    email,
    password: cleanPassword,
  })

  return retry.data.session ?? null
}

function rememberAccount(storageId: string): void {
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, storageId)
}

export async function signIn(username: string, password: string): Promise<ActiveAccount | null> {
  if (configuredAccounts.length === 0) return null

  const account = findLocalAccount(username, password)
  if (!account) return null

  rememberAccount(account.storageId)

  if (!supabaseConfigured || !supabase) {
    return toActiveAccount(account, account.storageId)
  }

  const session = await ensureSupabaseSession(account, password)
  if (!session) return null

  return toActiveAccount(account, session.user.id)
}

export async function restoreSession(): Promise<ActiveAccount | null> {
  const storageId = localStorage.getItem(ACTIVE_ACCOUNT_KEY)
  const localAccount = storageId
    ? configuredAccounts.find((item) => item.storageId === storageId)
    : null

  if (!supabaseConfigured || !supabase) {
    return localAccount ? toActiveAccount(localAccount, localAccount.storageId) : null
  }

  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return null

  const fromSession = accountFromSession(data.session)
  if (fromSession) {
    rememberAccount(fromSession.storageId)
    return fromSession
  }

  return localAccount ? toActiveAccount(localAccount, localAccount.storageId) : null
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  if (supabaseConfigured && supabase) {
    await supabase.auth.signOut()
  }
}

export function isCloudEnabled(): boolean {
  return supabaseConfigured
}
