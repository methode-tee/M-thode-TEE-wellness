-- V372 — MES FAVORIS & MES ROUTINES
-- À exécuter UNE FOIS dans Supabase SQL Editor AVANT de tester le patch V372.
--
-- Objectifs :
-- 1) Favoris universels, synchronisés, sans limite locale arbitraire.
-- 2) Mes routines = vraies routines personnelles avec étapes et fréquence.
-- 3) Une routine réalisée alimente Aujourd’hui, Mon parcours et Mon Équilibre.
-- 4) Aucune lecture Supabase supplémentaire au démarrage :
--    le résumé routine est intégré à la lecture compacte d’Aujourd’hui.
-- 5) Aucune animation existante n’est modifiée.

begin;

-- -------------------------------------------------------------------
-- FAVORIS
-- -------------------------------------------------------------------

create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  item_type text,
  item_id text,
  created_at timestamptz default now(),
  unique(user_id, item_type, item_id)
);

alter table public.user_favorites
  add column if not exists title text null;

alter table public.user_favorites
  add column if not exists description text null;

alter table public.user_favorites
  add column if not exists source text null;

alter table public.user_favorites
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.user_favorites
  add column if not exists updated_at timestamptz not null default now();

create index if not exists user_favorites_user_updated_idx
  on public.user_favorites(user_id, updated_at desc);

alter table public.user_favorites enable row level security;

drop policy if exists "favorites_own" on public.user_favorites;
drop policy if exists "user_favorites own" on public.user_favorites;

create policy "favorites_own"
on public.user_favorites
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete
on public.user_favorites
to authenticated;


-- -------------------------------------------------------------------
-- ROUTINES PERSONNELLES
-- -------------------------------------------------------------------

create table if not exists public.user_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.user_routines
  add column if not exists daypart text not null default 'morning';

alter table public.user_routines
  add column if not exists frequency text not null default 'daily';

alter table public.user_routines
  add column if not exists weekdays smallint[] not null default '{}'::smallint[];

alter table public.user_routines
  add column if not exists steps jsonb not null default '[]'::jsonb;

alter table public.user_routines
  add column if not exists source_items jsonb not null default '[]'::jsonb;

alter table public.user_routines
  add column if not exists updated_at timestamptz not null default now();

-- Les éventuelles anciennes lignes V14 n'avaient pas d'étapes structurées.
-- On les conserve comme vraies routines au lieu de les rendre impossibles à valider.
update public.user_routines
set steps = jsonb_build_array(
  coalesce(nullif(trim(description), ''), title)
)
where coalesce(status,'active') = 'active'
  and jsonb_typeof(coalesce(steps,'[]'::jsonb)) = 'array'
  and jsonb_array_length(coalesce(steps,'[]'::jsonb)) = 0
  and coalesce(nullif(trim(description), ''), nullif(trim(title), '')) is not null;

create index if not exists user_routines_user_status_idx
  on public.user_routines(user_id, status, updated_at desc);

alter table public.user_routines enable row level security;

drop policy if exists "routines_own" on public.user_routines;
drop policy if exists "user_routines own" on public.user_routines;

create policy "routines_own"
on public.user_routines
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete
on public.user_routines
to authenticated;


-- -------------------------------------------------------------------
-- JOURNAL QUOTIDIEN D’UNE ROUTINE
-- -------------------------------------------------------------------

create table if not exists public.user_routine_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null references public.user_routines(id) on delete cascade,
  entry_date date not null,
  step_state jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, routine_id, entry_date)
);

create index if not exists user_routine_entries_user_date_idx
  on public.user_routine_entries(user_id, entry_date desc);

alter table public.user_routine_entries enable row level security;

drop policy if exists "user_routine_entries own" on public.user_routine_entries;

create policy "user_routine_entries own"
on public.user_routine_entries
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete
on public.user_routine_entries
to authenticated;


-- Compatibilité avec les différentes bases historiques de Méthode TEE.
alter table public.daily_activity
  add column if not exists today_checks jsonb not null default '{}'::jsonb;
alter table public.daily_activity
  add column if not exists has_hydration boolean default false;
alter table public.daily_activity
  add column if not exists has_sleep boolean default false;
alter table public.daily_activity
  add column if not exists has_protocol boolean default false;
alter table public.daily_activity
  add column if not exists has_routine boolean default false;
alter table public.daily_activity
  add column if not exists has_ritual boolean default false;
alter table public.daily_activity
  add column if not exists has_checklist boolean default false;
alter table public.daily_activity
  add column if not exists has_tracker boolean default false;
alter table public.daily_activity
  add column if not exists has_journal boolean default false;
alter table public.daily_activity
  add column if not exists has_photo boolean default false;
alter table public.daily_activity
  add column if not exists has_recipe boolean default false;
alter table public.daily_activity
  add column if not exists hydration_liters numeric default 0;
alter table public.daily_activity
  add column if not exists sleep_hours numeric default 0;
alter table public.daily_activity
  add column if not exists protocol_title text null;
alter table public.daily_activity
  add column if not exists protocol_day integer null;

-- -------------------------------------------------------------------
-- ENREGISTRER LA PROGRESSION D’UNE ROUTINE
-- -------------------------------------------------------------------

create or replace function public.user_routine_save_day(
  target_routine uuid,
  target_date date,
  target_step_state jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  routine_row public.user_routines%rowtype;
  step_count integer := 0;
  done_steps integer := 0;
  routine_done boolean := false;
  scheduled_count integer := 0;
  scheduled_done integer := 0;
  any_done integer := 0;
  day_done boolean := false;
  iso_day integer := extract(isodow from target_date);
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if target_date < current_date - 6 or target_date > current_date then
    raise exception 'DATE_OUT_OF_RANGE';
  end if;

  select *
  into routine_row
  from public.user_routines
  where id = target_routine
    and user_id = uid
    and coalesce(status, 'active') = 'active'
  limit 1;

  if not found then
    raise exception 'ROUTINE_NOT_FOUND';
  end if;

  if jsonb_typeof(coalesce(routine_row.steps, '[]'::jsonb)) = 'array' then
    step_count := jsonb_array_length(coalesce(routine_row.steps, '[]'::jsonb));
  end if;

  select count(*)
  into done_steps
  from jsonb_each(coalesce(target_step_state, '{}'::jsonb)) e
  where e.value = 'true'::jsonb;

  routine_done := step_count > 0 and done_steps >= step_count;

  insert into public.user_routine_entries(
    user_id,
    routine_id,
    entry_date,
    step_state,
    completed,
    completed_at,
    updated_at
  )
  values(
    uid,
    target_routine,
    target_date,
    coalesce(target_step_state, '{}'::jsonb),
    routine_done,
    case when routine_done then now() else null end,
    now()
  )
  on conflict(user_id, routine_id, entry_date)
  do update set
    step_state = excluded.step_state,
    completed = excluded.completed,
    completed_at = case
      when excluded.completed then coalesce(public.user_routine_entries.completed_at, excluded.completed_at)
      else null
    end,
    updated_at = now();

  select count(*)
  into scheduled_count
  from public.user_routines r
  where r.user_id = uid
    and coalesce(r.status, 'active') = 'active'
    and (
      coalesce(r.frequency, 'daily') = 'daily'
      or (
        r.frequency = 'weekdays'
        and iso_day between 1 and 5
      )
      or (
        r.frequency = 'weekend'
        and iso_day in (6,7)
      )
      or (
        r.frequency = 'custom'
        and iso_day = any(coalesce(r.weekdays, '{}'::smallint[]))
      )
    );

  select count(*)
  into scheduled_done
  from public.user_routines r
  join public.user_routine_entries e
    on e.routine_id = r.id
   and e.user_id = uid
   and e.entry_date = target_date
   and e.completed = true
  where r.user_id = uid
    and coalesce(r.status, 'active') = 'active'
    and (
      coalesce(r.frequency, 'daily') = 'daily'
      or (
        r.frequency = 'weekdays'
        and iso_day between 1 and 5
      )
      or (
        r.frequency = 'weekend'
        and iso_day in (6,7)
      )
      or (
        r.frequency = 'custom'
        and iso_day = any(coalesce(r.weekdays, '{}'::smallint[]))
      )
    );

  select count(*)
  into any_done
  from public.user_routine_entries e
  join public.user_routines r on r.id = e.routine_id
  where e.user_id = uid
    and e.entry_date = target_date
    and e.completed = true
    and coalesce(r.status, 'active') = 'active';

  day_done := case
    when scheduled_count > 0 then scheduled_done >= scheduled_count
    else any_done > 0
  end;

  insert into public.daily_activity(
    user_id,
    activity_date,
    has_routine,
    today_checks,
    created_at,
    updated_at
  )
  values(
    uid,
    target_date,
    day_done,
    case
      when day_done then jsonb_build_object('routine', true)
      else '{}'::jsonb
    end,
    now(),
    now()
  )
  on conflict(user_id, activity_date)
  do update set
    has_routine = day_done,
    today_checks = case
      when day_done
        then coalesce(public.daily_activity.today_checks, '{}'::jsonb) || jsonb_build_object('routine', true)
      else coalesce(public.daily_activity.today_checks, '{}'::jsonb) - 'routine'
    end,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'routine_completed', routine_done,
    'scheduled_count', scheduled_count,
    'completed_count', scheduled_done,
    'day_done', day_done
  );
end;
$$;

grant execute
on function public.user_routine_save_day(uuid,date,jsonb)
to authenticated;


-- -------------------------------------------------------------------
-- RÉSUMÉ AUJOURD’HUI : remplace la lecture directe de daily_activity
-- sans ajouter de requête réseau.
-- -------------------------------------------------------------------

create or replace function public.today_activity_summary(
  target_date date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with d as (
    select
      today_checks,
      hydration_liters,
      sleep_hours,
      has_hydration,
      has_sleep,
      has_checklist,
      has_tracker,
      has_journal,
      has_photo,
      has_recipe,
      has_protocol,
      has_routine,
      has_ritual,
      protocol_title,
      protocol_day
    from public.daily_activity
    where user_id = auth.uid()
      and activity_date = target_date
    limit 1
  ),
  scheduled as (
    select
      r.id,
      r.title,
      r.daypart,
      r.steps,
      coalesce(e.completed,false) as completed
    from public.user_routines r
    left join public.user_routine_entries e
      on e.routine_id = r.id
     and e.user_id = auth.uid()
     and e.entry_date = target_date
    where r.user_id = auth.uid()
      and coalesce(r.status,'active') = 'active'
      and (
        coalesce(r.frequency,'daily') = 'daily'
        or (
          r.frequency = 'weekdays'
          and extract(isodow from target_date) between 1 and 5
        )
        or (
          r.frequency = 'weekend'
          and extract(isodow from target_date) in (6,7)
        )
        or (
          r.frequency = 'custom'
          and extract(isodow from target_date)::smallint = any(coalesce(r.weekdays,'{}'::smallint[]))
        )
      )
  ),
  rs as (
    select
      count(*) as scheduled_count,
      count(*) filter (where completed) as completed_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'title', title,
            'daypart', daypart,
            'steps_count',
              case
                when jsonb_typeof(coalesce(steps,'[]'::jsonb)) = 'array'
                then jsonb_array_length(coalesce(steps,'[]'::jsonb))
                else 0
              end,
            'completed', completed
          )
          order by
            case daypart
              when 'morning' then 1
              when 'day' then 2
              when 'evening' then 3
              else 4
            end,
            title
        ),
        '[]'::jsonb
      ) as routine_today
    from scheduled
  )
  select
    jsonb_build_object(
      'today_checks', coalesce((select today_checks from d), '{}'::jsonb),
      'hydration_liters', coalesce((select hydration_liters from d), 0),
      'sleep_hours', coalesce((select sleep_hours from d), 0),
      'has_hydration', coalesce((select has_hydration from d), false),
      'has_sleep', coalesce((select has_sleep from d), false),
      'has_checklist', coalesce((select has_checklist from d), false),
      'has_tracker', coalesce((select has_tracker from d), false),
      'has_journal', coalesce((select has_journal from d), false),
      'has_photo', coalesce((select has_photo from d), false),
      'has_recipe', coalesce((select has_recipe from d), false),
      'has_protocol', coalesce((select has_protocol from d), false),
      'has_routine', coalesce((select has_routine from d), false),
      'has_ritual', coalesce((select has_ritual from d), false),
      'protocol_title', (select protocol_title from d),
      'protocol_day', (select protocol_day from d),
      'routine_scheduled_count', coalesce((select scheduled_count from rs), 0),
      'routine_completed_count', coalesce((select completed_count from rs), 0),
      'routine_today', coalesce((select routine_today from rs), '[]'::jsonb)
    );
$$;

grant execute
on function public.today_activity_summary(date)
to authenticated;

notify pgrst,'reload schema';

commit;
