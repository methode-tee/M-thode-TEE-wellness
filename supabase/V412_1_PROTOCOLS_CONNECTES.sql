-- MÉTHODE TEE — V412.1 · PROTOCOLES CONNECTÉS AU PROFIL + CARNET
-- Additif sûr au V453. Aucun ancien repas, aucune ancienne boisson et aucune
-- validation de protocole ne sont modifiés.
--
-- Corrige uniquement la lecture :
--   1) un protocole en cours observe les données renseignées jusqu'à aujourd'hui,
--      même avant d'appuyer sur « Valider la journée » ;
--   2) le poids actuel du Profil peut être utilisé comme repère de secours si
--      aucune pesée datée n'existe pendant le protocole ;
--   3) « Protéines documentées » peut lire la somme réellement connue des items
--      du Carnet sans transformer les aliments inconnus en zéro.

begin;

do $preflight$
begin
  if to_regclass('public.protocol_progress') is null
     or to_regclass('public.user_reference_daily_facts') is null
     or to_regclass('public.food_meals') is null
     or to_regclass('public.food_meal_items') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Schéma incomplet pour V412.1.';
  end if;
  if to_regprocedure('public.mt_reference_bootstrap(integer)') is null
     or to_regprocedure('public.mt_reference_period_summary(uuid,date,date)') is null
     or to_regprocedure('public.mt_reference_num(jsonb,text)') is null then
    raise exception 'Couche de repères transversaux manquante : installer V441/V453 avant V412.1.';
  end if;
end
$preflight$;

create or replace function public.mt_protocol_reference_comparison(p_protocol_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  p record;
  start_d date;
  planned_end date;
  actual_end date;
  observed_until date;
  today_d date:=current_date;
  before_j jsonb;
  during_j jsonb;
  after_j jsonb;
  during_days jsonb:='[]'::jsonb;
  profile_ref jsonb:='{}'::jsonb;
  completed_count integer:=0;
  finished boolean:=false;
  total_n integer:=1;
begin
  if uid is null then raise exception 'auth required'; end if;

  select started_at,total_days,current_day,completed_days,certificate_unlocked,last_validated_at,updated_at
  into p
  from public.protocol_progress
  where user_id=uid and protocol_id=p_protocol_id
  order by updated_at desc
  limit 1;
  if not found then return jsonb_build_object('available',false); end if;

  start_d:=coalesce(p.started_at::date,current_date);
  total_n:=greatest(1,least(60,coalesce(p.total_days,28)));
  planned_end:=start_d+total_n-1;

  if jsonb_typeof(coalesce(p.completed_days,'[]'::jsonb))='array' then
    completed_count:=jsonb_array_length(coalesce(p.completed_days,'[]'::jsonb));
  end if;
  finished:=coalesce(p.certificate_unlocked,false) or completed_count>=total_n;
  if finished then actual_end:=coalesce(p.last_validated_at,p.updated_at)::date; end if;

  -- Une donnée saisie dans le Carnet / Profil / suivi appartient au protocole en cours
  -- même si la journée du protocole n'est pas encore validée.
  observed_until:=case
    when finished and actual_end is not null then least(actual_end,today_d)
    else least(planned_end,today_d)
  end;
  if observed_until<start_d then observed_until:=start_d; end if;

  perform public.mt_reference_bootstrap(90);
  before_j:=public.mt_reference_period_summary(uid,start_d-28,start_d-1);
  during_j:=public.mt_reference_period_summary(uid,start_d,observed_until);

  select jsonb_strip_nulls(jsonb_build_object(
    'weight_kg',reference_weight_kg,
    'height_cm',height_cm,
    'reference_sex',coalesce(reference_sex,reference_gender),
    'body_intention',reference_settings->>'body_intention',
    'source','Mon profil'
  )) into profile_ref
  from public.profiles where id=uid;
  profile_ref:=coalesce(profile_ref,'{}'::jsonb);

  -- Les totaux journaliers historiques restent inchangés. Pour la seule carte
  -- « Protéines documentées », on calcule en lecture seule la somme des valeurs
  -- positives déjà figées dans les items du repas. Les anciens zéros par défaut
  -- ne sont donc jamais assimilés à une protéine réellement documentée.
  with facts as (
    select fact_date,core,numeric_signals,source_count
    from public.user_reference_daily_facts
    where user_id=uid and fact_date between start_d and observed_until
  ), item_protein as (
    select
      m.meal_date fact_date,
      i.id,
      case
        when i.quantity_g is not null and i.quantity_g>0 and i.protein is not null and i.protein>0
          then i.protein
        when i.quantity_g is not null and i.quantity_g>0 and i.protein_100g is not null and i.protein_100g>0
          then i.protein_100g*i.quantity_g/100.0
        else null
      end protein_g
    from public.food_meals m
    join public.food_meal_items i on i.meal_id=m.id
    where m.user_id=uid and m.meal_date between start_d and observed_until
  ), protein_days as (
    select
      fact_date,
      count(*)::integer total_items,
      count(protein_g)::integer protein_known_items,
      sum(protein_g)::numeric protein_documented_g
    from item_protein
    group by fact_date
  ), days as (
    select
      coalesce(f.fact_date,pd.fact_date) fact_date,
      coalesce(f.core,'{}'::jsonb) core,
      coalesce(f.numeric_signals,'{}'::jsonb) numeric_signals,
      coalesce(f.source_count,0) source_count,
      coalesce(pd.total_items,0) total_items,
      coalesce(pd.protein_known_items,0) protein_known_items,
      pd.protein_documented_g
    from facts f
    full outer join protein_days pd on pd.fact_date=f.fact_date
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date',d.fact_date,
      'core',jsonb_strip_nulls(jsonb_build_object(
        'food_kcal',public.mt_reference_num(d.core,'food_kcal'),
        'protein_g',public.mt_reference_num(d.core,'protein_g'),
        'protein_documented_g',case
          when public.mt_reference_num(d.core,'protein_g') is not null and public.mt_reference_num(d.core,'protein_g')>0
            then public.mt_reference_num(d.core,'protein_g')
          when d.protein_documented_g is not null and d.protein_documented_g>0
            then round(d.protein_documented_g,2)
          else public.mt_reference_num(d.core,'protein_g') end,
        'protein_coverage_pct',case
          when public.mt_reference_num(d.core,'protein_g') is not null and public.mt_reference_num(d.core,'protein_g')>0 then 100
          when d.total_items>0 and d.protein_known_items>0 then round(100.0*d.protein_known_items/d.total_items,1)
          else null end,
        'food_item_count',case when d.total_items>0 then d.total_items else null end,
        'protein_known_item_count',case when d.protein_known_items>0 then d.protein_known_items else null end,
        'fiber_g',public.mt_reference_num(d.core,'fiber_g'),
        'fat_g',public.mt_reference_num(d.core,'fat_g'),
        'carbs_g',public.mt_reference_num(d.core,'carbs_g'),
        'salt_g',public.mt_reference_num(d.core,'salt_g'),
        'sugars_g',public.mt_reference_num(d.core,'sugars_g'),
        'saturated_fat_g',public.mt_reference_num(d.core,'saturated_fat_g'),
        'sodium_g',public.mt_reference_num(d.core,'sodium_g'),
        'omega3_g',public.mt_reference_num(d.core,'omega3_g'),
        'omega6_g',public.mt_reference_num(d.core,'omega6_g'),
        'micronutrient_coverage_count',public.mt_reference_num(d.core,'micronutrient_coverage_count'),
        'food_energy',public.mt_reference_num(d.core,'food_energy'),
        'food_digestion',public.mt_reference_num(d.core,'food_digestion'),
        'food_satiety',public.mt_reference_num(d.core,'food_satiety'),
        'beverage_count',public.mt_reference_num(d.core,'beverage_count'),
        'beverage_hydration_liters',public.mt_reference_num(d.core,'beverage_hydration_liters'),
        'beverage_energy',public.mt_reference_num(d.core,'beverage_energy'),
        'beverage_digestion',public.mt_reference_num(d.core,'beverage_digestion'),
        'beverage_caffeine_count',public.mt_reference_num(d.core,'beverage_caffeine_count'),
        'hydration_liters',public.mt_reference_num(d.core,'hydration_liters'),
        'stress',public.mt_reference_num(d.core,'stress'),
        'mood',public.mt_reference_num(d.core,'mood'),
        'energy',public.mt_reference_num(d.core,'energy'),
        'digestion',public.mt_reference_num(d.core,'digestion'),
        'sleep_quality',public.mt_reference_num(d.core,'sleep_quality'),
        'sleep_hours',public.mt_reference_num(d.core,'sleep_hours'),
        'steps',public.mt_reference_num(d.core,'steps'),
        'active_energy_kcal',public.mt_reference_num(d.core,'active_energy_kcal'),
        'recovery',public.mt_reference_num(d.core,'recovery'),
        'weight_kg',public.mt_reference_num(d.core,'weight_kg'),
        'waist_cm',public.mt_reference_num(d.core,'waist_cm')
      )),
      'signals',(
        select coalesce(jsonb_object_agg(x.key,x.value),'{}'::jsonb)
        from (
          select e.key,e.value
          from jsonb_each(coalesce(d.numeric_signals,'{}'::jsonb)) e
          order by e.key limit 24
        ) x
      )
    ) order by d.fact_date
  ),'[]'::jsonb)
  into during_days
  from days d
  where d.source_count>0 or d.total_items>0;

  if finished and actual_end is not null and today_d>actual_end then
    after_j:=public.mt_reference_period_summary(uid,actual_end+1,least(actual_end+28,today_d));
  else
    after_j:=jsonb_build_object('documented_days',0);
  end if;

  return jsonb_build_object(
    'available',true,
    'start_date',start_d,
    'planned_end_date',planned_end,
    'actual_end_date',actual_end,
    'end_date',coalesce(actual_end,planned_end),
    'completion_status',case when finished then 'completed' else 'in_progress' end,
    'profile_reference',profile_ref,
    'before',before_j,
    'during',during_j,
    'after',after_j,
    'during_days',during_days,
    'note',case when finished
      then 'Comparaison descriptive fondée sur la fin réellement enregistrée.'
      else 'Protocole en cours : Profil, Carnet et suivis réellement renseignés restent reliés jusqu’à aujourd’hui, indépendamment du bouton de validation.' end
  );
end;
$$;

revoke all on function public.mt_protocol_reference_comparison(uuid) from public,anon;
grant execute on function public.mt_protocol_reference_comparison(uuid) to authenticated;
comment on function public.mt_protocol_reference_comparison(uuid) is 'V412.1 · Protocoles connectés : lecture jusqu’au jour courant, poids Profil en fallback et protéines documentées du Carnet sans faux zéro.';

commit;

select jsonb_pretty(jsonb_build_object(
  'status','v412_1_protocoles_connectes_backend_pret',
  'protocol_reference_ready',to_regprocedure('public.mt_protocol_reference_comparison(uuid)') is not null,
  'profile_weight_fallback_ready',true,
  'documented_protein_from_carnet_ready',true,
  'current_unvalidated_day_data_ready',true,
  'historical_meals_rewritten',false,
  'historical_protocol_validations_rewritten',false
)) as result;
