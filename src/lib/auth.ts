import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'

export interface ActiveAccount {
  userId: string
  username: string
  displayName: string
}

const AUTH_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN?.trim() || 'life-quest.app'

const displayNames = new Map<string, string>(
  [
    [import.meta.env.VITE_ACCOUNT_1_USERNAME, import.meta.env.VITE_ACCOUNT_1_NAME],
    [import.meta.env.VITE_ACCOUNT_2_USERNAME, import.meta.env.VITE_ACCOUNT_2_NAME],
  ]
    .map(([username, name]) => [String(username ?? '').trim().toLowerCase(), String(name ?? '').trim()] as const)
    .filter(([username]) => username.length > 0),
)

function authEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_DOMAIN}`
}

function accountFromSession(session: Session): ActiveAccount {
  const email = session.user.email ?? ''
  const username = email.split('@')[0]?.toLowerCase() ?? 'user'
  const displayName = displayNames.get(username) || username

  return {
    userId: session.user.id,
    username,
    displayName,
  }
}

export async function signIn(username: string, password: string): Promise<ActiveAccount | null> {
  if (!supabaseConfigured || !supabase) return null

  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail(username),
    password: password.trim(),
  })

  if (error || !data.session) return null
  return accountFromSession(data.session)
}

export async function restoreSession(): Promise<ActiveAccount | null> {
  if (!supabaseConfigured || !supabase) return null

  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return null
  return accountFromSession(data.session)
}

export async function signOut(): Promise<void> {
  if (!supabaseConfigured || !supabase) return
  await supabase.auth.signOut()
}

export function isCloudEnabled(): boolean {
  return supabaseConfigured
}

export function authEmailHint(username: string): string {
  return authEmail(username)
}
