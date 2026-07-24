-- Méthode Tee V255 — synchronisation des trackers sans modifier protocol_progress
-- À exécuter dans Supabase SQL Editor avant de tester la synchronisation multi-appareils.

create table if not exists public.tracker_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  protocol_id uuid references public.protocols(id) on delete cascade,
  content_id uuid not null references public.protocol_contents(id) on delete cascade,
  entry_date date not null,
  values jsonb not null default '{}'::jsonb,
  field_schema jsonb not null default '[]'::jsonb,
  device_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracker_entries_values_object check (jsonb_typeof(values) = 'object'),
  constraint tracker_entries_schema_array check (jsonb_typeof(field_schema) = 'array'),
  unique(user_id, content_id, entry_date)
);

create index if not exists tracker_entries_user_content_date_idx
  on public.tracker_entries(user_id, content_id, entry_date desc);
create index if not exists tracker_entries_user_protocol_date_idx
  on public.tracker_entries(user_id, protocol_id, entry_date desc);

create or replace function public.set_tracker_entry_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracker_entries_set_updated_at on public.tracker_entries;
create trigger tracker_entries_set_updated_at
before update on public.tracker_entries
for each row execute function public.set_tracker_entry_updated_at();

alter table public.tracker_entries enable row level security;

drop policy if exists tracker_entries_select_own on public.tracker_entries;
create policy tracker_entries_select_own on public.tracker_entries
for select to authenticated using (auth.uid() = user_id);

drop policy if exists tracker_entries_insert_own on public.tracker_entries;
create policy tracker_entries_insert_own on public.tracker_entries
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists tracker_entries_update_own on public.tracker_entries;
create policy tracker_entries_update_own on public.tracker_entries
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists tracker_entries_delete_own on public.tracker_entries;
create policy tracker_entries_delete_own on public.tracker_entries
for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.tracker_entries to authenticated;
revoke all on public.tracker_entries from anon;
