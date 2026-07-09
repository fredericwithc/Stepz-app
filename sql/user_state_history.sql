-- Histórico versionado do estado Stepz (backup server-side).
-- Executar no SQL Editor do Supabase após user_state existir.

create table if not exists public.user_state_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  state jsonb not null,
  created_at timestamptz not null default now(),
  reason text not null default 'save'
);

create index if not exists user_state_history_user_created_idx
  on public.user_state_history (user_id, created_at desc);

alter table public.user_state_history enable row level security;

drop policy if exists "user_state_history_select_own" on public.user_state_history;
create policy "user_state_history_select_own"
  on public.user_state_history for select
  using (auth.uid() = user_id);

drop policy if exists "user_state_history_insert_own" on public.user_state_history;
create policy "user_state_history_insert_own"
  on public.user_state_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_state_history_delete_own" on public.user_state_history;
create policy "user_state_history_delete_own"
  on public.user_state_history for delete
  using (auth.uid() = user_id);
