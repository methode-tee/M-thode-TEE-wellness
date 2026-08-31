-- V447 — Correctif critique enregistrement repas
-- Corrige: ERROR: cannot pass more than 100 arguments to a function
-- Cause: V446 utilisait jsonb_build_object avec 54 paires (108 arguments).
-- Impact: les triggers de user_reference_daily_facts pouvaient annuler l'INSERT/UPDATE d'un repas,
-- y compris depuis l'ancienne version App Store, car la base Supabase est partagée.

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
  v_bev_composition_known integer := 0;
  v_bev_caffeine_count integer := 0;
  v_daily integer := 0;
  v_journal integer := 0;
  v_kcal numeric; v_protein numeric; v_fiber numeric; v_fat numeric; v_carbs numeric; v_salt numeric;
  v_sugars numeric; v_saturated numeric; v_sodium numeric; v_trans numeric; v_mono numeric; v_poly numeric; v_starch numeric; v_polyols numeric; v_cholesterol numeric; v_alcohol numeric; v_omega3 numeric; v_omega6 numeric; v_energy_kj numeric;
  v_food_energy numeric; v_food_digestion numeric; v_food_satiety numeric;
  v_food_micros jsonb := '{}'::jsonb; v_food_micro_count integer := 0;
  v_hydration numeric; v_bev_hydration numeric; v_bev_energy numeric; v_bev_digestion numeric; v_daily_hydration numeric; v_daily_sleep numeric; v_sleep_hours numeric;
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

  -- Extras structurés utiles au moteur : uniquement si TOUS les repas de la journée
  -- documentent réellement la clé. Aucun total partiel n'est promu en total journalier.
  select
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'omega3_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'omega3_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'omega6_g')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'omega6_g')) end,
    case when count(*)>0 and count(*) filter(where exists(select 1 from public.food_meal_items i where i.meal_id=m.id) and m.nutrition_extra_total ? 'energy_kj')=count(*) then sum(public.mt_nutrition_extra_num(m.nutrition_extra_total,'energy_kj')) end
  into v_omega3,v_omega6,v_energy_kj
  from public.food_meals m where m.user_id=p_user and m.meal_date=p_date;

  -- Micronutriments : les snapshots de chaque item sont déjà calculés pour la quantité
  -- consommée. On les agrège sous nutrition.<clé> dans numeric_signals. Ainsi CIQUAL,
  -- admin et Open Food Facts nourrissent les tendances sans exiger l'ouverture du tracker.
  with item_count as (
    select count(*)::int total_items
    from public.food_meals m join public.food_meal_items i on i.meal_id=m.id
    where m.user_id=p_user and m.meal_date=p_date
  ), z as (
    select e.key,
      count(distinct i.id)::int known_items,
      sum(case
        when jsonb_typeof(e.value)='number' then (e.value#>>'{}')::numeric
        when jsonb_typeof(e.value)='object' and nullif(trim(e.value->>'value'),'') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(e.value->>'value',',','.')::numeric
        else null end) value
    from public.food_meals m
    join public.food_meal_items i on i.meal_id=m.id
    cross join lateral jsonb_each(coalesce(i.micronutrients,'{}'::jsonb)) e
    where m.user_id=p_user and m.meal_date=p_date and left(e.key,1) <> '_'
    group by e.key
  ), usable as (
    select z.key,z.value from z cross join item_count c
    where c.total_items>0 and z.known_items=c.total_items and z.value is not null
  )
  select coalesce(jsonb_object_agg('nutrition.'||key,to_jsonb(round(value,4))),'{}'::jsonb),count(*)::int
  into v_food_micros,v_food_micro_count from usable;
  v_numeric:=coalesce(v_numeric,'{}'::jsonb)||coalesce(v_food_micros,'{}'::jsonb);
  if coalesce(v_food_micro_count,0)>0 then v_micro:=greatest(coalesce(v_micro,0),v_food_micro_count); end if;

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

  select count(*)::int,coalesce(sum(hydration_ml),0)::numeric,
    avg(energy_after)::numeric,avg(digestion_after)::numeric,
    count(*) filter(where composition_known)::int,
    nullif(count(*) filter(where exists(
      select 1 from jsonb_array_elements(coalesce(ingredients_snapshot,'[]'::jsonb)) x
      where lower(coalesce(x->>'caffeine_level',''))='present'
    )),0)::int
  into v_bev_count,v_bev_hydration,v_bev_energy,v_bev_digestion,v_bev_composition_known,v_bev_caffeine_count
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
  v_energy := coalesce(v_energy,v_j_energy,v_food_energy,v_bev_energy);
  v_digestion := coalesce(v_digestion,v_j_digest,v_food_digestion,v_bev_digestion);
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

  -- PostgreSQL limite les appels de fonction à 100 arguments.
  -- Le V446 construisait 54 paires clé/valeur dans un seul jsonb_build_object
  -- (108 arguments), ce qui faisait échouer les triggers lors de l'enregistrement
  -- d'un repas. On compose désormais plusieurs objets plus petits.
  v_core := jsonb_strip_nulls(
    jsonb_build_object(
      'food_kcal',v_kcal,'protein_g',v_protein,'fiber_g',v_fiber,'fat_g',v_fat,'carbs_g',v_carbs,'salt_g',v_salt,
      'sugars_g',v_sugars,'saturated_fat_g',v_saturated,'sodium_g',v_sodium,'trans_fat_g',v_trans,
      'monounsaturated_fat_g',v_mono,'polyunsaturated_fat_g',v_poly,'starch_g',v_starch,'polyols_g',v_polyols,
      'cholesterol_g',v_cholesterol,'alcohol_g',v_alcohol,'omega3_g',v_omega3,'omega6_g',v_omega6,'energy_kj',v_energy_kj,
      'food_meal_count',v_meal_count,'food_meals_with_items',v_meals_with_items,
      'food_calculated_meals',v_known_kcal_meals,
      'food_known_kcal_meals',v_known_kcal_meals,'food_known_protein_meals',v_known_protein_meals,'food_known_fiber_meals',v_known_fiber_meals,
      'food_known_fat_meals',v_known_fat_meals,'food_known_carbs_meals',v_known_carbs_meals,'food_known_salt_meals',v_known_salt_meals,
      'food_recorded_nutrition_complete',v_nutrition_complete,'food_recalibration_eligible',v_recalibration_eligible
    )
    || jsonb_build_object(
      'food_energy',v_food_energy,'food_digestion',v_food_digestion,'food_satiety',v_food_satiety,
      'stress',v_stress,'mood',v_mood,'energy',v_energy,'digestion',v_digestion,
      'sleep_quality',v_sleep_quality,'sleep_hours',v_sleep_hours,
      'steps',v_steps,'active_energy_kcal',v_active,'recovery',v_recovery,
      'weight_kg',v_weight,'waist_cm',v_waist,'hydration_liters',v_hydration,
      'beverage_count',case when v_bev_count>0 then v_bev_count else null end,
      'beverage_hydration_liters',case when v_bev_hydration>0 then v_bev_hydration/1000.0 else null end,
      'beverage_energy',v_bev_energy,'beverage_digestion',v_bev_digestion,
      'beverage_composition_known_count',case when v_bev_count>0 then v_bev_composition_known else null end,
      'beverage_caffeine_count',v_bev_caffeine_count,
      'micronutrient_coverage_count',v_micro,
      'reflux_episode',v_reflux_episode,'reflux_after_meal_3h',v_reflux_after_meal
    )
  );

  insert into public.user_reference_daily_facts(user_id,fact_date,core,numeric_signals,tracker_keys,source_count,updated_at)
  values(p_user,p_date,v_core,coalesce(v_numeric,'{}'::jsonb),coalesce(v_keys,'{}'::text[]),v_source_count,now())
  on conflict(user_id,fact_date) do update set
    core=excluded.core,numeric_signals=excluded.numeric_signals,tracker_keys=excluded.tracker_keys,
    source_count=excluded.source_count,updated_at=now();

  if p_refresh_month then perform public.mt_refresh_reference_month(p_user,p_date); end if;
end;
$$;


revoke all on function public.mt_refresh_reference_day(uuid,date,boolean) from public,anon,authenticated;

-- Aucun backfill n'est nécessaire pour débloquer les saisies.
-- Les jours seront recalculés normalement au prochain changement, et le bootstrap existant
-- pourra compléter les agrégats selon sa cadence habituelle.
