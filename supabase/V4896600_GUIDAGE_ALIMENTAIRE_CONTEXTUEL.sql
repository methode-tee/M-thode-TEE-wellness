-- MÉTHODE TEE · V4896600 · guidage alimentaire contextuel
-- Corrige les suggestions irréalistes (aromates/condiments), ajoute rôles culinaires,
-- affinité issue de la mémoire alimentaire et pénalités énergétiques pour un levier non énergétique.

begin;

create or replace function public.mt_food_guidance_portion_fallback(
  p_name text,
  p_categories text[] default '{}'
)
returns numeric
language sql immutable parallel safe
as $$
  with q as (
    select public.food_normalize(coalesce(p_name,'')) n,
           public.food_normalize(array_to_string(coalesce(p_categories,'{}'::text[]),' ')) c
  )
  select case
    when n ~ '(^| )(gousse de vanille|extrait de vanille|vanille en poudre|persil|coriandre|basilic|ciboulette|thym|romarin|menthe|aneth|epice|cannelle|curcuma|poivre)( |$)' then 3
    when n ~ '(^| )(sauce|mayonnaise|ketchup|moutarde|vinaigrette|condiment)( |$)' or c ~ '(condiment|aromatic)' then 15
    when n ~ '(^| )(huile|beurre|margarine)( |$)' then 10
    when n ~ '(^| )(poudre|proteine de|whey)( |$)' then 25
    when n ~ '(^| )(noix|amande|noisette|cajou|pistache|graine)( |$)' then 30
    when n ~ '(^| )(fromage|parmesan|emmental|comte|feta)( |$)' then 30
    when n ~ '(^| )(pain|baguette|toast|tartine)( |$)' then 60
    when n ~ '(^| )(oeuf|oeufs)( |$)' then 120
    when n ~ '(^| )(skyr|yaourt|yogourt|fromage blanc)( |$)' then 150
    when n ~ '(^| )(poulet|dinde|boeuf|veau|porc|agneau|saumon|thon|poisson|crevette|cabillaud|tofu|tempeh)( |$)' then 120
    when n ~ '(^| )(lentille|pois chiche|haricot|riz|pates|pate|semoule|quinoa|boulgour|couscous|pomme de terre)( |$)' then 180
    when n ~ '(^| )(pomme|poire|orange|banane|kiwi|mangue|ananas|fraise|framboise|myrtille|fruit)( |$)' then 150
    when n ~ '(^| )(legume|brocoli|courgette|carotte|epinard|aubergine|chou|ratatouille|salade)( |$)' then 180
    when c ~ '(composite_dish|plat|composite|meal|repas)' then 300
    else 100
  end from q
$$;

-- Rôle de guidage : empêche un aromate/condiment d'être proposé comme aliment autonome.
create or replace function public.mt_food_guidance_role_v2(
  p_name text,
  p_categories text[] default '{}',
  p_adapter_profile jsonb default '{}'::jsonb,
  p_kcal numeric default null,
  p_protein numeric default null,
  p_fat numeric default null,
  p_carbs numeric default null,
  p_fiber numeric default null
)
returns text
language plpgsql immutable parallel safe
as $role$
declare
  r text;
begin
  if lower(coalesce(p_adapter_profile->>'small_quantity','false'))='true' then return 'small_quantity'; end if;
  if coalesce(p_categories,'{}'::text[]) && array['composite_dish']::text[] then return 'meal'; end if;
  r:=public.mt_ciqual_role_v1(p_name,p_kcal,p_protein,p_fat,p_carbs,p_fiber);
  if r in ('aromatic','condiment_fat') then return 'small_quantity'; end if;
  if r='composite' then return 'meal'; end if;
  if r='beverage' then return 'beverage'; end if;
  if r='sweet' then return 'treat'; end if;
  return 'food';
end;
$role$;

-- ---------------------------------------------------------------------------
-- 5. RPC principal. La bibliothèque est classée dynamiquement selon la valeur
--    réellement documentée pour la portion proposée + mémoire + rotation.
-- ---------------------------------------------------------------------------
create or replace function public.mt_food_guidance_v1(
  p_focus text default 'protein',
  p_target_date date default current_date,
  p_meal_context text default null,
  p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $fn$
declare
  uid uuid:=auth.uid();
  v_focus text:=lower(btrim(coalesce(p_focus,'protein')));
  v_date date:=coalesce(p_target_date,current_date);
  v_limit int:=greatest(3,least(coalesce(p_limit,12),24));
  v_diet text:='';
  v_candidates jsonb:='[]'::jsonb;
  v_rhythm jsonb:='{}'::jsonb;
  v_memory jsonb:='{}'::jsonb;
  v_allowed text[]:=array[
    'protein','fiber','energy','carbs','fat',
    'iron_mg','calcium_mg','zinc_mg','iodine_ug','magnesium_mg','phosphorus_mg','potassium_mg','selenium_ug',
    'vitamin_b1_mg','vitamin_b2_mg','vitamin_b3_mg','vitamin_b6_mg','vitamin_b9_ug','vitamin_b12_ug',
    'vitamin_c_mg','vitamin_d_ug','vitamin_e_mg','omega3_g'
  ];
begin
  if uid is null then raise exception 'auth required'; end if;
  if not (v_focus=any(v_allowed)) then raise exception 'unsupported focus'; end if;

  select public.food_normalize(coalesce(settings->>'diet_pattern',''))
    into v_diet
  from public.user_tracker_preferences
  where user_id=uid and tracker_key='nutrition_vegetale'
  limit 1;
  v_diet:=coalesce(v_diet,'');

  if to_regprocedure('public.mt_planner_personal_memory_v1(integer)') is not null then
    begin v_memory:=coalesce(public.mt_planner_personal_memory_v1(60),'{}'::jsonb);
    exception when others then v_memory:='{}'::jsonb; end;
  end if;

  -- Rythme alimentaire descriptif (28 jours). Aucune heure imposée.
  with days as (
    select meal_date,
      count(*)::int meal_count,
      min((extract(hour from meal_time)::int*60)+(extract(minute from meal_time)::int)) filter(where meal_time is not null) first_minute,
      max((extract(hour from meal_time)::int*60)+(extract(minute from meal_time)::int)) filter(where meal_time is not null) last_minute
    from public.food_meals
    where user_id=uid and meal_date between v_date-27 and v_date-1
    group by meal_date
  ), today_meals as (
    select count(*)::int n,array_agg(distinct meal_type order by meal_type) types
    from public.food_meals where user_id=uid and meal_date=v_date
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'documented_days',(select count(*)::int from days),
    'expected_daily_meals',(select round(avg(meal_count))::int from days),
    'median_first_minute',(select round((percentile_cont(.5) within group(order by first_minute))::numeric)::int from days where first_minute is not null),
    'median_last_minute',(select round((percentile_cont(.5) within group(order by last_minute))::numeric)::int from days where last_minute is not null),
    'today_logged_meals',(select n from today_meals),
    'today_meal_types',coalesce((select to_jsonb(types) from today_meals),'[]'::jsonb)
  )) into v_rhythm;

  with
  hist as (
    select
      i.food_dictionary_id,
      count(*)::int use_count,
      count(*) filter(where m.meal_date>=v_date-3)::int recent_count_4d,
      count(*) filter(where m.meal_date=v_date)::int today_count,
      max(m.meal_date) last_used,
      round(avg(nullif(i.quantity_g,0))::numeric,1) avg_quantity_g
    from public.food_meals m
    join public.food_meal_items i on i.meal_id=m.id
    where m.user_id=uid
      and m.meal_date between v_date-59 and v_date
      and i.food_dictionary_id is not null
    group by i.food_dictionary_id
  ), behavior as (
    select candidate_ref,
      count(*) filter(where event_type='chosen')::int chosen_count,
      count(*) filter(where event_type='dismissed')::int dismissed_count,
      max(created_at) filter(where event_type='shown') last_shown
    from public.user_food_guidance_events
    where user_id=uid and event_date>=v_date-59 and candidate_ref is not null
    group by candidate_ref
  ), base as (
    select
      d.id dictionary_id,
      coalesce(nullif(d.display_name,''),d.canonical_name) name,
      d.normalized_name,
      d.ciqual_code,
      coalesce(d.categories,'{}'::text[]) categories,
      coalesce(d.meal_contexts,'{}'::text[]) meal_contexts,
      coalesce(d.guidance_contexts,'{}'::text[]) guidance_contexts,
      coalesce(d.guidance_profile,'{}'::jsonb) guidance_profile,
      coalesce(d.adapter_profile,'{}'::jsonb) adapter_profile,
      d.country,d.culture,d.priority,d.nutrition_verified,d.nutrition_source_label,
      coalesce(d.custom_kcal_100g,c.kcal_100g) kcal_100g,
      coalesce(d.custom_protein_100g,c.protein_100g) protein_100g,
      coalesce(d.custom_fiber_100g,c.fiber_100g) fiber_100g,
      coalesce(d.custom_carbs_100g,c.carbs_100g) carbs_100g,
      coalesce(d.custom_fat_100g,c.fat_100g) fat_100g,
      case
        when v_focus in ('protein','fiber','energy','carbs','fat') then null::numeric
        else coalesce(
          case when d.nutrition_verified then public.mt_nutrition_json_num(coalesce(d.custom_micronutrients_100g,'{}'::jsonb),v_focus) else null end,
          (select n.value_100g from public.ciqual_food_nutrients n where n.ciqual_code=d.ciqual_code and n.nutrient_key=v_focus limit 1)
        )
      end micro_100g,
      coalesce(h.use_count,0) use_count,coalesce(h.recent_count_4d,0) recent_count_4d,coalesce(h.today_count,0) today_count,h.last_used,h.avg_quantity_g,
      coalesce(b.chosen_count,0) chosen_count,coalesce(b.dismissed_count,0) dismissed_count,b.last_shown,
      concat('dictionary:',d.id::text) candidate_ref
    from public.food_dictionary d
    left join public.ciqual_foods c on c.code=d.ciqual_code
    left join hist h on h.food_dictionary_id=d.id
    left join behavior b on b.candidate_ref=concat('dictionary:',d.id::text)
    where d.enabled=true and d.guidance_enabled=true
      and lower(coalesce(d.guidance_profile->>'auto_suggest','true'))<>'false'
      and (cardinality(d.guidance_contexts)=0 or p_meal_context is null or p_meal_context=any(d.guidance_contexts))
      and d.normalized_name !~ '(^| )(bebe|infantile|premature|alcool|vodka|whisky|rhum)( |$)'
      and (
        v_diet not like 'vegane%'
        or d.normalized_name !~ '(^| )(boeuf|porc|poulet|dinde|agneau|veau|jambon|lardon|saumon|thon|poisson|crevette|cabillaud|oeuf|oeufs|fromage|lait|yaourt|yogourt|skyr|beurre|creme|miel)( |$)'
      )
      and (
        v_diet not like 'vegetar%'
        or d.normalized_name !~ '(^| )(boeuf|porc|poulet|dinde|agneau|veau|jambon|lardon|saumon|thon|poisson|crevette|cabillaud)( |$)'
      )
  ), portioned as (
    select b.*,
      greatest(3,least(600,coalesce(
        b.avg_quantity_g,
        case when pp.obj is not null
          then nullif(pp.obj->>'grams_per_unit','')::numeric * nullif(pp.obj->>'default_amount','')::numeric
          else null end,
        public.mt_food_guidance_portion_fallback(b.name,b.categories)
      )))::numeric portion_g,
      case when b.avg_quantity_g is not null then 'habitual'
           when pp.obj is not null then case when coalesce((pp.obj->>'verified')::boolean,false) then 'profile_verified' else 'profile_estimated' end
           else 'fallback' end portion_source,
      coalesce(nullif(pp.obj->>'unit',''),'portion') unit_label,
      public.mt_food_guidance_role_v2(b.name,b.categories,b.adapter_profile,b.kcal_100g,b.protein_100g,b.fat_100g,b.carbs_100g,b.fiber_100g) guidance_role,
      least(12,coalesce((select max((x->>'score')::numeric) from jsonb_array_elements(coalesce(v_memory->'dominant_countries','[]'::jsonb)) x where public.food_normalize(coalesce(b.country,''))=coalesce(x->>'country_key','')),0)*1.5)
      + least(10,coalesce((select max((x->>'score')::numeric) from jsonb_array_elements(coalesce(v_memory->'dominant_categories','[]'::jsonb)) x where coalesce(x->>'category','')=any(b.categories)),0))
      + least(8,coalesce((select sum((x->>'score')::numeric)*0.35 from jsonb_array_elements(coalesce(v_memory->'dominant_tokens','[]'::jsonb)) x where position(coalesce(x->>'token','') in b.normalized_name)>0 and length(coalesce(x->>'token',''))>=3),0)) as memory_affinity_score,
      exists(select 1 from jsonb_array_elements(coalesce(v_memory->'dominant_countries','[]'::jsonb)) x where public.food_normalize(coalesce(b.country,''))=coalesce(x->>'country_key','')) as culture_familiar
    from base b
    left join lateral (select public.mt_portion_profile(b.name,b.ciqual_code,b.dictionary_id) obj) pp on true
  ), valued as (
    select p.*,
      round(coalesce(kcal_100g,0)*portion_g/100,1) kcal_portion,
      round(coalesce(protein_100g,0)*portion_g/100,1) protein_portion,
      round(coalesce(fiber_100g,0)*portion_g/100,1) fiber_portion,
      round(coalesce(carbs_100g,0)*portion_g/100,1) carbs_portion,
      round(coalesce(fat_100g,0)*portion_g/100,1) fat_portion,
      round(coalesce(micro_100g,0)*portion_g/100,3) micro_portion
    from portioned p
  ), eligible as (
    select v.*,
      case v_focus
        when 'energy' then kcal_portion
        when 'protein' then protein_portion
        when 'fiber' then fiber_portion
        when 'carbs' then carbs_portion
        when 'fat' then fat_portion
        else micro_portion
      end focus_amount
    from valued v
    where case v_focus
      when 'energy' then kcal_100g is not null and kcal_portion>0
      when 'protein' then protein_100g is not null and protein_portion>0
      when 'fiber' then fiber_100g is not null and fiber_portion>0
      when 'carbs' then carbs_100g is not null and carbs_portion>0
      when 'fat' then fat_100g is not null and fat_portion>0
      else micro_100g is not null and micro_portion>0
    end
      and guidance_role <> 'small_quantity'
      -- Les herbes/épices restent dans la bibliothèque mais ne deviennent pas un
      -- « aliment à manger » pour corriger un micronutriment grâce à 100 g fictifs.
      and not (
        v_focus not in ('energy','protein','fiber','carbs','fat')
        and portion_g<=10
        and normalized_name ~ '(^| )(persil|coriandre|basilic|ciboulette|thym|romarin|menthe|aneth|epice|cannelle|curcuma|poivre)( |$)'
      )
  ), scored_dictionary as (
    select e.*,
      round((
        ln(1+greatest(focus_amount,0))*55
        + case when v_focus='energy' then ln(1+greatest(protein_portion,0))*7 + ln(1+greatest(fiber_portion,0))*3 else 0 end
        + coalesce(memory_affinity_score,0)
        + least(14,use_count*1.8)
        + least(8,chosen_count*2.5)
        - least(24,recent_count_4d*6)
        - least(12,today_count*10)
        - least(15,dismissed_count*4)
        - case when normalized_name ~ '(^| )(lardon|bacon|saucisse|saucisson|charcuterie|nugget|nuggets)( |$)' then 16 else 0 end
        - case when v_focus<>'energy' and kcal_portion>1200 then 52 when v_focus<>'energy' and kcal_portion>900 then 36 when v_focus<>'energy' and kcal_portion>700 then 20 else 0 end
        - case when guidance_role='meal' and use_count=0 and country is not null and not culture_familiar then 12 else 0 end
        - case when guidance_role='treat' then 14 when guidance_role='beverage' and use_count=0 then 6 else 0 end
        + case when p_meal_context is not null and p_meal_context=any(meal_contexts) then 6 else 0 end
        + case when nutrition_verified then 3 else 0 end
        + greatest(-6,least(5,(100-coalesce(priority,100))/20.0))
      )::numeric,2) score
    from eligible e
  ), scanned_rows as (
    select m.meal_date,m.meal_type,i.*,
      nullif(i.nutrition_extra_100g->>'_barcode','') barcode,
      public.food_normalize(i.food_name) normalized_food_name
    from public.food_meals m
    join public.food_meal_items i on i.meal_id=m.id
    where m.user_id=uid and m.meal_date between v_date-59 and v_date
      and i.food_dictionary_id is null
      and nullif(i.nutrition_extra_100g->>'_barcode','') is not null
  ), scanned_agg as (
    select barcode,normalized_food_name,
      max(food_name) food_name,
      count(*)::int use_count,
      count(*) filter(where meal_date>=v_date-3)::int recent_count_4d,
      count(*) filter(where meal_date=v_date)::int today_count,
      max(meal_date) last_used,
      round(avg(nullif(quantity_g,0))::numeric,1) avg_quantity_g
    from scanned_rows group by barcode,normalized_food_name
  ), scanned_latest as (
    select distinct on (barcode,normalized_food_name)
      barcode,normalized_food_name,food_name,kcal_100g,protein_100g,fiber_100g,carbs_100g,fat_100g,micronutrients_100g,nutrition_extra_100g
    from scanned_rows
    order by barcode,normalized_food_name,meal_date desc,id desc
  ), scanned_scored as (
    select
      null::uuid dictionary_id,
      coalesce(nullif(a.food_name,''),l.food_name) name,
      null::text ciqual_code,
      '{}'::text[] categories,
      '{}'::text[] meal_contexts,
      null::text country,null::text culture,
      a.use_count,a.recent_count_4d,a.today_count,a.last_used,
      greatest(10,least(500,coalesce(a.avg_quantity_g,100)))::numeric portion_g,
      'habitual'::text portion_source,
      'portion habituelle'::text unit_label,
      round(coalesce(l.kcal_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100,1) kcal_portion,
      round(coalesce(l.protein_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100,1) protein_portion,
      round(coalesce(l.fiber_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100,1) fiber_portion,
      round(coalesce(l.carbs_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100,1) carbs_portion,
      round(coalesce(l.fat_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100,1) fat_portion,
      round(coalesce(public.mt_nutrition_json_num(coalesce(l.micronutrients_100g,'{}'::jsonb),v_focus),0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100,3) micro_portion,
      concat('barcode:',a.barcode) candidate_ref,
      a.barcode,
      public.mt_food_guidance_role_v2(coalesce(nullif(a.food_name,''),l.food_name),'{}'::text[],'{}'::jsonb,l.kcal_100g,l.protein_100g,l.fat_100g,l.carbs_100g,l.fiber_100g) guidance_role,
      12::numeric memory_affinity_score,
      true culture_familiar,
      case v_focus
        when 'energy' then coalesce(l.kcal_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100
        when 'protein' then coalesce(l.protein_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100
        when 'fiber' then coalesce(l.fiber_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100
        when 'carbs' then coalesce(l.carbs_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100
        when 'fat' then coalesce(l.fat_100g,0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100
        else coalesce(public.mt_nutrition_json_num(coalesce(l.micronutrients_100g,'{}'::jsonb),v_focus),0)*greatest(10,least(500,coalesce(a.avg_quantity_g,100)))/100
      end focus_amount
    from scanned_agg a join scanned_latest l using(barcode,normalized_food_name)
  ), all_candidates as (
    select
      'library'::text source_kind,dictionary_id,name,ciqual_code,meal_contexts,use_count,recent_count_4d,today_count,last_used,
      portion_g,portion_source,unit_label,kcal_portion,protein_portion,fiber_portion,carbs_portion,fat_portion,micro_portion,focus_amount,candidate_ref,null::text barcode,
      guidance_role,memory_affinity_score,culture_familiar,categories,country,culture,score
    from scored_dictionary
    union all
    select
      'scanned'::text,null::uuid,name,null::text,'{}'::text[],use_count,recent_count_4d,today_count,last_used,
      portion_g,portion_source,unit_label,kcal_portion,protein_portion,fiber_portion,carbs_portion,fat_portion,micro_portion,focus_amount,candidate_ref,barcode,
      guidance_role,memory_affinity_score,culture_familiar,'{}'::text[] categories,null::text country,null::text culture,
      round((ln(1+greatest(focus_amount,0))*55 + least(18,use_count*2.2) - least(24,recent_count_4d*6) - least(12,today_count*10)
        - case when v_focus<>'energy' and kcal_portion>1200 then 52 when v_focus<>'energy' and kcal_portion>900 then 36 when v_focus<>'energy' and kcal_portion>700 then 20 else 0 end)::numeric,2) score
    from scanned_scored
    where focus_amount>0 and guidance_role<>'small_quantity'
  ), dedup as (
    select a.*,
      row_number() over(partition by public.food_normalize(name) order by (source_kind='scanned') desc,use_count desc,score desc) dup_rank
    from all_candidates a
  ), ranked as (
    select d.*,
      row_number() over(order by score desc,focus_amount desc,use_count desc,public.food_normalize(name)) rn
    from dedup d where dup_rank=1
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'candidate_ref',candidate_ref,
    'source_kind',source_kind,
    'dictionary_id',dictionary_id,
    'barcode',barcode,
    'ciqual_code',ciqual_code,
    'name',name,
    'portion_g',round(portion_g,0),
    'portion_source',portion_source,
    'unit_label',unit_label,
    'kcal',kcal_portion,
    'protein_g',protein_portion,
    'fiber_g',fiber_portion,
    'carbs_g',carbs_portion,
    'fat_g',fat_portion,
    'focus_amount',round(focus_amount,3),
    'focus_unit',public.mt_food_guidance_focus_unit(v_focus),
    'familiar',use_count>=2,
    'use_count_60d',use_count,
    'recent_count_4d',recent_count_4d,
    'last_used',last_used,
    'rotation_due',recent_count_4d>=3 or today_count>=1,
    'meal_context_fit',p_meal_context is null or cardinality(meal_contexts)=0 or p_meal_context=any(meal_contexts),
    'guidance_role',guidance_role,
    'suggestion_mode',case when guidance_role='meal' then 'meal' when guidance_role='beverage' then 'drink' else 'food' end,
    'memory_affinity_score',round(coalesce(memory_affinity_score,0),2),
    'culture_familiar',coalesce(culture_familiar,false),
    'categories',to_jsonb(coalesce(categories,'{}'::text[])),
    'country',country,
    'culture',culture,
    'score',score
  )) order by rn),'[]'::jsonb)
  into v_candidates
  from ranked where rn<=v_limit;

  return jsonb_build_object(
    'version','V4896600_CONTEXTUAL_FOOD_GUIDANCE',
    'focus',v_focus,
    'focus_unit',public.mt_food_guidance_focus_unit(v_focus),
    'target_date',v_date,
    'meal_context',p_meal_context,
    'diet_pattern',nullif(v_diet,''),
    'rhythm',coalesce(v_rhythm,'{}'::jsonb),
    'candidates',coalesce(v_candidates,'[]'::jsonb),
    'memory',jsonb_build_object(
      'active',coalesce((v_memory->>'active')::boolean,false),
      'strong',coalesce((v_memory->>'strong')::boolean,false),
      'days_with_meals',coalesce((v_memory->>'days_with_meals')::int,0)
    ),
    'rules',jsonb_build_object(
      'dynamic_nutrient_ranking',true,
      'realistic_portion_first',true,
      'familiarity_bonus',true,
      'recent_rotation_penalty',true,
      'scanned_products_from_saved_snapshots',true,
      'admin_veto_available',true,
      'missing_micro_is_not_zero',true,
      'no_deficiency_diagnosis',true,
      'culinary_role_filter',true,
      'memory_affinity_ranking',true,
      'cultural_affinity_without_identity_inference',true,
      'high_energy_penalty_for_non_energy_focus',true,
      'no_external_ai',true,
      'no_internet_lookup',true
    )
  );
end;
$fn$;

revoke all on function public.mt_food_guidance_v1(text,date,text,integer) from public,anon;
grant execute on function public.mt_food_guidance_v1(text,date,text,integer) to authenticated;

commit;

select jsonb_build_object(
  'status','V4896600_GUIDAGE_CONTEXTUEL_PRET',
  'guidance_rpc',to_regprocedure('public.mt_food_guidance_v1(text,date,text,integer)') is not null,
  'role_v2',to_regprocedure('public.mt_food_guidance_role_v2(text,text[],jsonb,numeric,numeric,numeric,numeric,numeric)') is not null,
  'portion_fallback',to_regprocedure('public.mt_food_guidance_portion_fallback(text,text[])') is not null,
  'no_schema_change',true,
  'payments_changed',false,
  'unlock_changed',false
) as v4896600_result;
