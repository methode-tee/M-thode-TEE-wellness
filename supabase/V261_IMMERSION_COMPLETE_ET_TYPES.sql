-- Méthode Tee V261 — Immersion complète « Notre journée ensemble »
-- Module totalement indépendant de daily_rituals et des systèmes d'achat/protocoles.

create extension if not exists "pgcrypto";

create table if not exists public.community_journey_settings (
  id integer primary key default 1 check (id = 1),
  title text not null default 'Notre journée ensemble',
  subtitle text not null default 'Les rendez-vous de la communauté au rythme de ta journée.',
  show_member_count boolean not null default true,
  member_minimum integer not null default 50 check (member_minimum >= 0),
  timezone_mode text not null default 'local' check (timezone_mode in ('local','europe_paris')),
  empty_message text not null default 'La journée se vit plus librement aujourd’hui.',
  updated_at timestamptz not null default now()
);

insert into public.community_journey_settings(id)
values (1)
on conflict (id) do nothing;

create table if not exists public.community_journey_items (
  id uuid primary key default gen_random_uuid(),
  journey_date date not null,
  slot_key text not null check (slot_key in ('wake_up','morning','lunch','afternoon','evening','before_sleep')),
  scheduled_time time,
  title text not null,
  short_text text not null default '',
  linked_content_type text,
  linked_content_id text,
  linked_url text,
  display_order integer not null default 0,
  show_on_home boolean not null default false,
  show_as_pill boolean not null default false,
  pill_label text,
  validation_enabled boolean not null default true,
  validation_label text,
  completed_label text,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  notification_enabled boolean not null default false,
  notification_time time,
  notification_title text,
  notification_body text,
  notification_target_type text,
  notification_target_id text,
  notification_sent_at timestamptz,
  icon_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_journey_items_date_idx
  on public.community_journey_items(journey_date, is_active, status, display_order);
create index if not exists community_journey_items_home_idx
  on public.community_journey_items(journey_date, show_on_home, display_order)
  where is_active = true and status in ('scheduled','published');

create table if not exists public.community_journey_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  journey_item_id uuid not null references public.community_journey_items(id) on delete cascade,
  journey_date date not null,
  completed boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, journey_item_id, journey_date)
);

create index if not exists community_journey_completions_user_date_idx
  on public.community_journey_completions(user_id, journey_date);

create table if not exists public.community_journey_participation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  journey_date date not null,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  first_completed_at timestamptz,
  unique(user_id, journey_date)
);

create index if not exists community_journey_participation_date_idx
  on public.community_journey_participation(journey_date);

alter table public.community_journey_settings enable row level security;
alter table public.community_journey_items enable row level security;
alter table public.community_journey_completions enable row level security;
alter table public.community_journey_participation enable row level security;

drop policy if exists "community_journey_settings_read" on public.community_journey_settings;
create policy "community_journey_settings_read"
  on public.community_journey_settings for select using (true);

drop policy if exists "community_journey_settings_admin" on public.community_journey_settings;
create policy "community_journey_settings_admin"
  on public.community_journey_settings for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "community_journey_items_read" on public.community_journey_items;
create policy "community_journey_items_read"
  on public.community_journey_items for select
  using (is_active = true and status in ('scheduled','published') or public.is_admin());

drop policy if exists "community_journey_items_admin" on public.community_journey_items;
create policy "community_journey_items_admin"
  on public.community_journey_items for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "community_journey_completions_own" on public.community_journey_completions;
create policy "community_journey_completions_own"
  on public.community_journey_completions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "community_journey_participation_own" on public.community_journey_participation;
create policy "community_journey_participation_own"
  on public.community_journey_participation for select
  using (auth.uid() = user_id);

drop policy if exists "community_journey_participation_insert" on public.community_journey_participation;
create policy "community_journey_participation_insert"
  on public.community_journey_participation for insert
  with check (auth.uid() = user_id);

drop policy if exists "community_journey_participation_update" on public.community_journey_participation;
create policy "community_journey_participation_update"
  on public.community_journey_participation for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Payload unique : rendez-vous du jour, réglages, validations du compte et compteur agrégé.
create or replace function public.community_journey_payload(target_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  payload jsonb;
begin
  select jsonb_build_object(
    'date', target_date,
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.display_order, i.scheduled_time nulls last, i.created_at)
      from (
        select id, journey_date, slot_key, scheduled_time, title, short_text,
               linked_content_type, linked_content_id, linked_url, display_order,
               show_on_home, show_as_pill, pill_label, validation_enabled,
               validation_label, completed_label, status, notification_enabled,
               notification_time, notification_title, notification_body,
               notification_target_type, notification_target_id, icon_key, is_active
        from public.community_journey_items
        where journey_date = target_date
          and is_active = true
          and status in ('scheduled','published')
        order by display_order, scheduled_time nulls last, created_at
      ) i
    ), '[]'::jsonb),
    'settings', coalesce((
      select to_jsonb(s) from public.community_journey_settings s where s.id = 1
    ), jsonb_build_object(
      'title','Notre journée ensemble',
      'subtitle','Les rendez-vous de la communauté au rythme de ta journée.',
      'show_member_count',true,
      'member_minimum',50,
      'timezone_mode','local',
      'empty_message','La journée se vit plus librement aujourd’hui.'
    )),
    'member_count', (
      select count(*)::integer
      from public.community_journey_participation p
      where p.journey_date = target_date
    ),
    'completions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'journey_item_id', c.journey_item_id,
        'completed', c.completed,
        'completed_at', c.completed_at,
        'updated_at', c.updated_at
      ))
      from public.community_journey_completions c
      where c.user_id = auth.uid() and c.journey_date = target_date
    ), '[]'::jsonb)
  ) into payload;
  return payload;
end;
$$;

grant execute on function public.community_journey_payload(date) to anon, authenticated;

-- Une participante unique par compte et par date. L'ouverture de la vue complète suffit.
create or replace function public.community_journey_participate(target_date date, completed_now boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return (select count(*)::integer from public.community_journey_participation where journey_date = target_date);
  end if;

  insert into public.community_journey_participation(
    user_id, journey_date, first_opened_at, last_opened_at, first_completed_at
  ) values (
    auth.uid(), target_date, now(), now(), case when completed_now then now() else null end
  )
  on conflict (user_id, journey_date) do update set
    last_opened_at = now(),
    first_completed_at = coalesce(public.community_journey_participation.first_completed_at,
      case when completed_now then now() else null end);

  return (select count(*)::integer from public.community_journey_participation where journey_date = target_date);
end;
$$;

grant execute on function public.community_journey_participate(date, boolean) to authenticated;

-- Duplication ciblée d'une journée, réservée à l'admin. Aucun effacement global.
create or replace function public.community_journey_duplicate_day(source_date date, target_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inserted_count integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  insert into public.community_journey_items(
    journey_date, slot_key, scheduled_time, title, short_text,
    linked_content_type, linked_content_id, linked_url, display_order,
    show_on_home, show_as_pill, pill_label, validation_enabled,
    validation_label, completed_label, status, notification_enabled,
    notification_time, notification_title, notification_body,
    notification_target_type, notification_target_id, icon_key, is_active
  )
  select target_date, slot_key, scheduled_time, title, short_text,
    linked_content_type, linked_content_id, linked_url, display_order,
    show_on_home, show_as_pill, pill_label, validation_enabled,
    validation_label, completed_label, status, notification_enabled,
    notification_time, notification_title, notification_body,
    notification_target_type, notification_target_id, icon_key, is_active
  from public.community_journey_items
  where journey_date = source_date and is_active = true;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.community_journey_duplicate_day(date, date) to authenticated;

comment on table public.community_journey_items is 'Rendez-vous collectifs indépendants de daily_rituals.';
comment on function public.community_journey_payload(date) is 'Payload compact d’une seule journée : items, réglages, compteur et validations.';
