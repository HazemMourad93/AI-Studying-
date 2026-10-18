-- THL AI Interviewer 33-day study progress, Supabase Postgres
-- Run in your OWN Supabase project's SQL Editor.
-- No API secret or service-role key is used by the static GitHub Pages website.
-- All user records are private with Row Level Security (RLS).

create table if not exists public.thl_study_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (item_id ~ '^(d[0-9]+[tw][0-9]+|p[0-9]+|[KR][0-9]+|ref[0-9]+)$'),
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.thl_study_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

alter table public.thl_study_items enable row level security;
alter table public.thl_study_preferences enable row level security;

revoke all on table public.thl_study_items from anon, authenticated;
revoke all on table public.thl_study_preferences from anon, authenticated;
grant select, insert, update on public.thl_study_items to authenticated;
grant select, insert, update on public.thl_study_preferences to authenticated;

drop policy if exists thl_items_own_select on public.thl_study_items;
create policy thl_items_own_select on public.thl_study_items
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists thl_items_own_insert on public.thl_study_items;
create policy thl_items_own_insert on public.thl_study_items
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists thl_items_own_update on public.thl_study_items;
create policy thl_items_own_update on public.thl_study_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists thl_pref_own_select on public.thl_study_preferences;
create policy thl_pref_own_select on public.thl_study_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists thl_pref_own_insert on public.thl_study_preferences;
create policy thl_pref_own_insert on public.thl_study_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists thl_pref_own_update on public.thl_study_preferences;
create policy thl_pref_own_update on public.thl_study_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Test after deployment:
-- 1. Signed-out user cannot SELECT, INSERT or UPDATE progress.
-- 2. Signed-in User A can upsert only their own task rows.
-- 3. User B cannot read or modify User A's rows, even when the user_id is supplied manually.
-- 4. Refresh the site in Chrome and Edge with the same Supabase email:
--    completed tasks and the dark/light preference must match.
