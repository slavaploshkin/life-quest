import type { AppData } from '../types'
import { defaultData, normalizeAppData } from './storage'
import { supabase, supabaseConfigured } from './supabase'

export interface UserSnapshot {
  app_data: AppData
  agenda: string[]
  updated_at: string
}

function emptySnapshot(): UserSnapshot {
  return {
    app_data: defaultData(),
    agenda: [],
    updated_at: new Date(0).toISOString(),
  }
}

export async function fetchCloudSnapshot(
  userId: string,
): Promise<{ snapshot: UserSnapshot | null; error: string | null }> {
  if (!supabaseConfigured || !supabase) {
    return { snapshot: null, error: 'Cloud is not configured' }
  }

  const { data, error } = await supabase
    .from('user_snapshots')
    .select('app_data, agenda, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Cloud fetch failed', error.message)
    return { snapshot: null, error: error.message }
  }

  if (!data) return { snapshot: null, error: null }

  const agenda = Array.isArray(data.agenda)
    ? data.agenda.filter((item): item is string => typeof item === 'string')
    : []

  return {
    snapshot: {
      app_data: normalizeAppData(data.app_data as AppData),
      agenda,
      updated_at: data.updated_at ?? new Date(0).toISOString(),
    },
    error: null,
  }
}

export async function saveCloudSnapshot(
  userId: string,
  appData: AppData,
  agenda: string[],
): Promise<{ updatedAt: string | null; error: string | null }> {
  if (!supabaseConfigured || !supabase) {
    return { updatedAt: null, error: 'Cloud is not configured' }
  }

  const updatedAt = new Date().toISOString()
  const payload = {
    user_id: userId,
    app_data: appData,
    agenda,
    updated_at: updatedAt,
  }

  const { error } = await supabase.from('user_snapshots').upsert(payload, { onConflict: 'user_id' })
  if (error) {
    console.error('Cloud save failed', error.message)
    return { updatedAt: null, error: error.message }
  }

  return { updatedAt, error: null }
}

export function snapshotScore(appData: AppData, agenda: string[]): number {
  let score = agenda.length
  score += appData.habits.length * 10
  score += Object.keys(appData.dayLogs).length * 5
  score += appData.workoutSessions.length * 5
  return score
}

export function subscribeCloudSnapshot(
  userId: string,
  onRemoteSnapshot: (snapshot: UserSnapshot) => void,
): () => void {
  if (!supabaseConfigured || !supabase) return () => {}

  const channel = supabase
    .channel(`user-snapshot:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_snapshots',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as {
          app_data?: AppData
          agenda?: unknown
          updated_at?: string
        } | null
        if (!row?.app_data) return

        const agenda = Array.isArray(row.agenda)
          ? row.agenda.filter((item): item is string => typeof item === 'string')
          : []

        onRemoteSnapshot({
          app_data: normalizeAppData(row.app_data),
          agenda,
          updated_at: row.updated_at ?? new Date().toISOString(),
        })
      },
    )
    .subscribe()

  return () => {
    if (supabase) void supabase.removeChannel(channel)
  }
}

export function hasMeaningfulData(data: AppData): boolean {
  return (
    data.habits.length > 0 ||
    data.workoutSessions.length > 0 ||
    Object.keys(data.dayLogs).length > 0
  )
}

export { emptySnapshot }
