-- MÉTHODE TEE · V445 · NUTRITION COMPLÈTE + FAVORIS/ROUTINES (SQL)
-- Stocke les nutriments réellement disponibles sans transformer l'inconnu en zéro.
-- Le détail complet reste au niveau du repas ; les faits quotidiens n'exposent
-- qu'un sous-ensemble utile afin de préserver le cached egress.
begin;

alter table public.ciqual_foods add column if not exists nutrition_extra_100g jsonb not null default '{}'::jsonb;
alter table public.food_dictionary add column if not exists custom_nutrition_extra_100g jsonb not null default '{}'::jsonb;
alter table public.food_meal_items add column if not exists nutrition_extra_100g jsonb not null default '{}'::jsonb;
alter table public.food_meal_items add column if not exists nutrition_extra jsonb not null default '{}'::jsonb;
alter table public.food_meals add column if not exists nutrition_extra_total jsonb not null default '{}'::jsonb;

create or replace function public.mt_nutrition_extra_num(p_values jsonb,p_key text)
returns numeric language plpgsql immutable set search_path=public as $$
declare v jsonb; raw text;
begin
  if p_values is null or p_key is null or not (p_values ? p_key) then return null; end if;
  v:=p_values->p_key;
  if jsonb_typeof(v)='object' then raw:=nullif(trim(v->>'value'),''); else raw:=nullif(trim(v#>>'{}'),''); end if;
  if raw is null or raw !~ '^-?[0-9]+([.,][0-9]+)?$' then return null; end if;
  return replace(raw,',','.')::numeric;
exception when others then return null;
end; $$;

create or replace function public.search_foods_v4(p_query text,p_limit integer default 10)
returns table(code text,name text,kcal_100g numeric,protein_100g numeric,fat_100g numeric,carbs_100g numeric,fiber_100g numeric,salt_100g numeric,source text,dictionary_id uuid,display_name text,country text,categories text[],adapter_profile jsonb,match_rank integer,micronutrients_100g jsonb,nutrition_extra_100g jsonb)
language sql stable security invoker set search_path=public as $$
  select f.code,f.name,f.kcal_100g,f.protein_100g,f.fat_100g,f.carbs_100g,f.fiber_100g,f.salt_100g,
    f.source,f.dictionary_id,f.display_name,f.country,f.categories,f.adapter_profile,f.match_rank,
    (
      coalesce((select jsonb_object_agg(n.nutrient_key,jsonb_build_object('value',n.value_100g,'unit',n.unit,'source',n.source,'version',n.source_version)) from public.ciqual_food_nutrients n where n.ciqual_code=f.code),'{}'::jsonb)
      || coalesce((select d.custom_micronutrients_100g from public.food_dictionary d where d.id=f.dictionary_id),'{}'::jsonb)
    ) micronutrients_100g,
    (
      coalesce((select c.nutrition_extra_100g from public.ciqual_foods c where c.code=f.code),'{}'::jsonb)
      || coalesce((select case when d.nutrition_verified then d.custom_nutrition_extra_100g else '{}'::jsonb end from public.food_dictionary d where d.id=f.dictionary_id),'{}'::jsonb)
    ) nutrition_extra_100g
  from public.search_foods_v2(p_query,greatest(1,least(coalesce(p_limit,10),50))) f;
$$;
grant execute on function public.search_foods_v4(text,integer) to anon,authenticated;

create or replace function public.mt_refresh_reference_day(p_user uuid, p_date date, p_refresh_month boolean default true)
returns void
language plpgsql security definer
set search_path=public
as $$
declare
  v_core jsonb := '{}'::jsonb;
  v_numeric jsonb := '{}'::jsonb;
  v_keys text[] := '{}';
  v_source_count integer := 0;
  v_tracker_count integer := 0;
  v_meal_count integer := 0;
  v_meals_with_items integer := 0;
  v_known_kcal_meals integer := 0;
  v_known_protein_meals integer := 0;
  v_known_fiber_meals integer := 0;
  v_known_fat_meals integer := 0;
  v_known_carbs_meals integer := 0;
  v_known_salt_meals integer := 0;
  v_nutrition_complete integer := 0;
  v_recalibration_eligible integer := 0;
  v_bev_count integer := 0;
  v_daily integer := 0;
  v_journal integer := 0;
  v_kcal numeric; v_protein numeric; v_fiber numeric; v_fat numeric; v_carbs numeric; v_salt numeric;
  v_sugars numeric; v_saturated numeric; v_sodium numeric; v_trans numeric; v_mono numeric; v_poly numeric; v_starch numeric; v_polyols numeric; v_cholesterol numeric; v_alcohol numeric;
  v_food_energy numeric; v_food_digestion numeric; v_food_satiety numeric;
  v_hydration numeric; v_bev_hydration numeric; v_daily_hydration numeric; v_daily_sleep numeric; v_sleep_hours numeric;
  v_stress numeric; v_mood numeric; v_energy numeric; v_digestion numeric;
  v_sleep_quality numeric; v_steps numeric; v_active numeric; v_recovery numeric;
  v_weight numeric; v_waist numeric; v_micro numeric;
  v_reflux_episode numeric; v_reflux_after_meal numeric; v_reflux_onset time;
  v_j_stress numeric; v_j_mood numeric; v_j_energy numeric; v_j_digest numeric; v_j_sleep numeric;
begin
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

  select
    count(*)::int,
    count(*) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id))::int,
    count(*) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.kcal_total is not null and m.kcal_total>0)::int,
    count(*) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.protein_total is not null)::int,
    count(*) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.fiber_total is not null)::int,
    count(*) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.fat_total is not null)::int,
    count(*) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.carbs_total is not null)::int,
    count(*) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.salt_total is not null)::int,
    sum(m.kcal_total) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.kcal_total is not null and m.kcal_total>0),
    sum(m.protein_total) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.protein_total is not null),
    sum(m.fiber_total) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.fiber_total is not null),
    sum(m.fat_total) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.fat_total is not null),
    sum(m.carbs_total) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.carbs_total is not null),
    sum(m.salt_total) filter (where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.salt_total is not null),
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'sugars_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'sugars_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'saturated_fat_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'saturated_fat_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'sodium_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'sodium_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'trans_fat_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'trans_fat_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'monounsaturated_fat_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'monounsaturated_fat_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'polyunsaturated_fat_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'polyunsaturated_fat_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'starch_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'starch_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'polyols_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'polyols_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'cholesterol_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'cholesterol_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'alcohol_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'alcohol_g')) end,
    avg(m.energy_after), avg(m.digestion_after), avg(m.satiety_after)
  into v_meal_count,v_meals_with_items,v_known_kcal_meals,v_known_protein_meals,v_known_fiber_meals,v_known_fat_meals,v_known_carbs_meals,v_known_salt_meals,
       v_kcal,v_protein,v_fiber,v_fat,v_carbs,v_salt,v_sugars,v_saturated,v_sodium,v_trans,v_mono,v_poly,v_starch,v_polyols,v_cholesterol,v_alcohol,v_food_energy,v_food_digestion,v_food_satiety
  from public.food_meals m where m.user_id=p_user and m.meal_date=p_date;

  if v_meal_count>0
    and v_known_kcal_meals=v_meal_count
    and v_known_protein_meals=v_meal_count
    and v_known_fiber_meals=v_meal_count then
    v_nutrition_complete:=1;
  end if;
  if v_meal_count>=2 and v_known_kcal_meals=v_meal_count and v_kcal between 900 and 5000 then
    v_recalibration_eligible:=1;
  end if;
  -- Les totaux détaillés ne sont exposés que si tous les repas enregistrés du jour
  -- disposent réellement de la donnée correspondante. Aucun total partiel n'est
  -- présenté comme un total complet.
  if v_known_fat_meals<>v_meal_count then v_fat:=null; end if;
  if v_known_carbs_meals<>v_meal_count then v_carbs:=null; end if;
  if v_known_salt_meals<>v_meal_count then v_salt:=null; end if;

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
    'food_kcal',v_kcal,'protein_g',v_protein,'fiber_g',v_fiber,'fat_g',v_fat,'carbs_g',v_carbs,'salt_g',v_salt,
    'sugars_g',v_sugars,'saturated_fat_g',v_saturated,'sodium_g',v_sodium,'trans_fat_g',v_trans,
    'monounsaturated_fat_g',v_mono,'polyunsaturated_fat_g',v_poly,'starch_g',v_starch,'polyols_g',v_polyols,
    'cholesterol_g',v_cholesterol,'alcohol_g',v_alcohol,
    'food_meal_count',v_meal_count,'food_meals_with_items',v_meals_with_items,
    'food_calculated_meals',v_known_kcal_meals,
    'food_known_kcal_meals',v_known_kcal_meals,'food_known_protein_meals',v_known_protein_meals,'food_known_fiber_meals',v_known_fiber_meals,
    'food_known_fat_meals',v_known_fat_meals,'food_known_carbs_meals',v_known_carbs_meals,'food_known_salt_meals',v_known_salt_meals,
    'food_recorded_nutrition_complete',v_nutrition_complete,'food_recalibration_eligible',v_recalibration_eligible,
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
-- Contexte compact : ajoute le poids de profil et la donnée physiologique.
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

  select coalesce(core,'{}'::jsonb) || coalesce(numeric_signals,'{}'::jsonb) into v_today
  from public.user_reference_daily_facts where user_id=uid and fact_date=target_date;

  select jsonb_strip_nulls(jsonb_build_object(
    'birth_date',birth_date,'height_cm',height_cm,'reference_gender',reference_gender,
    'reference_sex',reference_sex,'reference_weight_kg',reference_weight_kg,'settings',reference_settings
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

  select coalesce(jsonb_object_agg(tracker_key,settings),'{}'::jsonb) into v_preferences
  from public.user_tracker_preferences where user_id=uid and enabled=true;

  return jsonb_build_object('date',target_date,'profile',v_profile,'today',coalesce(v_today,'{}'::jsonb),
    'summary28',coalesce(v_summary,'{}'::jsonb),'tracker_days',v_trackers,'preferences',v_preferences,
    'source_note','Repères construits à partir des données réellement renseignées. Une absence reste une absence, jamais un zéro.');
end;
$$;

-- ---------------------------------------------------------------------------
-- Protocoles : "Après" dépend d'une FIN RÉELLE, jamais de la date théorique.
-- Une interruption ne crée donc pas artificiellement une période Après.
-- ---------------------------------------------------------------------------
create or replace function public.mt_protocol_reference_comparison(p_protocol_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid(); p record; start_d date; planned_end date; actual_end date; observed_until date; today_d date:=current_date;
  before_j jsonb; during_j jsonb; after_j jsonb;
  completed_count integer:=0; finished boolean:=false; total_n integer:=1;
begin
  if uid is null then raise exception 'auth required'; end if;
  select started_at,total_days,current_day,completed_days,certificate_unlocked,last_validated_at,updated_at into p
  from public.protocol_progress where user_id=uid and protocol_id=p_protocol_id limit 1;
  if not found then return jsonb_build_object('available',false); end if;

  start_d:=coalesce(p.started_at::date,current_date);
  total_n:=greatest(1,least(60,coalesce(p.total_days,28)));
  planned_end:=start_d+total_n-1;
  if jsonb_typeof(coalesce(p.completed_days,'[]'::jsonb))='array' then completed_count:=jsonb_array_length(coalesce(p.completed_days,'[]'::jsonb)); end if;
  finished:=coalesce(p.certificate_unlocked,false) or completed_count>=total_n;
  if finished then actual_end:=coalesce(p.last_validated_at,p.updated_at)::date; end if;
  observed_until:=case when finished then least(actual_end,today_d) else least(coalesce(p.last_validated_at::date,start_d),today_d) end;

  perform public.mt_reference_bootstrap(90);
  before_j:=public.mt_reference_period_summary(uid,start_d-28,start_d-1);
  during_j:=public.mt_reference_period_summary(uid,start_d,greatest(start_d,observed_until));
  if finished and actual_end is not null and today_d>actual_end then
    after_j:=public.mt_reference_period_summary(uid,actual_end+1,least(actual_end+28,today_d));
  else
    after_j:=jsonb_build_object('documented_days',0);
  end if;

  return jsonb_build_object('available',true,'start_date',start_d,'planned_end_date',planned_end,
    'actual_end_date',actual_end,'end_date',coalesce(actual_end,planned_end),'completion_status',case when finished then 'completed' else 'in_progress' end,
    'before',before_j,'during',during_j,'after',after_j,
    'note',case when finished then 'Comparaison descriptive fondée sur la fin réellement enregistrée.' else 'Protocole non terminé : aucune période Après n’est créée.' end);
end;
$$;

-- Les faits V441 existants doivent être reconstruits une fois avec les nouveaux
-- indicateurs de complétude. On invalide seulement l'état de bootstrap ; les
-- données brutes ne sont pas envoyées au client.
update public.user_reference_sync_state
set last_28d_sync_at=null,last_90d_sync_at=null,updated_at=now();

revoke all on function public.mt_reference_period_summary(uuid,date,date) from public,anon,authenticated;
revoke all on function public.mt_refresh_reference_day(uuid,date,boolean) from public,anon,authenticated;
revoke all on function public.mt_reference_context(date) from public,anon;
revoke all on function public.mt_protocol_reference_comparison(uuid) from public,anon;
grant execute on function public.mt_reference_context(date) to authenticated;
grant execute on function public.mt_protocol_reference_comparison(uuid) to authenticated;

comment on column public.profiles.reference_weight_kg is 'V442 · Poids de départ/fallback du profil. Un poids plus récent de suivi reste prioritaire côté moteur.';
comment on column public.profiles.reference_sex is 'V442 · Donnée facultative utilisée uniquement pour resserrer une équation énergétique adulte, distincte du profil affiché.';

commit;
