-- Run once in Supabase -> SQL Editor -> New query -> Run

create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  app_data jsonb not null default '{}'::jsonb,
  agenda jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_snapshots enable row level security;

create policy "Users read own snapshot"
  on public.user_snapshots
  for select
  using (auth.uid() = user_id);

create policy "Users insert own snapshot"
  on public.user_snapshots
  for insert
  with check (auth.uid() = user_id);

create policy "Users update own snapshot"
  on public.user_snapshots
  for update
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.user_snapshots;
