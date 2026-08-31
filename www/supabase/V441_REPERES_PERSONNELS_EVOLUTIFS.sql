-- MÉTHODE TEE · V441 · REPÈRES PERSONNELS ÉVOLUTIFS
-- Objectif : relier Carnet, suivis, ressentis, hydratation, boissons et protocoles
-- sans télécharger l'historique brut côté client.
--
-- EGRESS / PERFORMANCE
-- - 1 ligne compacte / utilisateur / jour dans user_reference_daily_facts
-- - 1 ligne agrégée / utilisateur / mois dans user_reference_monthly
-- - RPC 28 jours : max. 28 faits compacts
-- - RPC 3 mois : uniquement les agrégats mensuels
-- - aucun polling / aucune souscription Realtime
-- - les données Apple Santé restent locales ; seules les valeurs déjà explicitement
--   enregistrées dans un suivi Méthode Tee peuvent entrer dans ces agrégats.

begin;

-- ---------------------------------------------------------------------------
-- 1. Profil : quelques données stables pour ESTIMER un premier repère.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists height_cm numeric(5,1);
alter table public.profiles add column if not exists reference_gender text;
alter table public.profiles add column if not exists reference_settings jsonb not null default '{}'::jsonb;

alter table public.profiles drop constraint if exists profiles_height_cm_sane;
alter table public.profiles add constraint profiles_height_cm_sane
  check (height_cm is null or (height_cm between 100 and 230));
alter table public.profiles drop constraint if exists profiles_birth_date_sane;
alter table public.profiles add constraint profiles_birth_date_sane
  check (birth_date is null or (birth_date between date '1900-01-01' and current_date));
alter table public.profiles drop constraint if exists profiles_reference_gender_sane;
alter table public.profiles add constraint profiles_reference_gender_sane
  check (reference_gender is null or reference_gender in ('feminin','masculin','autre'));

-- ---------------------------------------------------------------------------
-- 2. Faits quotidiens compacts + agrégats mensuels.
-- ---------------------------------------------------------------------------
create table if not exists public.user_reference_daily_facts (
  user_id uuid not null references auth.users(id) on delete cascade,
  fact_date date not null,
  core jsonb not null default '{}'::jsonb,
  numeric_signals jsonb not null default '{}'::jsonb,
  tracker_keys text[] not null default '{}',
  source_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, fact_date)
);

create index if not exists user_reference_daily_facts_user_date_idx
  on public.user_reference_daily_facts(user_id, fact_date desc);

create table if not exists public.user_reference_monthly (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  metrics jsonb not null default '{}'::jsonb,
  tracker_days jsonb not null default '{}'::jsonb,
  days_documented integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_start)
);

create index if not exists user_reference_monthly_user_month_idx
  on public.user_reference_monthly(user_id, month_start desc);

create table if not exists public.user_reference_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_28d_sync_at timestamptz,
  last_90d_sync_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_reference_daily_facts enable row level security;
alter table public.user_reference_monthly enable row level security;
alter table public.user_reference_sync_state enable row level security;

-- Ces tables sont lisibles par leur propriétaire, mais les écritures passent par
-- les fonctions/trigger serveur afin d'éviter des états incohérents.
drop policy if exists "reference daily own read" on public.user_reference_daily_facts;
create policy "reference daily own read" on public.user_reference_daily_facts
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "reference monthly own read" on public.user_reference_monthly;
create policy "reference monthly own read" on public.user_reference_monthly
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "reference sync own read" on public.user_reference_sync_state;
create policy "reference sync own read" on public.user_reference_sync_state
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.user_reference_daily_facts, public.user_reference_monthly, public.user_reference_sync_state to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Helpers internes.
-- ---------------------------------------------------------------------------
create or replace function public.mt_reference_num(p_values jsonb, p_key text)
returns numeric
language plpgsql immutable
set search_path=public
as $$
declare raw text;
begin
  if p_values is null or p_key is null then return null; end if;
  raw := nullif(trim(p_values ->> p_key), '');
  if raw is null or raw !~ '^-?[0-9]+([.,][0-9]+)?$' then return null; end if;
  return replace(raw, ',', '.')::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.mt_reference_period_summary(p_user uuid, p_from date, p_to date)
returns jsonb
language sql stable security definer
set search_path=public
as $$
  with d as (
    select fact_date, core
    from public.user_reference_daily_facts
    where user_id=p_user and fact_date between p_from and p_to and source_count>0
  ), x as (
    select
      count(*)::int documented_days,
      count(*) filter (where public.mt_reference_num(core,'food_calculated_meals')>0)::int nutrition_days,
      round(avg(public.mt_reference_num(core,'food_kcal')) filter (where public.mt_reference_num(core,'food_calculated_meals')>0),1) avg_food_kcal,
      round(avg(public.mt_reference_num(core,'protein_g')) filter (where public.mt_reference_num(core,'food_calculated_meals')>0),1) avg_protein_g,
      round(avg(public.mt_reference_num(core,'fiber_g')) filter (where public.mt_reference_num(core,'food_calculated_meals')>0),1) avg_fiber_g,
      round(avg(public.mt_reference_num(core,'stress')),1) avg_stress,
      round(avg(public.mt_reference_num(core,'mood')),1) avg_mood,
      round(avg(public.mt_reference_num(core,'sleep_hours')),2) avg_sleep_hours,
      round(avg(public.mt_reference_num(core,'sleep_quality')),1) avg_sleep_quality,
      round(avg(public.mt_reference_num(core,'digestion')),1) avg_digestion,
      round(avg(public.mt_reference_num(core,'energy')),1) avg_energy,
      round(avg(public.mt_reference_num(core,'food_satiety')),1) avg_food_satiety,
      round(avg(public.mt_reference_num(core,'hydration_liters')),2) avg_hydration_liters,
      round(avg(public.mt_reference_num(core,'steps')),0) avg_steps,
      round(avg(public.mt_reference_num(core,'active_energy_kcal')),0) avg_active_energy_kcal,
      round(avg(public.mt_reference_num(core,'recovery')),1) avg_recovery,
      round(avg(public.mt_reference_num(core,'weight_kg')),2) avg_weight_kg,
      round(avg(public.mt_reference_num(core,'waist_cm')),2) avg_waist_cm,
      round(avg(public.mt_reference_num(core,'micronutrient_coverage_count')),1) avg_micronutrient_coverage_count
    from d
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'from',p_from,'to',p_to,'documented_days',x.documented_days,'nutrition_days',x.nutrition_days,
    'avg_food_kcal',x.avg_food_kcal,'avg_protein_g',x.avg_protein_g,'avg_fiber_g',x.avg_fiber_g,
    'avg_stress',x.avg_stress,'avg_mood',x.avg_mood,'avg_sleep_hours',x.avg_sleep_hours,'avg_sleep_quality',x.avg_sleep_quality,
    'avg_digestion',x.avg_digestion,'avg_energy',x.avg_energy,'avg_food_satiety',x.avg_food_satiety,
    'avg_hydration_liters',x.avg_hydration_liters,'avg_steps',x.avg_steps,
    'avg_active_energy_kcal',x.avg_active_energy_kcal,'avg_recovery',x.avg_recovery,'avg_weight_kg',x.avg_weight_kg,
    'avg_waist_cm',x.avg_waist_cm,'avg_micronutrient_coverage_count',x.avg_micronutrient_coverage_count
  )) from x;
$$;

create or replace function public.mt_refresh_reference_month(p_user uuid, p_date date)
returns void
language plpgsql security definer
set search_path=public
as $$
declare
  m date := date_trunc('month',p_date)::date;
  m_end date := (date_trunc('month',p_date) + interval '1 month - 1 day')::date;
  v_metrics jsonb := '{}'::jsonb;
  v_trackers jsonb := '{}'::jsonb;
  v_days integer := 0;
begin
  select count(*)::int into v_days
  from public.user_reference_daily_facts
  where user_id=p_user and fact_date between m and m_end and source_count>0;

  if v_days=0 then
    delete from public.user_reference_monthly where user_id=p_user and month_start=m;
    return;
  end if;

  with kv as (
    select j.key,
      case
        when jsonb_typeof(j.value)='number' then (j.value #>> '{}')::numeric
        when jsonb_typeof(j.value)='string' and (j.value #>> '{}') ~ '^-?[0-9]+([.][0-9]+)?$' then (j.value #>> '{}')::numeric
        else null
      end value
    from public.user_reference_daily_facts d
    cross join lateral jsonb_each(d.core || d.numeric_signals) j
    where d.user_id=p_user and d.fact_date between m and m_end and d.source_count>0
  ), g as (
    select key, round(avg(value),3) avg_v, round(min(value),3) min_v,
           round(max(value),3) max_v, count(value)::int count_v
    from kv where value is not null group by key
  )
  select coalesce(jsonb_object_agg(key,jsonb_build_object('avg',avg_v,'min',min_v,'max',max_v,'count',count_v)),'{}'::jsonb)
  into v_metrics from g;

  with t as (
    select k tracker_key, count(*)::int days
    from public.user_reference_daily_facts d
    cross join lateral unnest(d.tracker_keys) k
    where d.user_id=p_user and d.fact_date between m and m_end and d.source_count>0
    group by k
  )
  select coalesce(jsonb_object_agg(tracker_key,days),'{}'::jsonb) into v_trackers from t;

  insert into public.user_reference_monthly(user_id,month_start,metrics,tracker_days,days_documented,updated_at)
  values(p_user,m,v_metrics,v_trackers,v_days,now())
  on conflict(user_id,month_start) do update set
    metrics=excluded.metrics,tracker_days=excluded.tracker_days,
    days_documented=excluded.days_documented,updated_at=now();
end;
$$;

create or replace function public.mt_refresh_reference_day(p_user uuid, p_date date, p_refresh_month boolean default true)
returns void
language plpgsql security definer
set search_path=public
as $$
declare
  v_numeric jsonb := '{}'::jsonb;
  v_keys text[] := '{}';
  v_core jsonb := '{}'::jsonb;
  v_source_count integer := 0;
  v_tracker_count integer := 0;
  v_meal_count integer := 0;
  v_calc_meals integer := 0;
  v_bev_count integer := 0;
  v_daily integer := 0;
  v_journal integer := 0;
  v_kcal numeric; v_protein numeric; v_fiber numeric;
  v_food_energy numeric; v_food_digestion numeric; v_food_satiety numeric;
  v_hydration numeric; v_bev_hydration numeric; v_daily_hydration numeric; v_daily_sleep numeric; v_sleep_hours numeric;
  v_stress numeric; v_mood numeric; v_energy numeric; v_digestion numeric;
  v_sleep_quality numeric; v_steps numeric; v_active numeric; v_recovery numeric;
  v_weight numeric; v_waist numeric; v_micro numeric;
  v_reflux_episode numeric; v_reflux_after_meal numeric; v_reflux_onset time;
  v_j_stress numeric; v_j_mood numeric; v_j_energy numeric; v_j_digest numeric; v_j_sleep numeric;
begin
  -- Tous les champs numériques de TOUS les suivis (y compris futurs) sont aplatis.
  select
    coalesce(jsonb_object_agg(e.tracker_key||'.'||j.key,
      to_jsonb(case when jsonb_typeof(j.value)='number' then (j.value #>> '{}')::numeric else replace(j.value #>> '{}',',','.')::numeric end)
    ) filter (where (jsonb_typeof(j.value)='number') or (jsonb_typeof(j.value)='string' and (j.value #>> '{}') ~ '^-?[0-9]+([.,][0-9]+)?$')),'{}'::jsonb),
    coalesce(array_agg(distinct e.tracker_key) filter (where e.tracker_key is not null),'{}'::text[]),
    count(distinct e.tracker_key)::int,
    max(public.mt_reference_num(e.values,'recovery')) filter (where e.tracker_key='performance_recuperation'),
    max(public.mt_reference_num(e.values,'weight')) filter (where e.tracker_key='evolution_corporelle'),
    max(public.mt_reference_num(e.values,'waist')) filter (where e.tracker_key='evolution_corporelle'),
    max(public.mt_reference_num(e.values,'micronutrient_coverage_count')) filter (where e.tracker_key='nutrition_vegetale')
  into v_numeric,v_keys,v_tracker_count,v_recovery,v_weight,v_waist,v_micro
  from public.user_tracker_entries e
  left join lateral jsonb_each(e.values) j on true
  where e.user_id=p_user and e.entry_date=p_date;

  -- Priorités transversales entre les suivis qui parlent du même ressenti.
  select
    coalesce(max(public.mt_reference_num(values,'stress')) filter(where tracker_key='stress_regulation'),v_stress),
    coalesce(max(public.mt_reference_num(values,'mood')) filter(where tracker_key='stress_regulation'),max(public.mt_reference_num(values,'mood')) filter(where tracker_key in('cycle','perimenopause')),v_mood),
    coalesce(max(public.mt_reference_num(values,'energy')) filter(where tracker_key='stress_regulation'),max(public.mt_reference_num(values,'energy')) filter(where tracker_key in('cycle','perimenopause','jeune_intermit')),v_energy),
    coalesce(max(public.mt_reference_num(values,'comfort')) filter(where tracker_key='digestion'),max(public.mt_reference_num(values,'digestion')) filter(where tracker_key in('nutrition_vegetale','perimenopause','jeune_intermit')),v_digestion),
    coalesce(max(public.mt_reference_num(values,'quality')) filter(where tracker_key='sommeil_profond'),v_sleep_quality),
    coalesce(max(public.mt_reference_num(values,'_sleep_hours')) filter(where tracker_key='sommeil_profond'),v_sleep_hours),
    coalesce(max(public.mt_reference_num(values,'steps')) filter(where tracker_key='pas_marche'),max(public.mt_reference_num(values,'_healthkit_steps')) filter(where tracker_key='performance_recuperation'),v_steps),
    coalesce(max(public.mt_reference_num(values,'active_energy_kcal')) filter(where tracker_key='pas_marche'),max(public.mt_reference_num(values,'_healthkit_active_energy_kcal')) filter(where tracker_key='performance_recuperation'),v_active)
  into v_stress,v_mood,v_energy,v_digestion,v_sleep_quality,v_sleep_hours,v_steps,v_active
  from public.user_tracker_entries where user_id=p_user and entry_date=p_date;

  -- Repas : seulement les repas qui comportent réellement des items alimentent les macros.
  select
    count(*)::int,
    count(*) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id))::int,
    sum(m.kcal_total) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id)),
    sum(m.protein_total) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id)),
    sum(m.fiber_total) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id)),
    avg(m.energy_after), avg(m.digestion_after), avg(m.satiety_after)
  into v_meal_count,v_calc_meals,v_kcal,v_protein,v_fiber,v_food_energy,v_food_digestion,v_food_satiety
  from public.food_meals m where m.user_id=p_user and m.meal_date=p_date;

  -- Reflux : le lien temporel avec un repas est pré-calculé côté serveur.
  -- Ainsi « Mes tendances » n'a jamais besoin de retélécharger les horaires de repas.
  select
    case when values is not null
      and nullif(trim(values->>'episode'),'') is not null
      and coalesce(values->>'episode','') !~* '^Non' then 1 else null end,
    case when coalesce(values->>'onset','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]'
      then left(values->>'onset',5)::time else null end
  into v_reflux_episode,v_reflux_onset
  from public.user_tracker_entries
  where user_id=p_user and entry_date=p_date and tracker_key='reflux'
  limit 1;

  if v_reflux_episode=1 and v_reflux_onset is not null then
    select case when exists(
      select 1 from public.food_meals m
      where m.user_id=p_user and m.meal_date=p_date and m.meal_time is not null
        and extract(epoch from (v_reflux_onset - m.meal_time))/60 between 0 and 180
    ) then 1 else 0 end into v_reflux_after_meal;
  end if;

  select count(*)::int, coalesce(sum(hydration_ml),0)::numeric
  into v_bev_count,v_bev_hydration
  from public.user_beverage_entries where user_id=p_user and entry_date=p_date;

  select count(*)::int, max(hydration_liters), max(sleep_hours)
  into v_daily,v_daily_hydration,v_daily_sleep
  from public.daily_activity where user_id=p_user and activity_date=p_date;

  select count(*)::int, max(tracker_stress),max(tracker_humeur),max(tracker_energie),max(tracker_digestion),max(tracker_sommeil)
  into v_journal,v_j_stress,v_j_mood,v_j_energy,v_j_digest,v_j_sleep
  from public.journal_entries where user_id=p_user and entry_date=p_date;

  -- Les synthèses quotidiennes priment quand elles contiennent une vraie valeur.
  -- Sinon les boissons / le suivi sommeil restent disponibles, sans convertir une
  -- absence en zéro.
  v_hydration := coalesce(nullif(v_daily_hydration,0),case when v_bev_hydration>0 then v_bev_hydration/1000.0 else null end);
  v_sleep_hours := coalesce(v_sleep_hours,nullif(v_daily_sleep,0));

  v_stress := coalesce(v_stress,v_j_stress);
  v_mood := coalesce(v_mood,v_j_mood);
  v_energy := coalesce(v_energy,v_j_energy,v_food_energy);
  v_digestion := coalesce(v_digestion,v_j_digest,v_food_digestion);
  v_sleep_quality := coalesce(v_sleep_quality,v_j_sleep);

  v_source_count := coalesce(v_tracker_count,0)+coalesce(v_meal_count,0)+coalesce(v_bev_count,0)+coalesce(v_daily,0)+coalesce(v_journal,0);

  if v_meal_count>0 then v_keys:=array_append(v_keys,'food_day'); end if;
  if v_bev_count>0 then v_keys:=array_append(v_keys,'beverages'); end if;
  if v_daily>0 then v_keys:=array_append(v_keys,'daily_activity'); end if;
  if v_journal>0 then v_keys:=array_append(v_keys,'journal'); end if;
  select coalesce(array_agg(distinct k),'{}'::text[]) into v_keys from unnest(coalesce(v_keys,'{}'::text[])) k;

  if v_source_count=0 then
    delete from public.user_reference_daily_facts where user_id=p_user and fact_date=p_date;
    if p_refresh_month then perform public.mt_refresh_reference_month(p_user,p_date); end if;
    return;
  end if;

  v_core := jsonb_strip_nulls(jsonb_build_object(
    'food_kcal',v_kcal,'protein_g',v_protein,'fiber_g',v_fiber,
    'food_meal_count',v_meal_count,'food_calculated_meals',v_calc_meals,
    'food_energy',v_food_energy,'food_digestion',v_food_digestion,'food_satiety',v_food_satiety,
    'stress',v_stress,'mood',v_mood,'energy',v_energy,'digestion',v_digestion,
    'sleep_quality',v_sleep_quality,'sleep_hours',v_sleep_hours,
    'steps',v_steps,'active_energy_kcal',v_active,'recovery',v_recovery,
    'weight_kg',v_weight,'waist_cm',v_waist,'hydration_liters',v_hydration,
    'micronutrient_coverage_count',v_micro,
    'reflux_episode',v_reflux_episode,'reflux_after_meal_3h',v_reflux_after_meal
  ));

  insert into public.user_reference_daily_facts(user_id,fact_date,core,numeric_signals,tracker_keys,source_count,updated_at)
  values(p_user,p_date,v_core,coalesce(v_numeric,'{}'::jsonb),coalesce(v_keys,'{}'::text[]),v_source_count,now())
  on conflict(user_id,fact_date) do update set
    core=excluded.core,numeric_signals=excluded.numeric_signals,tracker_keys=excluded.tracker_keys,
    source_count=excluded.source_count,updated_at=now();

  if p_refresh_month then perform public.mt_refresh_reference_month(p_user,p_date); end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Triggers : chaque nouvelle donnée met à jour UN jour compact côté serveur.
-- ---------------------------------------------------------------------------
create or replace function public.mt_reference_trigger_tracker()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    perform public.mt_refresh_reference_day(old.user_id,old.entry_date,true);
  else
    perform public.mt_refresh_reference_day(new.user_id,new.entry_date,true);
    if tg_op='UPDATE' and (old.user_id is distinct from new.user_id or old.entry_date is distinct from new.entry_date) then
      perform public.mt_refresh_reference_day(old.user_id,old.entry_date,true);
    end if;
  end if;
  return null;
end; $$;

drop trigger if exists mt_reference_tracker on public.user_tracker_entries;
create trigger mt_reference_tracker after insert or update or delete on public.user_tracker_entries
for each row execute function public.mt_reference_trigger_tracker();

create or replace function public.mt_reference_trigger_food_meal()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    perform public.mt_refresh_reference_day(old.user_id,old.meal_date,true);
  else
    perform public.mt_refresh_reference_day(new.user_id,new.meal_date,true);
    if tg_op='UPDATE' and (old.user_id is distinct from new.user_id or old.meal_date is distinct from new.meal_date) then
      perform public.mt_refresh_reference_day(old.user_id,old.meal_date,true);
    end if;
  end if;
  return null;
end; $$;

drop trigger if exists mt_reference_food_meal on public.food_meals;
create trigger mt_reference_food_meal after insert or update or delete on public.food_meals
for each row execute function public.mt_reference_trigger_food_meal();

create or replace function public.mt_reference_trigger_food_item()
returns trigger language plpgsql security definer set search_path=public as $$
declare mid uuid; u uuid; d date;
begin
  if tg_op='DELETE' then mid:=old.meal_id; else mid:=new.meal_id; end if;
  select user_id,meal_date into u,d from public.food_meals where id=mid;
  if u is not null and d is not null then perform public.mt_refresh_reference_day(u,d,true); end if;
  return null;
end; $$;

drop trigger if exists mt_reference_food_item on public.food_meal_items;
create trigger mt_reference_food_item after insert or update or delete on public.food_meal_items
for each row execute function public.mt_reference_trigger_food_item();

create or replace function public.mt_reference_trigger_daily_activity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then perform public.mt_refresh_reference_day(old.user_id,old.activity_date,true);
  else
    perform public.mt_refresh_reference_day(new.user_id,new.activity_date,true);
    if tg_op='UPDATE' and (old.user_id is distinct from new.user_id or old.activity_date is distinct from new.activity_date) then perform public.mt_refresh_reference_day(old.user_id,old.activity_date,true); end if;
  end if;
  return null;
end; $$;
drop trigger if exists mt_reference_daily_activity on public.daily_activity;
create trigger mt_reference_daily_activity after insert or update or delete on public.daily_activity
for each row execute function public.mt_reference_trigger_daily_activity();

create or replace function public.mt_reference_trigger_journal()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then perform public.mt_refresh_reference_day(old.user_id,old.entry_date,true);
  else
    perform public.mt_refresh_reference_day(new.user_id,new.entry_date,true);
    if tg_op='UPDATE' and (old.user_id is distinct from new.user_id or old.entry_date is distinct from new.entry_date) then perform public.mt_refresh_reference_day(old.user_id,old.entry_date,true); end if;
  end if;
  return null;
end; $$;
drop trigger if exists mt_reference_journal on public.journal_entries;
create trigger mt_reference_journal after insert or update or delete on public.journal_entries
for each row execute function public.mt_reference_trigger_journal();

create or replace function public.mt_reference_trigger_beverage()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then perform public.mt_refresh_reference_day(old.user_id,old.entry_date,true);
  else
    perform public.mt_refresh_reference_day(new.user_id,new.entry_date,true);
    if tg_op='UPDATE' and (old.user_id is distinct from new.user_id or old.entry_date is distinct from new.entry_date) then perform public.mt_refresh_reference_day(old.user_id,old.entry_date,true); end if;
  end if;
  return null;
end; $$;
drop trigger if exists mt_reference_beverage on public.user_beverage_entries;
create trigger mt_reference_beverage after insert or update or delete on public.user_beverage_entries
for each row execute function public.mt_reference_trigger_beverage();

-- ---------------------------------------------------------------------------
-- 5. Bootstrap server-side des historiques existants. Aucun historique brut ne
--    quitte Supabase. La passe est au maximum quotidienne et seulement à la demande.
-- ---------------------------------------------------------------------------
create or replace function public.mt_reference_bootstrap(p_days integer default 28)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  n integer := case when coalesce(p_days,28)>28 then 90 else 28 end;
  from_d date := current_date - (case when coalesce(p_days,28)>28 then 89 else 27 end);
  last_sync timestamptz;
  r record;
  touched integer := 0;
  m record;
begin
  if uid is null then raise exception 'auth required'; end if;
  select case when n=90 then last_90d_sync_at else last_28d_sync_at end into last_sync
  from public.user_reference_sync_state where user_id=uid;
  if last_sync is not null and last_sync > now()-interval '20 hours' then
    return jsonb_build_object('days',n,'refreshed',0,'cached',true);
  end if;

  for r in
    with dates as (
      select entry_date d from public.user_tracker_entries where user_id=uid and entry_date>=from_d
      union select meal_date from public.food_meals where user_id=uid and meal_date>=from_d
      union select activity_date from public.daily_activity where user_id=uid and activity_date>=from_d
      union select entry_date from public.journal_entries where user_id=uid and entry_date>=from_d
      union select entry_date from public.user_beverage_entries where user_id=uid and entry_date>=from_d
    ) select distinct d from dates where d<=current_date order by d
  loop
    perform public.mt_refresh_reference_day(uid,r.d,false); touched:=touched+1;
  end loop;

  for m in select distinct date_trunc('month',fact_date)::date d
           from public.user_reference_daily_facts where user_id=uid and fact_date>=from_d
  loop perform public.mt_refresh_reference_month(uid,m.d); end loop;

  insert into public.user_reference_sync_state(user_id,last_28d_sync_at,last_90d_sync_at,updated_at)
  values(uid,case when n in (28,90) then now() else null end,case when n=90 then now() else null end,now())
  on conflict(user_id) do update set
    last_28d_sync_at=case when n in (28,90) then now() else public.user_reference_sync_state.last_28d_sync_at end,
    last_90d_sync_at=case when n=90 then now() else public.user_reference_sync_state.last_90d_sync_at end,
    updated_at=now();
  return jsonb_build_object('days',n,'refreshed',touched,'cached',false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC compacte : contexte actuel pour Résumé / Adapter mon repas.
-- ---------------------------------------------------------------------------
create or replace function public.mt_reference_context(target_date date default current_date)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  v_today jsonb := '{}'::jsonb;
  v_profile jsonb := '{}'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_trackers jsonb := '{}'::jsonb;
  v_preferences jsonb := '{}'::jsonb;
  w_first numeric; w_last numeric; w_first_date date; w_last_date date;
  w_old numeric; w_recent numeric; w_old_n int; w_recent_n int;
begin
  if uid is null then raise exception 'auth required'; end if;
  perform public.mt_reference_bootstrap(28);

  -- Le contexte du jour reste compact mais inclut aussi les champs numériques
  -- de tous les suivis (clé "tracker.champ") afin que les conseils puissent
  -- tenir compte d'un suivi nouvellement ajouté sans nouvelle requête brute.
  select coalesce(core,'{}'::jsonb) || coalesce(numeric_signals,'{}'::jsonb) into v_today
  from public.user_reference_daily_facts where user_id=uid and fact_date=target_date;

  select jsonb_strip_nulls(jsonb_build_object(
    'birth_date',birth_date,'height_cm',height_cm,'reference_gender',reference_gender,'settings',reference_settings
  )) into v_profile from public.profiles where id=uid;
  v_profile:=coalesce(v_profile,'{}'::jsonb);

  v_summary:=public.mt_reference_period_summary(uid,current_date-27,current_date);

  select fact_date,public.mt_reference_num(core,'weight_kg') into w_first_date,w_first
  from public.user_reference_daily_facts where user_id=uid and fact_date>=current_date-27
    and public.mt_reference_num(core,'weight_kg') is not null order by fact_date asc limit 1;
  select fact_date,public.mt_reference_num(core,'weight_kg') into w_last_date,w_last
  from public.user_reference_daily_facts where user_id=uid and fact_date>=current_date-27
    and public.mt_reference_num(core,'weight_kg') is not null order by fact_date desc limit 1;
  select round(avg(public.mt_reference_num(core,'weight_kg')),2),count(*)::int into w_old,w_old_n
  from public.user_reference_daily_facts where user_id=uid and fact_date between current_date-27 and current_date-14
    and public.mt_reference_num(core,'weight_kg') is not null;
  select round(avg(public.mt_reference_num(core,'weight_kg')),2),count(*)::int into w_recent,w_recent_n
  from public.user_reference_daily_facts where user_id=uid and fact_date between current_date-13 and current_date
    and public.mt_reference_num(core,'weight_kg') is not null;

  v_summary:=v_summary || jsonb_strip_nulls(jsonb_build_object(
    'weight_first',w_first,'weight_first_date',w_first_date,'weight_last',w_last,'weight_last_date',w_last_date,
    'weight_older_avg',w_old,'weight_older_count',w_old_n,'weight_recent_avg',w_recent,'weight_recent_count',w_recent_n
  ));

  with t as (
    select k,count(*)::int days from public.user_reference_daily_facts d
    cross join lateral unnest(d.tracker_keys) k
    where d.user_id=uid and d.fact_date>=current_date-27 and d.fact_date<=current_date and d.source_count>0
    group by k
  ) select coalesce(jsonb_object_agg(k,days),'{}'::jsonb) into v_trackers from t;

  -- Tous les suivis activés restent disponibles au moteur. Les préférences sont
  -- compactes (une ligne par suivi) et évitent de redemander le même contexte
  -- depuis plusieurs écrans.
  select coalesce(jsonb_object_agg(tracker_key,settings),'{}'::jsonb) into v_preferences
  from public.user_tracker_preferences
  where user_id=uid and enabled=true;

  return jsonb_build_object('date',target_date,'profile',v_profile,'today',coalesce(v_today,'{}'::jsonb),
    'summary28',coalesce(v_summary,'{}'::jsonb),'tracker_days',v_trackers,'preferences',v_preferences,
    'source_note','Repères construits à partir des données réellement renseignées. Une absence reste une absence, jamais un zéro.');
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC Mes tendances : 28 j fin / 3 mois agrégé.
-- ---------------------------------------------------------------------------
create or replace function public.mt_reference_overview(p_mode text default '28d')
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); mode text:=lower(coalesce(p_mode,'28d')); result jsonb;
begin
  if uid is null then raise exception 'auth required'; end if;
  if mode in ('3m','90d','3mois') then
    perform public.mt_reference_bootstrap(90);
    select jsonb_build_object('mode','3m','months',coalesce(jsonb_agg(jsonb_build_object(
      'month',month_start,'metrics',metrics,'tracker_days',tracker_days,'days_documented',days_documented
    ) order by month_start),'[]'::jsonb)) into result
    from public.user_reference_monthly
    where user_id=uid and month_start>=date_trunc('month',current_date-interval '2 months')::date;
  else
    perform public.mt_reference_bootstrap(28);
    select jsonb_build_object('mode','28d','days',coalesce(jsonb_agg(jsonb_build_object(
      'date',fact_date,'core',core,'numeric_signals',numeric_signals,'tracker_keys',tracker_keys,'source_count',source_count
    ) order by fact_date),'[]'::jsonb)) into result
    from public.user_reference_daily_facts
    where user_id=uid and fact_date between current_date-27 and current_date;
  end if;
  return coalesce(result,jsonb_build_object('mode',mode));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Avant / Pendant / Après d'un protocole : résumé serveur compact.
-- ---------------------------------------------------------------------------
create or replace function public.mt_protocol_reference_comparison(p_protocol_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid(); p record; start_d date; end_d date; today_d date:=current_date;
  before_j jsonb; during_j jsonb; after_j jsonb;
begin
  if uid is null then raise exception 'auth required'; end if;
  select started_at,total_days,current_day into p from public.protocol_progress
  where user_id=uid and protocol_id=p_protocol_id limit 1;
  if not found then return jsonb_build_object('available',false); end if;
  start_d:=coalesce(p.started_at::date,current_date);
  end_d:=start_d+greatest(1,least(60,coalesce(p.total_days,28)))-1;

  -- L'historique récent est compacté côté serveur ; aucun détail brut n'est renvoyé.
  perform public.mt_reference_bootstrap(90);
  before_j:=public.mt_reference_period_summary(uid,start_d-28,start_d-1);
  during_j:=public.mt_reference_period_summary(uid,start_d,least(end_d,today_d));
  if today_d>end_d then after_j:=public.mt_reference_period_summary(uid,end_d+1,least(end_d+28,today_d)); else after_j:=jsonb_build_object('documented_days',0); end if;

  return jsonb_build_object('available',true,'start_date',start_d,'end_date',end_d,
    'before',before_j,'during',during_j,'after',after_j,
    'note','Comparaison descriptive. Les périodes sans données suffisantes restent non interprétées.');
end;
$$;

-- Sécurité : seules les RPC publiques auto-scopées à auth.uid() sont appelables.
revoke all on function public.mt_reference_num(jsonb,text) from public,anon,authenticated;
revoke all on function public.mt_reference_period_summary(uuid,date,date) from public,anon,authenticated;
revoke all on function public.mt_refresh_reference_month(uuid,date) from public,anon,authenticated;
revoke all on function public.mt_refresh_reference_day(uuid,date,boolean) from public,anon,authenticated;
revoke all on function public.mt_reference_trigger_tracker() from public,anon,authenticated;
revoke all on function public.mt_reference_trigger_food_meal() from public,anon,authenticated;
revoke all on function public.mt_reference_trigger_food_item() from public,anon,authenticated;
revoke all on function public.mt_reference_trigger_daily_activity() from public,anon,authenticated;
revoke all on function public.mt_reference_trigger_journal() from public,anon,authenticated;
revoke all on function public.mt_reference_trigger_beverage() from public,anon,authenticated;
revoke all on function public.mt_reference_bootstrap(integer) from public,anon;
revoke all on function public.mt_reference_context(date) from public,anon;
revoke all on function public.mt_reference_overview(text) from public,anon;
revoke all on function public.mt_protocol_reference_comparison(uuid) from public,anon;

grant execute on function public.mt_reference_bootstrap(integer) to authenticated;
grant execute on function public.mt_reference_context(date) to authenticated;
grant execute on function public.mt_reference_overview(text) to authenticated;
grant execute on function public.mt_protocol_reference_comparison(uuid) to authenticated;

comment on table public.user_reference_daily_facts is 'V441 · Une ligne compacte par journée. Alimentée côté serveur par les sources Méthode Tee réellement renseignées.';
comment on table public.user_reference_monthly is 'V441 · Agrégation longue durée. Les vues 3 mois et futures vues longues ne téléchargent pas les lignes brutes.';

commit;
