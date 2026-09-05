-- MÉTHODE TEE · V473 · GLOW UP HOLISTIQUE + FRINGALES & ENVIES
-- Idempotent. À exécuter UNE FOIS après l'upload du patch.
-- Objectifs :
--   1) synchroniser le cycle adaptatif 7 jours entre appareils ;
--   2) ajouter une couche compacte de baselines personnelles / confiance / concordance ;
--   3) calculer quelques associations temporelles descriptives sans renvoyer de texte libre ;
--   4) permettre un check-in explicite du levier adaptatif ;
--   5) faire évoluer le feedback de fin de protocole vers 1 note + 2 questions courtes.

begin;

-- ---------------------------------------------------------------------------
-- 1. Cycle adaptatif compact, synchronisé au compte.
-- ---------------------------------------------------------------------------
create table if not exists public.user_adaptive_cycles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_adaptive_cycle_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  cycle_started_on date not null,
  lever_key text not null,
  applied boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, checkin_date, cycle_started_on)
);

create index if not exists idx_user_adaptive_cycle_checkins_user_cycle
  on public.user_adaptive_cycle_checkins(user_id, cycle_started_on, checkin_date desc);

alter table public.user_adaptive_cycles enable row level security;
alter table public.user_adaptive_cycle_checkins enable row level security;

drop policy if exists "adaptive cycle own" on public.user_adaptive_cycles;
create policy "adaptive cycle own" on public.user_adaptive_cycles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "adaptive cycle checkins own" on public.user_adaptive_cycle_checkins;
create policy "adaptive cycle checkins own" on public.user_adaptive_cycle_checkins
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_adaptive_cycles to authenticated;
grant select, insert, update, delete on public.user_adaptive_cycle_checkins to authenticated;

create or replace function public.mt_adaptive_cycle_save(p_state jsonb)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception 'invalid state'; end if;
  if octet_length(p_state::text) > 12000 then raise exception 'state too large'; end if;
  insert into public.user_adaptive_cycles(user_id,state,updated_at)
  values(uid,p_state,now())
  on conflict(user_id) do update set state=excluded.state,updated_at=now();
  return p_state;
end; $$;

revoke all on function public.mt_adaptive_cycle_save(jsonb) from public, anon;
grant execute on function public.mt_adaptive_cycle_save(jsonb) to authenticated;

create or replace function public.mt_adaptive_cycle_checkin(
  p_cycle_started_on date,
  p_lever_key text,
  p_applied boolean default true
)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); v_count int;
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_cycle_started_on is null or nullif(trim(p_lever_key),'') is null then raise exception 'invalid checkin'; end if;
  insert into public.user_adaptive_cycle_checkins(user_id,checkin_date,cycle_started_on,lever_key,applied,updated_at)
  values(uid,current_date,p_cycle_started_on,left(trim(p_lever_key),80),coalesce(p_applied,true),now())
  on conflict(user_id,checkin_date,cycle_started_on) do update set
    lever_key=excluded.lever_key, applied=excluded.applied, updated_at=now();
  select count(*)::int into v_count from public.user_adaptive_cycle_checkins
    where user_id=uid and cycle_started_on=p_cycle_started_on and applied=true;
  return jsonb_build_object('saved',true,'applied_days',v_count,'date',current_date);
end; $$;

revoke all on function public.mt_adaptive_cycle_checkin(date,text,boolean) from public, anon;
grant execute on function public.mt_adaptive_cycle_checkin(date,text,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Feedback protocole : 1 note + 2 questions courtes.
--    Les anciennes colonnes restent compatibles avec les builds précédents.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.protocol_feedback') is not null then
    alter table public.protocol_feedback alter column helpfulness_rating drop not null;
    alter table public.protocol_feedback alter column recommendation_rating drop not null;
    alter table public.protocol_feedback add column if not exists most_helpful text;
    alter table public.protocol_feedback add column if not exists less_useful_or_missing text;
    alter table public.protocol_feedback drop constraint if exists protocol_feedback_most_helpful_len;
    alter table public.protocol_feedback add constraint protocol_feedback_most_helpful_len check (most_helpful is null or char_length(most_helpful) <= 1000);
    alter table public.protocol_feedback drop constraint if exists protocol_feedback_less_useful_len;
    alter table public.protocol_feedback add constraint protocol_feedback_less_useful_len check (less_useful_or_missing is null or char_length(less_useful_or_missing) <= 1000);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Helpers de baseline personnelle. Les jours absents restent absents.
-- ---------------------------------------------------------------------------
create or replace function public.mt_holistic_signal_value(p_core jsonb,p_numeric jsonb,p_key text)
returns numeric
language sql immutable
set search_path=public
as $$
  select case
    when position('.' in coalesce(p_key,'')) > 0 then public.mt_reference_num(coalesce(p_numeric,'{}'::jsonb),p_key)
    else public.mt_reference_num(coalesce(p_core,'{}'::jsonb),p_key)
  end
$$;

create or replace function public.mt_holistic_signal_stats(
  p_user uuid,
  p_key text,
  p_from date,
  p_to date
)
returns jsonb
language sql security definer stable
set search_path=public
as $$
  with x as (
    select public.mt_holistic_signal_value(core,numeric_signals,p_key) v
    from public.user_reference_daily_facts
    where user_id=p_user and fact_date between p_from and p_to
  ), y as (select v from x where v is not null)
  select jsonb_strip_nulls(jsonb_build_object(
    'days',count(*)::int,
    'avg',round(avg(v),2),
    'median',round((percentile_cont(0.5) within group(order by v))::numeric,2),
    'min',round(min(v),2),
    'max',round(max(v),2),
    'sd',round(stddev_pop(v),2)
  )) from y
$$;

revoke all on function public.mt_holistic_signal_stats(uuid,text,date,date) from public, anon, authenticated;

create or replace function public.mt_holistic_pair_corr(
  p_user uuid,
  p_x_key text,
  p_y_key text,
  p_lag integer,
  p_from date,
  p_to date
)
returns jsonb
language sql security definer stable
set search_path=public
as $$
  with pairs as (
    select
      public.mt_holistic_signal_value(a.core,a.numeric_signals,p_x_key) x,
      public.mt_holistic_signal_value(b.core,b.numeric_signals,p_y_key) y
    from public.user_reference_daily_facts a
    join public.user_reference_daily_facts b
      on b.user_id=a.user_id and b.fact_date=a.fact_date+coalesce(p_lag,0)
    where a.user_id=p_user and a.fact_date between p_from and p_to
  ), clean as (select x,y from pairs where x is not null and y is not null)
  select jsonb_strip_nulls(jsonb_build_object(
    'pairs',count(*)::int,
    'r',case when count(*)>=5 then round(corr(x,y)::numeric,3) else null end
  )) from clean
$$;

revoke all on function public.mt_holistic_pair_corr(uuid,text,text,integer,date,date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Contexte holistique compact : contexte V441 + baseline 7/28 j + confiance
--    + concordance + associations temporelles. Aucun texte libre n'est renvoyé.
-- ---------------------------------------------------------------------------
create or replace function public.mt_holistic_context(target_date date default current_date)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  base jsonb;
  stats7 jsonb:='{}'::jsonb;
  stats28 jsonb:='{}'::jsonb;
  stats90 jsonb:='{}'::jsonb;
  k text;
  keys text[]:=array[
    'sleep_hours','sleep_quality','stress','mood','energy','digestion','food_satiety',
    'protein_g','fiber_g','steps','active_energy_kcal','recovery','weight_kg','waist_cm',
    'micronutrient_coverage_count',
    'fringales_envies.urge_presence','fringales_envies.urge_intensity','fringales_envies.physical_hunger',
    'fringales_envies.apaisement_after',
    'jeune_intermit._fast_hours','jeune_intermit.hunger','jeune_intermit.energy','jeune_intermit.digestion',
    'cycle.appetite','cycle.energy','cycle.stress','cycle.digestion'
  ];
  documented int:=0; nutrition_days int:=0; recent_days int:=0; multi_days int:=0; diversity int:=0; objective_days int:=0; subjective_days int:=0;
  latest_d date; score int:=0; conf_label text:='Repères en construction';
  s7_sleep numeric; s28_sleep numeric; sd_sleep numeric;
  s7_stress numeric; s28_stress numeric; sd_stress numeric;
  s7_recovery numeric; s28_recovery numeric; sd_recovery numeric;
  s7_energy numeric; s28_energy numeric; sd_energy numeric;
  load_count int:=0; load_signals text[]:='{}'; support_count int:=0; support_signals text[]:='{}'; concord_state text:='neutral';
  associations jsonb:='{}'::jsonb;
  cycle_state jsonb:='{}'::jsonb; applied_days int:=0; applied_today boolean:=false; cycle_start date;
  craving_high int:=0; craving_prev_sleep_low int:=0; craving_high_stress int:=0;
  craving_low_protein int:=0; craving_low_fiber int:=0; craving_gap_avg numeric; craving_gap_n int:=0;
  phase_name text; phase_count int:=0;
  p28_sleep numeric; p28_protein numeric; p28_fiber numeric;
  meal_timing jsonb:='{}'::jsonb; rhythm jsonb:='{}'::jsonb;
begin
  if uid is null then raise exception 'auth required'; end if;
  -- V473 garde la lecture détaillée récente tout en préparant une vraie baseline 90 j.
  -- Le bootstrap est borné et mis en cache côté serveur.
  perform public.mt_reference_bootstrap(90);
  base:=public.mt_reference_context(target_date);

  foreach k in array keys loop
    stats7:=stats7||jsonb_build_object(k,public.mt_holistic_signal_stats(uid,k,target_date-6,target_date));
    stats28:=stats28||jsonb_build_object(k,public.mt_holistic_signal_stats(uid,k,target_date-27,target_date));
    stats90:=stats90||jsonb_build_object(k,public.mt_holistic_signal_stats(uid,k,target_date-89,target_date));
  end loop;

  documented:=coalesce((base->'summary28'->>'documented_days')::int,0);
  nutrition_days:=coalesce((base->'summary28'->>'nutrition_days')::int,0);
  select count(*)::int,max(fact_date),count(*) filter(where source_count>=2)::int
    into recent_days,latest_d,multi_days
  from public.user_reference_daily_facts
  where user_id=uid and fact_date between target_date-6 and target_date;

  select count(distinct tk.tracker_key)::int into diversity
  from public.user_reference_daily_facts d
  cross join lateral unnest(d.tracker_keys) as tk(tracker_key)
  where d.user_id=uid and d.fact_date between target_date-27 and target_date;

  -- On distingue la présence de mesures plutôt objectives et de ressentis structurés.
  -- Cela affine la confiance sans prétendre connaître la provenance exacte de chaque capteur.
  select
    count(*) filter(where
      public.mt_reference_num(core,'sleep_hours') is not null or
      public.mt_reference_num(core,'steps') is not null or
      public.mt_reference_num(core,'active_energy_kcal') is not null or
      public.mt_reference_num(core,'weight_kg') is not null or
      public.mt_reference_num(core,'waist_cm') is not null or
      public.mt_reference_num(core,'protein_g') is not null or
      public.mt_reference_num(core,'fiber_g') is not null
    )::int,
    count(*) filter(where
      public.mt_reference_num(core,'stress') is not null or
      public.mt_reference_num(core,'mood') is not null or
      public.mt_reference_num(core,'energy') is not null or
      public.mt_reference_num(core,'digestion') is not null or
      public.mt_reference_num(core,'recovery') is not null or
      public.mt_reference_num(core,'sleep_quality') is not null
    )::int
  into objective_days,subjective_days
  from public.user_reference_daily_facts
  where user_id=uid and fact_date between target_date-27 and target_date;

  score:=least(40,round(documented*40.0/21.0)::int)
       +case when latest_d is null then 0 when latest_d>=target_date-1 then 20 when latest_d>=target_date-3 then 15 when latest_d>=target_date-7 then 10 else 5 end
       +least(20,diversity*4)
       +least(20,round(multi_days*20.0/14.0)::int);
  score:=greatest(0,least(100,score));
  conf_label:=case when score<30 then 'Repères en construction'
                   when score<50 then 'Lecture en cours de précision'
                   when score<75 then 'Lecture évolutive disponible'
                   else 'Données suffisamment solides' end;

  s7_sleep:=nullif(stats7->'sleep_hours'->>'avg','')::numeric;
  s28_sleep:=nullif(stats28->'sleep_hours'->>'median','')::numeric;
  sd_sleep:=coalesce(nullif(stats28->'sleep_hours'->>'sd','')::numeric,0);
  s7_stress:=nullif(stats7->'stress'->>'avg','')::numeric;
  s28_stress:=nullif(stats28->'stress'->>'median','')::numeric;
  sd_stress:=coalesce(nullif(stats28->'stress'->>'sd','')::numeric,0);
  s7_recovery:=nullif(stats7->'recovery'->>'avg','')::numeric;
  s28_recovery:=nullif(stats28->'recovery'->>'median','')::numeric;
  sd_recovery:=coalesce(nullif(stats28->'recovery'->>'sd','')::numeric,0);
  s7_energy:=nullif(stats7->'energy'->>'avg','')::numeric;
  s28_energy:=nullif(stats28->'energy'->>'median','')::numeric;
  sd_energy:=coalesce(nullif(stats28->'energy'->>'sd','')::numeric,0);

  if s7_sleep is not null and s28_sleep is not null and s7_sleep < s28_sleep-greatest(.4,sd_sleep*.35) then load_count:=load_count+1;load_signals:=array_append(load_signals,'sleep');end if;
  if s7_stress is not null and s28_stress is not null and s7_stress > s28_stress+greatest(.8,sd_stress*.35) then load_count:=load_count+1;load_signals:=array_append(load_signals,'stress');end if;
  if s7_recovery is not null and s28_recovery is not null and s7_recovery < s28_recovery-greatest(.7,sd_recovery*.35) then load_count:=load_count+1;load_signals:=array_append(load_signals,'recovery');end if;
  if s7_energy is not null and s28_energy is not null and s7_energy < s28_energy-greatest(.7,sd_energy*.35) then load_count:=load_count+1;load_signals:=array_append(load_signals,'energy');end if;

  if s7_sleep is not null and s28_sleep is not null and s7_sleep > s28_sleep+greatest(.4,sd_sleep*.35) then support_count:=support_count+1;support_signals:=array_append(support_signals,'sleep');end if;
  if s7_stress is not null and s28_stress is not null and s7_stress < s28_stress-greatest(.8,sd_stress*.35) then support_count:=support_count+1;support_signals:=array_append(support_signals,'stress');end if;
  if s7_recovery is not null and s28_recovery is not null and s7_recovery > s28_recovery+greatest(.7,sd_recovery*.35) then support_count:=support_count+1;support_signals:=array_append(support_signals,'recovery');end if;
  if s7_energy is not null and s28_energy is not null and s7_energy > s28_energy+greatest(.7,sd_energy*.35) then support_count:=support_count+1;support_signals:=array_append(support_signals,'energy');end if;
  concord_state:=case
    when load_count>0 and support_count>0 then 'mixed'
    when load_count>=2 then 'load_convergent'
    when support_count>=2 then 'support_convergent'
    when load_count=1 then 'load_single'
    when support_count=1 then 'support_single'
    else 'neutral' end;

  associations:=jsonb_build_object(
    'sleep_previous_to_energy',public.mt_holistic_pair_corr(uid,'sleep_hours','energy',1,target_date-27,target_date-1),
    'sleep_previous_to_cravings',public.mt_holistic_pair_corr(uid,'sleep_hours','fringales_envies.urge_intensity',1,target_date-27,target_date-1),
    'stress_to_digestion',public.mt_holistic_pair_corr(uid,'stress','digestion',0,target_date-27,target_date),
    'activity_to_recovery',public.mt_holistic_pair_corr(uid,'active_energy_kcal','recovery',0,target_date-27,target_date),
    'activity_to_next_recovery',public.mt_holistic_pair_corr(uid,'active_energy_kcal','recovery',1,target_date-27,target_date-1),
    'activity_to_next_sleep',public.mt_holistic_pair_corr(uid,'active_energy_kcal','sleep_hours',1,target_date-27,target_date-1),
    'protein_to_satiety',public.mt_holistic_pair_corr(uid,'protein_g','food_satiety',0,target_date-27,target_date),
    'fiber_to_digestion',public.mt_holistic_pair_corr(uid,'fiber_g','digestion',0,target_date-27,target_date),
    'fast_duration_to_hunger',public.mt_holistic_pair_corr(uid,'jeune_intermit._fast_hours','jeune_intermit.hunger',0,target_date-27,target_date),
    'fast_duration_to_energy',public.mt_holistic_pair_corr(uid,'jeune_intermit._fast_hours','jeune_intermit.energy',0,target_date-27,target_date),
    'fast_duration_to_digestion',public.mt_holistic_pair_corr(uid,'jeune_intermit._fast_hours','jeune_intermit.digestion',0,target_date-27,target_date),
    'cycle_appetite_to_cravings',public.mt_holistic_pair_corr(uid,'cycle.appetite','fringales_envies.urge_intensity',0,target_date-27,target_date)
  );

  p28_sleep:=nullif(stats28->'sleep_hours'->>'median','')::numeric;
  p28_protein:=nullif(stats28->'protein_g'->>'median','')::numeric;
  p28_fiber:=nullif(stats28->'fiber_g'->>'median','')::numeric;

  -- Rythme alimentaire personnel sur 28 jours : on agrège les horaires réellement renseignés.
  with per_day as (
    select meal_date,
           min(meal_time) filter(where meal_time is not null) first_t,
           max(meal_time) filter(where meal_time is not null) last_t,
           count(*) filter(where meal_time is not null)::int timed_meals
    from public.food_meals
    where user_id=uid and meal_date between target_date-27 and target_date
    group by meal_date
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'days',count(*) filter(where first_t is not null)::int,
    'avg_first_meal_minutes',round(avg(extract(hour from first_t)*60+extract(minute from first_t)) filter(where first_t is not null),0),
    'avg_last_meal_minutes',round(avg(extract(hour from last_t)*60+extract(minute from last_t)) filter(where last_t is not null),0),
    'avg_timed_meals',round(avg(timed_meals),1)
  )) into meal_timing from per_day;

  select jsonb_build_object(
    'days',count(*)::int,
    'routine_days',count(*) filter(where coalesce(has_routine,false))::int,
    'ritual_days',count(*) filter(where coalesce(has_ritual,false))::int,
    'journal_days',count(*) filter(where coalesce(has_journal,false))::int,
    'protocol_days',count(*) filter(where coalesce(has_protocol,false))::int,
    'tracker_days',count(*) filter(where coalesce(has_tracker,false))::int
  ) into rhythm
  from public.daily_activity
  where user_id=uid and activity_date between target_date-27 and target_date;

  select count(*)::int,
         count(*) filter(where prev_sleep is not null and p28_sleep is not null and prev_sleep < p28_sleep-.5)::int,
         count(*) filter(where stress is not null and stress>=7)::int,
         count(*) filter(where protein is not null and p28_protein is not null and protein < p28_protein*.85)::int,
         count(*) filter(where fiber is not null and p28_fiber is not null and fiber < p28_fiber*.85)::int,
         round(avg(gap_minutes) filter(where gap_minutes is not null),0),
         count(gap_minutes)::int
    into craving_high,craving_prev_sleep_low,craving_high_stress,craving_low_protein,craving_low_fiber,craving_gap_avg,craving_gap_n
  from (
    select f.fact_date,
      public.mt_reference_num(f.numeric_signals,'fringales_envies.urge_intensity') craving,
      public.mt_reference_num(p.core,'sleep_hours') prev_sleep,
      public.mt_reference_num(f.core,'stress') stress,
      public.mt_reference_num(f.core,'protein_g') protein,
      public.mt_reference_num(f.core,'fiber_g') fiber,
      gap.gap_minutes
    from public.user_reference_daily_facts f
    left join public.user_reference_daily_facts p on p.user_id=f.user_id and p.fact_date=f.fact_date-1
    left join lateral (
      select extract(epoch from ((left(e.values->>'urge_time',5))::time - max(m.meal_time)))/60 gap_minutes
      from public.user_tracker_entries e
      join public.food_meals m on m.user_id=e.user_id and m.meal_date=e.entry_date
      where e.user_id=f.user_id and e.entry_date=f.fact_date and e.tracker_key='fringales_envies'
        and coalesce(e.values->>'urge_time','') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]'
        and m.meal_time is not null and m.meal_time <= (left(e.values->>'urge_time',5))::time
    ) gap on true
    where f.user_id=uid and f.fact_date between target_date-27 and target_date
      and public.mt_reference_num(f.numeric_signals,'fringales_envies.urge_intensity')>=4
  ) q;

  select c.values->>'cycle_phase_estimate',count(*)::int
    into phase_name,phase_count
  from public.user_tracker_entries f
  join public.user_tracker_entries c on c.user_id=f.user_id and c.entry_date=f.entry_date and c.tracker_key='cycle'
  where f.user_id=uid and f.tracker_key='fringales_envies' and f.entry_date between target_date-27 and target_date
    and public.mt_reference_num(f.values,'urge_intensity')>=4
    and nullif(c.values->>'cycle_phase_estimate','') is not null
  group by c.values->>'cycle_phase_estimate' order by count(*) desc limit 1;

  select coalesce(state,'{}'::jsonb) into cycle_state from public.user_adaptive_cycles where user_id=uid;
  cycle_start:=case when coalesce(cycle_state->>'startedOn','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then (cycle_state->>'startedOn')::date else null end;
  if cycle_start is not null then
    select count(*)::int,
           coalesce(bool_or(checkin_date=target_date and applied),false)
      into applied_days,applied_today
    from public.user_adaptive_cycle_checkins
    where user_id=uid and cycle_started_on=cycle_start and applied=true;
  end if;

  return base || jsonb_build_object('holistic',jsonb_build_object(
    'version',473,
    'baseline7',stats7,
    'baseline28',stats28,
    'baseline90',stats90,
    'meal_timing28',meal_timing,
    'rhythm28',rhythm,
    'confidence',jsonb_build_object('score',score,'label',conf_label,'documented_days',documented,'recent_days',recent_days,'nutrition_days',nutrition_days,'multi_source_days',multi_days,'source_diversity',diversity,'objective_days',objective_days,'subjective_days',subjective_days),
    'concordance',jsonb_build_object('recovery_load_count',load_count,'recovery_load_signals',load_signals,'recovery_support_count',support_count,'recovery_support_signals',support_signals,'state',concord_state),
    'associations',associations,
    'cravings',jsonb_strip_nulls(jsonb_build_object(
      'high_days',craving_high,
      'high_after_shorter_sleep',craving_prev_sleep_low,
      'high_with_high_stress',craving_high_stress,
      'high_with_lower_protein',craving_low_protein,
      'high_with_lower_fiber',craving_low_fiber,
      'avg_minutes_since_previous_meal',craving_gap_avg,
      'meal_gap_days',craving_gap_n,
      'dominant_cycle_phase',phase_name,
      'dominant_cycle_phase_days',phase_count
    )),
    'adaptive_cycle_state',cycle_state,
    'adaptive_cycle_applied_days',applied_days,
    'adaptive_cycle_applied_today',applied_today,
    'note','Lecture descriptive et personnalisée. Une association répétée ne prouve pas une cause.'
  ));
end; $$;

revoke all on function public.mt_holistic_context(date) from public, anon;
grant execute on function public.mt_holistic_context(date) to authenticated;

commit;

-- ===========================================================================
-- MÉTHODE TEE · V474 · APPRENTISSAGE STATISTIQUE INDIVIDUEL
-- Extension cumulative à V473.
--
-- PRINCIPES DE SÉCURITÉ MÉTHODOLOGIQUE
-- - apprentissage réellement individuel : coefficients recalculés sur l'historique
--   propre à chaque compte ;
-- - régression ridge multivariée standardisée pour limiter le sur-ajustement ;
-- - graphe causal pré-spécifié : seules des relations physiologiquement/contextuellement
--   cohérentes et avec temporalité explicite peuvent influencer la hiérarchie ;
-- - estimation d'effet d'un levier par appariement multivarié sur des journées
--   pré-intervention comparables ;
-- - aucune sortie ne transforme une association observationnelle en preuve de causalité ;
-- - aucune recommandation énergétique n'est appliquée automatiquement.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Cache compact des modèles individuels. Une ligne par modèle / utilisateur.
-- ---------------------------------------------------------------------------
create table if not exists public.user_holistic_learning_models (
  user_id uuid not null references auth.users(id) on delete cascade,
  model_key text not null,
  trained_through date not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, model_key)
);

create index if not exists idx_user_holistic_learning_models_updated
  on public.user_holistic_learning_models(user_id, updated_at desc);

alter table public.user_holistic_learning_models enable row level security;
drop policy if exists "holistic learning own read" on public.user_holistic_learning_models;
create policy "holistic learning own read" on public.user_holistic_learning_models
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.user_holistic_learning_models to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Lecture d'un signal à une date précise. Fonction interne uniquement.
-- ---------------------------------------------------------------------------
create or replace function public.mt_holistic_signal_at(
  p_user uuid,
  p_date date,
  p_key text
)
returns numeric
language sql security definer stable
set search_path=public
as $$
  select public.mt_holistic_signal_value(d.core,d.numeric_signals,p_key)
  from public.user_reference_daily_facts d
  where d.user_id=p_user and d.fact_date=p_date
  limit 1
$$;

revoke all on function public.mt_holistic_signal_at(uuid,date,text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Régression ridge multivariée individuelle.
--
-- Les coefficients sont standardisés : ils deviennent comparables entre variables.
-- Les valeurs X manquantes sont imputées à la moyenne personnelle (z=0), mais la
-- couverture de chaque variable pénalise ensuite la fiabilité du modèle.
-- ---------------------------------------------------------------------------
create or replace function public.mt_holistic_ridge_fit(
  p_user uuid,
  p_outcome_key text,
  p_predictor_keys text[],
  p_predictor_lags integer[],
  p_from date,
  p_to date,
  p_lambda numeric default 1.5
)
returns jsonb
language plpgsql security definer stable
set search_path=public
as $$
declare
  p int:=coalesce(array_length(p_predictor_keys,1),0);
  j int; k int; i int; r int; c int; pivot int;
  n_y int:=0; active_count int:=0; min_predictor_n int:=0;
  y_mean double precision; y_sd double precision; yv double precision; zy double precision;
  xv double precision; zx double precision; pred double precision;
  stat_count integer; stat_mean double precision; stat_sd double precision;
  row_w double precision; observed int;
  means double precision[]; sds double precision[]; counts integer[];
  xvec double precision[]; xty double precision[]; beta double precision[]; rhs double precision[];
  xtx double precision[][]; mat double precision[][];
  tmp double precision; factor double precision; denom double precision; pivot_abs double precision;
  lambda_eff double precision; sse double precision:=0; sst double precision:=0;
  r2 double precision:=null; rmse_z double precision:=null; sum_abs double precision:=0;
  coverage_avg double precision:=0; rel_score int:=0; rel_label text:='Repères en construction';
  coeffs jsonb:='[]'::jsonb; coef double precision; effect_unit double precision; weight_pct double precision;
  rec record;
begin
  if p_user is null or p_outcome_key is null or p=0 or p>8 then
    return jsonb_build_object('status','insufficient','reason','invalid_spec');
  end if;
  if coalesce(array_length(p_predictor_lags,1),0)<>p then
    return jsonb_build_object('status','insufficient','reason','lag_mismatch');
  end if;
  if exists(select 1 from unnest(p_predictor_lags) z(v) where coalesce(v,0) not in (0,1)) then
    return jsonb_build_object('status','insufficient','reason','unsupported_lag');
  end if;

  select count(v)::int, avg(v)::double precision, stddev_pop(v)::double precision
    into n_y,y_mean,y_sd
  from (
    select public.mt_holistic_signal_value(core,numeric_signals,p_outcome_key)::double precision v
    from public.user_reference_daily_facts
    where user_id=p_user and fact_date between p_from and p_to
  ) q where v is not null;

  if n_y<12 or y_sd is null or abs(y_sd)<1e-8 then
    return jsonb_build_object('status','insufficient','outcome',p_outcome_key,'samples',n_y,'reason','not_enough_outcome_variation');
  end if;

  means:=array_fill(0.0::double precision,array[p]);
  sds:=array_fill(0.0::double precision,array[p]);
  counts:=array_fill(0,array[p]);
  min_predictor_n:=greatest(8,ceil(n_y*.35)::int);

  for j in 1..p loop
    select count(x)::int,coalesce(avg(x),0)::double precision,coalesce(stddev_pop(x),0)::double precision
      into stat_count,stat_mean,stat_sd
    from (
      select public.mt_holistic_signal_value(
        case when coalesce(p_predictor_lags[j],0)=1 then prev.core else d.core end,
        case when coalesce(p_predictor_lags[j],0)=1 then prev.numeric_signals else d.numeric_signals end,
        p_predictor_keys[j]
      )::double precision x
      from public.user_reference_daily_facts d
      left join public.user_reference_daily_facts prev
        on prev.user_id=d.user_id and prev.fact_date=d.fact_date-1
      where d.user_id=p_user
        and d.fact_date between p_from and p_to
        and public.mt_holistic_signal_value(d.core,d.numeric_signals,p_outcome_key) is not null
    ) z where x is not null;

    counts[j]:=coalesce(stat_count,0);
    means[j]:=coalesce(stat_mean,0);
    sds[j]:=coalesce(stat_sd,0);

    if counts[j]>=min_predictor_n and abs(sds[j])>=1e-8 then
      active_count:=active_count+1;
    else
      sds[j]:=0;
    end if;
  end loop;

  if active_count=0 then
    return jsonb_build_object('status','insufficient','outcome',p_outcome_key,'samples',n_y,'reason','not_enough_predictor_coverage');
  end if;

  xtx:=array_fill(0.0::double precision,array[p,p]);
  xty:=array_fill(0.0::double precision,array[p]);

  for rec in
    select d.fact_date,d.core,d.numeric_signals,prev.core prev_core,prev.numeric_signals prev_numeric
    from public.user_reference_daily_facts d
    left join public.user_reference_daily_facts prev on prev.user_id=d.user_id and prev.fact_date=d.fact_date-1
    where d.user_id=p_user and d.fact_date between p_from and p_to
    order by d.fact_date
  loop
    yv:=public.mt_holistic_signal_value(rec.core,rec.numeric_signals,p_outcome_key)::double precision;
    if yv is null then continue; end if;
    zy:=greatest(-3.5,least(3.5,(yv-y_mean)/y_sd));
    xvec:=array_fill(0.0::double precision,array[p]);
    observed:=0;

    for j in 1..p loop
      if sds[j]>0 then
        xv:=public.mt_holistic_signal_value(
          case when coalesce(p_predictor_lags[j],0)=1 then rec.prev_core else rec.core end,
          case when coalesce(p_predictor_lags[j],0)=1 then rec.prev_numeric else rec.numeric_signals end,
          p_predictor_keys[j]
        )::double precision;
        if xv is not null then
          zx:=greatest(-3.5,least(3.5,(xv-means[j])/sds[j]));
          xvec[j]:=zx;
          observed:=observed+1;
        else
          xvec[j]:=0; -- moyenne personnelle
        end if;
      end if;
    end loop;

    row_w:=0.40+0.60*(observed::double precision/greatest(active_count,1));
    for j in 1..p loop
      xty[j]:=xty[j]+row_w*xvec[j]*zy;
      for k in 1..p loop
        xtx[j][k]:=xtx[j][k]+row_w*xvec[j]*xvec[k];
      end loop;
    end loop;
  end loop;

  lambda_eff:=greatest(.25,coalesce(p_lambda,1.5)::double precision)*(1.0+active_count::double precision/greatest(n_y,1));
  for j in 1..p loop
    if sds[j]>0 then xtx[j][j]:=xtx[j][j]+lambda_eff;
    else xtx[j][j]:=1; xty[j]:=0; end if;
  end loop;

  -- Gauss-Jordan avec pivot partiel : résolution de (X'X + λI)β = X'y.
  mat:=xtx; rhs:=xty;
  for i in 1..p loop
    pivot:=i; pivot_abs:=abs(mat[i][i]);
    if i<p then
      for r in (i+1)..p loop
        if abs(mat[r][i])>pivot_abs then pivot:=r; pivot_abs:=abs(mat[r][i]); end if;
      end loop;
    end if;
    if pivot_abs<1e-10 then continue; end if;
    if pivot<>i then
      for c in 1..p loop tmp:=mat[i][c];mat[i][c]:=mat[pivot][c];mat[pivot][c]:=tmp;end loop;
      tmp:=rhs[i];rhs[i]:=rhs[pivot];rhs[pivot]:=tmp;
    end if;
    denom:=mat[i][i];
    for c in 1..p loop mat[i][c]:=mat[i][c]/denom; end loop;
    rhs[i]:=rhs[i]/denom;
    for r in 1..p loop
      if r=i then continue; end if;
      factor:=mat[r][i];
      if abs(factor)<1e-12 then continue; end if;
      for c in 1..p loop mat[r][c]:=mat[r][c]-factor*mat[i][c]; end loop;
      rhs[r]:=rhs[r]-factor*rhs[i];
    end loop;
  end loop;
  beta:=rhs;

  -- Qualité d'ajustement sur les journées réellement observées.
  for rec in
    select d.fact_date,d.core,d.numeric_signals,prev.core prev_core,prev.numeric_signals prev_numeric
    from public.user_reference_daily_facts d
    left join public.user_reference_daily_facts prev on prev.user_id=d.user_id and prev.fact_date=d.fact_date-1
    where d.user_id=p_user and d.fact_date between p_from and p_to
    order by d.fact_date
  loop
    yv:=public.mt_holistic_signal_value(rec.core,rec.numeric_signals,p_outcome_key)::double precision;
    if yv is null then continue; end if;
    zy:=greatest(-3.5,least(3.5,(yv-y_mean)/y_sd));
    pred:=0;observed:=0;
    for j in 1..p loop
      if sds[j]>0 then
        xv:=public.mt_holistic_signal_value(
          case when coalesce(p_predictor_lags[j],0)=1 then rec.prev_core else rec.core end,
          case when coalesce(p_predictor_lags[j],0)=1 then rec.prev_numeric else rec.numeric_signals end,
          p_predictor_keys[j]
        )::double precision;
        if xv is not null then zx:=greatest(-3.5,least(3.5,(xv-means[j])/sds[j]));observed:=observed+1;else zx:=0;end if;
        pred:=pred+coalesce(beta[j],0)*zx;
      end if;
    end loop;
    row_w:=0.40+0.60*(observed::double precision/greatest(active_count,1));
    sse:=sse+row_w*power(zy-pred,2);
    sst:=sst+row_w*power(zy,2);
  end loop;

  if sst>1e-9 then r2:=greatest(-1.0,least(1.0,1.0-sse/sst)); end if;
  rmse_z:=sqrt(sse/greatest(n_y,1));

  for j in 1..p loop
    if sds[j]>0 then sum_abs:=sum_abs+abs(coalesce(beta[j],0)); end if;
  end loop;

  if active_count>0 then
    for j in 1..p loop
      if sds[j]>0 then coverage_avg:=coverage_avg+(counts[j]::double precision/n_y); end if;
    end loop;
    coverage_avg:=coverage_avg/active_count;
  end if;

  rel_score:=round(
      least(1.0,n_y::double precision/45.0)*45
      +least(1.0,active_count::double precision/4.0)*15
      +greatest(0.0,least(1.0,coalesce(r2,0.0)))*25
      +greatest(0.0,least(1.0,coverage_avg))*15
    )::int;
  rel_score:=greatest(0,least(100,rel_score));
  rel_label:=case when rel_score<35 then 'construction'
                  when rel_score<55 then 'exploratoire'
                  when rel_score<75 then 'utilisable'
                  else 'solide' end;

  for j in 1..p loop
    coef:=coalesce(beta[j],0);
    effect_unit:=case when sds[j]>0 then coef*y_sd/sds[j] else null end;
    weight_pct:=case when sum_abs>1e-10 and sds[j]>0 then abs(coef)*100.0/sum_abs else 0 end;
    coeffs:=coeffs||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'key',p_predictor_keys[j],
      'lag_days',coalesce(p_predictor_lags[j],0),
      'active',sds[j]>0,
      'coverage_days',counts[j],
      'coverage',round((counts[j]::numeric/greatest(n_y,1))*100,1),
      'beta_std',round(coef::numeric,4),
      'effect_per_unit',case when effect_unit is null then null else round(effect_unit::numeric,4) end,
      'weight_pct',round(weight_pct::numeric,1),
      'direction',case when coef>.03 then 'positive' when coef<-.03 then 'negative' else 'weak' end
    )));
  end loop;

  return jsonb_build_object(
    'status',case when rel_score>=55 then 'usable' when rel_score>=35 then 'exploratory' else 'building' end,
    'outcome',p_outcome_key,
    'from',p_from,'to',p_to,
    'samples',n_y,
    'predictors_active',active_count,
    'lambda',round(lambda_eff::numeric,3),
    'r2',case when r2 is null then null else round(r2::numeric,3) end,
    'rmse_z',round(rmse_z::numeric,3),
    'reliability',jsonb_build_object('score',rel_score,'label',rel_label,'coverage',round((coverage_avg*100)::numeric,1)),
    'coefficients',coeffs,
    'method','individual_standardized_ridge',
    'guardrail','weights_are_personal_predictive_signals_not_proof_of_causality'
  );
end; $$;

revoke all on function public.mt_holistic_ridge_fit(uuid,text,text[],integer[],date,date,numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Spécification causale pré-définie + recalibrage automatique quotidien.
--
-- Le graphe évite de laisser l'algorithme relier n'importe quoi à n'importe quoi.
-- Les lags=1 imposent qu'un signal de la veille précède l'issue du lendemain.
-- ---------------------------------------------------------------------------
create or replace function public.mt_holistic_learning_refresh(target_date date default current_date)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  specs jsonb:=jsonb_build_array(
    jsonb_build_object('key','energy','outcome','energy','predictors',jsonb_build_array('sleep_hours','stress','protein_g','active_energy_kcal','food_kcal'),'lags',jsonb_build_array(1,0,0,0,0)),
    jsonb_build_object('key','cravings','outcome','fringales_envies.urge_intensity','predictors',jsonb_build_array('sleep_hours','stress','protein_g','fiber_g','jeune_intermit._fast_hours','cycle.appetite'),'lags',jsonb_build_array(1,0,0,0,0,0)),
    jsonb_build_object('key','digestion','outcome','digestion','predictors',jsonb_build_array('stress','fiber_g','sleep_hours','jeune_intermit._fast_hours'),'lags',jsonb_build_array(0,0,1,0)),
    jsonb_build_object('key','recovery','outcome','recovery','predictors',jsonb_build_array('sleep_hours','stress','active_energy_kcal','protein_g','food_kcal'),'lags',jsonb_build_array(0,0,0,0,0)),
    jsonb_build_object('key','satiety','outcome','food_satiety','predictors',jsonb_build_array('protein_g','fiber_g','food_kcal','sleep_hours','stress'),'lags',jsonb_build_array(0,0,0,1,0))
  );
  spec jsonb; model jsonb; cached jsonb; models jsonb:='{}'::jsonb;
  pkeys text[]; plags integer[]; mkey text; outcome text;
  source_updated timestamptz; cached_updated timestamptz; cached_through date;
  trained int:=0; usable int:=0;
begin
  if uid is null then raise exception 'auth required'; end if;
  select max(updated_at) into source_updated
  from public.user_reference_daily_facts
  where user_id=uid and fact_date between target_date-89 and target_date;

  for spec in select value from jsonb_array_elements(specs) loop
    mkey:=spec->>'key'; outcome:=spec->>'outcome';
    select array_agg(value order by ord) into pkeys
    from jsonb_array_elements_text(spec->'predictors') with ordinality q(value,ord);
    select array_agg(value::int order by ord) into plags
    from jsonb_array_elements_text(spec->'lags') with ordinality q(value,ord);

    select payload,trained_through,updated_at into cached,cached_through,cached_updated
    from public.user_holistic_learning_models
    where user_id=uid and model_key=mkey;

    if cached is not null and cached_through=target_date
       and (source_updated is null or cached_updated>=source_updated) then
      model:=cached;
    else
      model:=public.mt_holistic_ridge_fit(uid,outcome,pkeys,plags,target_date-89,target_date,1.5);
      insert into public.user_holistic_learning_models(user_id,model_key,trained_through,payload,updated_at)
      values(uid,mkey,target_date,model,now())
      on conflict(user_id,model_key) do update set
        trained_through=excluded.trained_through,payload=excluded.payload,updated_at=now();
    end if;

    trained:=trained+1;
    if model->>'status'='usable' then usable:=usable+1; end if;
    models:=models||jsonb_build_object(mkey,model);
  end loop;

  return jsonb_build_object(
    'version',474,
    'trained_through',target_date,
    'models',models,
    'models_trained',trained,
    'models_usable',usable,
    'causal_graph',jsonb_build_object(
      'version',1,
      'strategy','pre_specified_temporal_graph',
      'principles',jsonb_build_array(
        'previous_day_signals_can_precede_next_day_outcomes',
        'behavioral_adherence_never_fakes_physiology',
        'cycle_is_context_not_automatic_abnormality',
        'no_free_text_inference',
        'no_automatic_energy_change'
      )
    ),
    'note','Les poids se recalibrent sur l historique individuel. Ils soutiennent une hypothèse personnalisée, pas une preuve causale.'
  );
end; $$;

revoke all on function public.mt_holistic_learning_refresh(date) from public, anon;
grant execute on function public.mt_holistic_learning_refresh(date) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Estimation avancée de l'effet d'un levier : ATT apparié.
--
-- Les jours où l'utilisateur a EXPLICITEMENT noté l'application sont comparés à
-- des journées pré-intervention similaires. Les journées du cycle sans check-in
-- sont ignorées (absence de check-in != preuve de non-application).
-- L'appariement utilise uniquement des covariables de la veille afin de réduire
-- le risque d'ajuster sur un médiateur produit par l'intervention elle-même.
-- ---------------------------------------------------------------------------
create or replace function public.mt_holistic_intervention_effect(
  p_user uuid,
  p_cycle_start date,
  p_lever_key text,
  p_target date default current_date
)
returns jsonb
language plpgsql security definer stable
set search_path=public
as $$
declare
  outcome_key text; higher_better boolean:=true;
  treated_n int:=0; control_n int:=0; matched_n int:=0;
  effect_raw numeric; effect_std numeric; effect_median numeric; effect_sd numeric; se numeric; ci_low numeric; ci_high numeric;
  baseline_sd numeric; avg_distance numeric; rel int:=0; interp text:='insufficient';
begin
  if p_user is null or p_cycle_start is null or nullif(trim(p_lever_key),'') is null then
    return jsonb_build_object('status','insufficient','reason','invalid_cycle');
  end if;

  case p_lever_key
    when 'recovery' then outcome_key:='recovery'; higher_better:=true;
    when 'protein' then outcome_key:='food_satiety'; higher_better:=true;
    when 'density' then outcome_key:='digestion'; higher_better:=true;
    else return jsonb_build_object('status','not_applicable','lever',p_lever_key,'reason','no_direct_effect_estimate_for_this_lever');
  end case;

  select count(*)::int into treated_n
  from public.user_adaptive_cycle_checkins c
  join public.user_reference_daily_facts d on d.user_id=c.user_id and d.fact_date=c.checkin_date
  where c.user_id=p_user and c.cycle_started_on=p_cycle_start and c.applied=true
    and c.checkin_date between p_cycle_start and p_target
    and public.mt_holistic_signal_value(d.core,d.numeric_signals,outcome_key) is not null;

  select count(*)::int,stddev_pop(public.mt_holistic_signal_value(d.core,d.numeric_signals,outcome_key))
    into control_n,baseline_sd
  from public.user_reference_daily_facts d
  where d.user_id=p_user and d.fact_date between p_cycle_start-28 and p_cycle_start-1
    and public.mt_holistic_signal_value(d.core,d.numeric_signals,outcome_key) is not null;

  if treated_n<4 or control_n<8 or baseline_sd is null or baseline_sd=0 then
    return jsonb_build_object('status','insufficient','lever',p_lever_key,'outcome',outcome_key,'treated_days',treated_n,'control_days',control_n,'reason','not_enough_comparable_days');
  end if;

  with treated as (
    select c.checkin_date d,
      public.mt_holistic_signal_value(f.core,f.numeric_signals,outcome_key)::numeric y,
      public.mt_holistic_signal_at(p_user,c.checkin_date-1,'sleep_hours')::numeric psleep,
      public.mt_holistic_signal_at(p_user,c.checkin_date-1,'stress')::numeric pstress,
      public.mt_holistic_signal_at(p_user,c.checkin_date-1,'active_energy_kcal')::numeric pactive,
      public.mt_holistic_signal_at(p_user,c.checkin_date-1,outcome_key)::numeric py
    from public.user_adaptive_cycle_checkins c
    join public.user_reference_daily_facts f on f.user_id=c.user_id and f.fact_date=c.checkin_date
    where c.user_id=p_user and c.cycle_started_on=p_cycle_start and c.applied=true
      and c.checkin_date between p_cycle_start and p_target
      and public.mt_holistic_signal_value(f.core,f.numeric_signals,outcome_key) is not null
  ), controls as (
    select f.fact_date d,
      public.mt_holistic_signal_value(f.core,f.numeric_signals,outcome_key)::numeric y,
      public.mt_holistic_signal_at(p_user,f.fact_date-1,'sleep_hours')::numeric psleep,
      public.mt_holistic_signal_at(p_user,f.fact_date-1,'stress')::numeric pstress,
      public.mt_holistic_signal_at(p_user,f.fact_date-1,'active_energy_kcal')::numeric pactive,
      public.mt_holistic_signal_at(p_user,f.fact_date-1,outcome_key)::numeric py
    from public.user_reference_daily_facts f
    where f.user_id=p_user and f.fact_date between p_cycle_start-28 and p_cycle_start-1
      and public.mt_holistic_signal_value(f.core,f.numeric_signals,outcome_key) is not null
  ), s as (
    select
      coalesce(stddev_pop(psleep),1)::numeric sd_sleep,
      coalesce(stddev_pop(pstress),1)::numeric sd_stress,
      coalesce(stddev_pop(pactive),1)::numeric sd_active,
      coalesce(stddev_pop(py),1)::numeric sd_prev_y
    from controls
  ), candidates as (
    select t.d td,c.d cd,t.y ty,c.y cy,
      sqrt(
        (case when t.psleep is not null and c.psleep is not null then power((t.psleep-c.psleep)/greatest(s.sd_sleep,.25),2) when t.psleep is null and c.psleep is null then 0 else .75 end)
       +(case when t.pstress is not null and c.pstress is not null then power((t.pstress-c.pstress)/greatest(s.sd_stress,.5),2) when t.pstress is null and c.pstress is null then 0 else .75 end)
       +(case when t.pactive is not null and c.pactive is not null then power((t.pactive-c.pactive)/greatest(s.sd_active,50),2) when t.pactive is null and c.pactive is null then 0 else .75 end)
       +(case when t.py is not null and c.py is not null then power((t.py-c.py)/greatest(s.sd_prev_y,.5),2) when t.py is null and c.py is null then 0 else .75 end)
      )::numeric distance,
      row_number() over(partition by t.d order by
        sqrt(
          (case when t.psleep is not null and c.psleep is not null then power((t.psleep-c.psleep)/greatest(s.sd_sleep,.25),2) when t.psleep is null and c.psleep is null then 0 else .75 end)
         +(case when t.pstress is not null and c.pstress is not null then power((t.pstress-c.pstress)/greatest(s.sd_stress,.5),2) when t.pstress is null and c.pstress is null then 0 else .75 end)
         +(case when t.pactive is not null and c.pactive is not null then power((t.pactive-c.pactive)/greatest(s.sd_active,50),2) when t.pactive is null and c.pactive is null then 0 else .75 end)
         +(case when t.py is not null and c.py is not null then power((t.py-c.py)/greatest(s.sd_prev_y,.5),2) when t.py is null and c.py is null then 0 else .75 end)
        )
      ) rn
    from treated t cross join controls c cross join s
  ), matched as (
    select td,max(ty) ty,avg(cy) filter(where rn<=2) matched_control,avg(distance) filter(where rn<=2) distance
    from candidates where rn<=2 group by td
  ), diffs as (
    select td,(ty-matched_control)::numeric diff,distance from matched where matched_control is not null
  )
  select count(*)::int,avg(diff),percentile_cont(.5) within group(order by diff),stddev_samp(diff),avg(distance)
    into matched_n,effect_raw,effect_median,effect_sd,avg_distance
  from diffs;

  if matched_n<4 or effect_raw is null then
    return jsonb_build_object('status','insufficient','lever',p_lever_key,'outcome',outcome_key,'treated_days',treated_n,'control_days',control_n,'matched_days',matched_n,'reason','matching_failed');
  end if;

  effect_std:=effect_raw/nullif(baseline_sd,0);
  se:=coalesce(effect_sd,0)/sqrt(greatest(matched_n,1));
  ci_low:=effect_raw-1.96*se;ci_high:=effect_raw+1.96*se;
  rel:=round(
    least(1.0,matched_n/6.0)*45
    +least(1.0,control_n/14.0)*25
    +greatest(0.0,least(1.0,1.0-coalesce(avg_distance,3.0)/4.0))*30
  )::int;
  rel:=greatest(0,least(100,rel));

  if rel<50 then interp:='insufficient';
  elsif higher_better and effect_std>=.20 and ci_low>0 then interp:='favorable';
  elsif higher_better and effect_std<=-.20 and ci_high<0 then interp:='unfavorable';
  elsif not higher_better and effect_std<=-.20 and ci_high<0 then interp:='favorable';
  elsif not higher_better and effect_std>=.20 and ci_low>0 then interp:='unfavorable';
  else interp:='neutral'; end if;

  return jsonb_build_object(
    'status',case when rel>=50 then 'usable' else 'exploratory' end,
    'lever',p_lever_key,'outcome',outcome_key,
    'treated_days',treated_n,'control_days',control_n,'matched_days',matched_n,
    'effect_raw',round(effect_raw,3),'effect_median',round(effect_median,3),
    'effect_std',round(effect_std,3),
    'ci95',jsonb_build_array(round(ci_low,3),round(ci_high,3)),
    'average_match_distance',round(avg_distance,3),
    'reliability',jsonb_build_object('score',rel,'label',case when rel>=75 then 'solide' when rel>=60 then 'utilisable' when rel>=50 then 'prudente' else 'exploratoire' end),
    'interpretation',interp,
    'method','multivariate_preperiod_nearest_neighbor_ATT',
    'guardrail','estimate_is_adjusted_and_temporally_ordered_but_not_causal_proof'
  );
end; $$;

revoke all on function public.mt_holistic_intervention_effect(uuid,date,text,date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Wrapper V474 : enrichit le contexte V473 sans exposer de texte libre.
--    Le bloc V473 ci-dessus recrée toujours mt_holistic_context avant ce wrapper,
--    ce qui rend ce fichier cumulatif et ré-exécutable.
-- ---------------------------------------------------------------------------
drop function if exists public.mt_holistic_context_v473_base(date);
alter function public.mt_holistic_context(date) rename to mt_holistic_context_v473_base;

create or replace function public.mt_holistic_context(target_date date default current_date)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  base jsonb; learning jsonb:='{}'::jsonb; effect jsonb:='{}'::jsonb;
  cycle_state jsonb:='{}'::jsonb; cycle_start date; lever text;
begin
  if uid is null then raise exception 'auth required'; end if;
  base:=public.mt_holistic_context_v473_base(target_date);
  learning:=public.mt_holistic_learning_refresh(target_date);
  cycle_state:=coalesce(base->'holistic'->'adaptive_cycle_state','{}'::jsonb);
  cycle_start:=case when coalesce(cycle_state->>'startedOn','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then (cycle_state->>'startedOn')::date else null end;
  lever:=coalesce(cycle_state->'decision'->>'key','');
  if cycle_start is not null and lever<>'' then
    effect:=public.mt_holistic_intervention_effect(uid,cycle_start,lever,target_date);
  else
    effect:=jsonb_build_object('status','not_applicable');
  end if;
  base:=jsonb_set(base,'{holistic,version}',to_jsonb(474),true);
  base:=jsonb_set(base,'{holistic,learning}',coalesce(learning,'{}'::jsonb),true);
  base:=jsonb_set(base,'{holistic,intervention_effect}',coalesce(effect,'{}'::jsonb),true);
  base:=jsonb_set(base,'{holistic,note}',to_jsonb('Lecture personnalisée multivariée. Les poids apprennent sur l historique individuel ; les estimations d intervention restent prudentes et ne constituent pas une preuve causale.'::text),true);
  return base;
end; $$;

revoke all on function public.mt_holistic_context(date) from public, anon;
grant execute on function public.mt_holistic_context(date) to authenticated;

-- La fonction de base est interne au wrapper V474.
revoke all on function public.mt_holistic_context_v473_base(date) from public, anon, authenticated;

commit;
