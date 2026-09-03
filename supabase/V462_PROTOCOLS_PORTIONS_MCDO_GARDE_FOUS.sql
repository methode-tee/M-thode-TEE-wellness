-- MÉTHODE TEE — V462 · Protocoles jusqu'au jour courant + portions McDonald's
-- Base : ZIP 415 / moteur adaptatif V461 conservé.
-- Ce script est idempotent : il peut être relancé sans dupliquer les portions.

begin;

do $preflight$
begin
  if to_regclass('public.protocol_progress') is null
     or to_regclass('public.user_reference_daily_facts') is null
     or to_regclass('public.food_dictionary') is null
     or to_regclass('public.food_portion_profiles') is null then
    raise exception 'Pré-requis V411.2/V453 absents : aucune modification appliquée.';
  end if;
  if to_regprocedure('public.mt_reference_bootstrap(integer)') is null
     or to_regprocedure('public.mt_reference_period_summary(uuid,date,date)') is null then
    raise exception 'Fonctions de repères V453 absentes : aucune modification appliquée.';
  end if;
end
$preflight$;

-- -----------------------------------------------------------------------------
-- 1. PROTOCOLES : UNE DONNÉE DU JOUR RESTE LISIBLE AVANT VALIDATION
-- -----------------------------------------------------------------------------
-- V453 avait réintroduit last_validated_at comme borne de la période Pendant.
-- La version ci-dessous conserve les faits compacts/whitelistés de V453 mais
-- rétablit la règle de V412.1 : jusqu'à aujourd'hui pour un protocole en cours.

create or replace function public.mt_protocol_reference_comparison(p_protocol_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid(); p record; start_d date; planned_end date; actual_end date; observed_until date; today_d date:=current_date;
  before_j jsonb; during_j jsonb; after_j jsonb; during_days jsonb := '[]'::jsonb;
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

  observed_until:=case
    when finished and actual_end is not null then least(actual_end,today_d)
    else least(planned_end,today_d)
  end;
  if observed_until<start_d then observed_until:=start_d; end if;

  perform public.mt_reference_bootstrap(90);
  before_j:=public.mt_reference_period_summary(uid,start_d-28,start_d-1);
  during_j:=public.mt_reference_period_summary(uid,start_d,observed_until);

  -- Maximum 60 lignes compactes et whitelisted : jamais food_meal_items, jamais
  -- l'historique brut des trackers. La protection egress V453 est conservée.
  select coalesce(jsonb_agg(jsonb_build_object('date',d.fact_date,'core',jsonb_strip_nulls(jsonb_build_object(
    'food_kcal',public.mt_reference_num(d.core,'food_kcal'),'protein_g',public.mt_reference_num(d.core,'protein_g'),'fiber_g',public.mt_reference_num(d.core,'fiber_g'),
    'fat_g',public.mt_reference_num(d.core,'fat_g'),'carbs_g',public.mt_reference_num(d.core,'carbs_g'),'salt_g',public.mt_reference_num(d.core,'salt_g'),
    'sugars_g',public.mt_reference_num(d.core,'sugars_g'),'saturated_fat_g',public.mt_reference_num(d.core,'saturated_fat_g'),'sodium_g',public.mt_reference_num(d.core,'sodium_g'),
    'omega3_g',public.mt_reference_num(d.core,'omega3_g'),'omega6_g',public.mt_reference_num(d.core,'omega6_g'),'micronutrient_coverage_count',public.mt_reference_num(d.core,'micronutrient_coverage_count'),
    'food_energy',public.mt_reference_num(d.core,'food_energy'),'food_digestion',public.mt_reference_num(d.core,'food_digestion'),'food_satiety',public.mt_reference_num(d.core,'food_satiety'),
    'beverage_count',public.mt_reference_num(d.core,'beverage_count'),'beverage_hydration_liters',public.mt_reference_num(d.core,'beverage_hydration_liters'),
    'beverage_energy',public.mt_reference_num(d.core,'beverage_energy'),'beverage_digestion',public.mt_reference_num(d.core,'beverage_digestion'),'beverage_caffeine_count',public.mt_reference_num(d.core,'beverage_caffeine_count'),
    'hydration_liters',public.mt_reference_num(d.core,'hydration_liters'),'stress',public.mt_reference_num(d.core,'stress'),'mood',public.mt_reference_num(d.core,'mood'),'energy',public.mt_reference_num(d.core,'energy'),'digestion',public.mt_reference_num(d.core,'digestion'),
    'sleep_quality',public.mt_reference_num(d.core,'sleep_quality'),'sleep_hours',public.mt_reference_num(d.core,'sleep_hours'),'steps',public.mt_reference_num(d.core,'steps'),'active_energy_kcal',public.mt_reference_num(d.core,'active_energy_kcal'),'recovery',public.mt_reference_num(d.core,'recovery'),
    'weight_kg',public.mt_reference_num(d.core,'weight_kg'),'waist_cm',public.mt_reference_num(d.core,'waist_cm')
  )), 'signals', (
    select coalesce(jsonb_object_agg(x.key,x.value),'{}'::jsonb)
    from (select e.key,e.value from jsonb_each(coalesce(d.numeric_signals,'{}'::jsonb)) e order by e.key limit 24) x
  )) order by d.fact_date),'[]'::jsonb) into during_days
  from public.user_reference_daily_facts d
  where d.user_id=uid and d.fact_date between start_d and observed_until and d.source_count>0;

  if finished and actual_end is not null and today_d>actual_end then
    after_j:=public.mt_reference_period_summary(uid,actual_end+1,least(actual_end+28,today_d));
  else
    after_j:=jsonb_build_object('documented_days',0);
  end if;

  return jsonb_build_object('available',true,'start_date',start_d,'planned_end_date',planned_end,
    'actual_end_date',actual_end,'end_date',coalesce(actual_end,planned_end),'completion_status',case when finished then 'completed' else 'in_progress' end,
    'before',before_j,'during',during_j,'after',after_j,'during_days',during_days,
    'note',case when finished then 'Comparaison descriptive fondée sur la fin réellement enregistrée.' else 'Protocole en cours : les données documentées jusqu’à aujourd’hui sont incluses, même avant validation de la journée.' end);
end;
$$;

revoke all on function public.mt_protocol_reference_comparison(uuid) from public,anon;
grant execute on function public.mt_protocol_reference_comparison(uuid) to authenticated;
comment on function public.mt_protocol_reference_comparison(uuid) is 'V462 · Faits compacts V453, maximum 60 jours, période en cours lue jusqu’au jour courant sans créer de validation.';

-- -----------------------------------------------------------------------------
-- 2. PORTIONS MCDONALD'S : UNE PORTION RÉELLE AU LIEU DU FALLBACK 100 G
-- -----------------------------------------------------------------------------
-- Le catalogue McDonald's déjà importé conserve le poids estimé à partir des
-- deux colonnes officielles « Pour 100 g/ml » et « Par produit ». On l'utilise
-- uniquement comme repère de saisie. Les valeurs nutritionnelles /100 g restent
-- la source de calcul et aucun repas historique n'est modifié.

-- Chaque écriture utilise son propre CTE : aucune table temporaire n'est requise.
-- Le script reste ainsi compatible avec l'exécution statement par statement du
-- SQL Editor mobile et avec une exécution complète en transaction.
with mcdo_portions as (
  select
    d.id food_dictionary_id,
    d.display_name,
    (d.adapter_profile->>'official_serving_weight_estimate_g')::numeric serving_weight
  from public.food_dictionary d
  where d.source like 'Méthode Tee · McDonald’s France%'
    and coalesce((d.adapter_profile->>'restaurant_product')::boolean,false)
    and coalesce(d.adapter_profile->>'official_serving_weight_estimate_g','') ~ '^[0-9]+([.][0-9]+)?$'
    and (d.adapter_profile->>'official_serving_weight_estimate_g')::numeric>0
)
update public.food_portion_profiles p
set
  name_pattern=m.display_name,
  match_mode='exact',
  unit_label='portion',
  grams_per_unit=m.serving_weight,
  default_amount=1,
  step=1,
  min_amount=1,
  estimated=true,
  verified=false,
  source_label='McDonald’s France · valeurs officielles par produit et pour 100 g/ml',
  notes='Poids de portion déduit du rapport entre la valeur officielle par produit et la valeur officielle pour 100 g/ml ; variation réelle possible en restaurant.',
  priority=1,
  enabled=true,
  updated_at=now()
from mcdo_portions m
where p.food_dictionary_id=m.food_dictionary_id;

with mcdo_portions as (
  select
    d.id food_dictionary_id,
    d.display_name,
    (d.adapter_profile->>'official_serving_weight_estimate_g')::numeric serving_weight
  from public.food_dictionary d
  where d.source like 'Méthode Tee · McDonald’s France%'
    and coalesce((d.adapter_profile->>'restaurant_product')::boolean,false)
    and coalesce(d.adapter_profile->>'official_serving_weight_estimate_g','') ~ '^[0-9]+([.][0-9]+)?$'
    and (d.adapter_profile->>'official_serving_weight_estimate_g')::numeric>0
)
insert into public.food_portion_profiles(
  food_dictionary_id,name_pattern,match_mode,unit_label,grams_per_unit,
  default_amount,step,min_amount,estimated,verified,source_label,notes,priority,enabled
)
select
  m.food_dictionary_id,m.display_name,'exact','portion',m.serving_weight,
  1,1,1,true,false,
  'McDonald’s France · valeurs officielles par produit et pour 100 g/ml',
  'Poids de portion déduit du rapport entre la valeur officielle par produit et la valeur officielle pour 100 g/ml ; variation réelle possible en restaurant.',
  1,true
from mcdo_portions m
where not exists(
  select 1 from public.food_portion_profiles p
  where p.food_dictionary_id=m.food_dictionary_id
);

commit;

select jsonb_pretty(jsonb_build_object(
  'status','v462_protocoles_portions_mcdo_pret',
  'protocol_current_day_ready',to_regprocedure('public.mt_protocol_reference_comparison(uuid)') is not null,
  'mcdo_portions_available',(
    select count(*) from public.food_portion_profiles p
    join public.food_dictionary d on d.id=p.food_dictionary_id
    where p.enabled and d.source like 'Méthode Tee · McDonald’s France%'
  ),
  'historical_meals_rewritten',false,
  'purchases_changed',false,
  'seven_am_unlock_changed',false
));
