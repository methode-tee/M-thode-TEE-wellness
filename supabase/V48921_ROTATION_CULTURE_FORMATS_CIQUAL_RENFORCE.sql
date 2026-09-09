-- ============================================================================
-- MÉTHODE TEE — V489.2.1
-- ROTATION IMMÉDIATE · CULTURE DURE · FORMATS/PRIX SÉPARÉS · CIQUAL RENFORCÉ
-- Additif et idempotent. Aucun contenu métier existant n'est réécrit.
-- ============================================================================

begin;

do $preflight$
begin
  if to_regprocedure('public.mt_tee_global_memory_v1(date,integer,boolean)') is null
     or to_regprocedure('public.mt_planner_candidate_meta_v1()') is null
     or to_regprocedure('public.mt_recipe_cost_batch_v1(uuid[],numeric,text,text)') is null
     or to_regprocedure('public.mt_planner_ciqual_universe_v1()') is null
     or to_regprocedure('public.mt_planner_ciqual_price_batch_v1(text[],text,text)') is null
     or to_regclass('public.mt_planner_recommendation_history') is null
     or to_regclass('public.mt_food_purchase_format_reference') is null
     or to_regclass('public.mt_food_price_reference') is null then
    raise exception 'V489.2.1 : prérequis V488.8.3.1 / V489.0 / V489.1 manquants';
  end if;
end
$preflight$;

-- 1. Métadonnées culturelles des recettes : une recette portant exactement le
-- nom d'une entrée du dictionnaire récupère son pays et sa hiérarchie. Aucun
-- rapprochement flou n'est autorisé.
create or replace function public.mt_planner_candidate_meta_v2()
returns table(
  recipe_id uuid,
  source_kind text,
  food_dictionary_id uuid,
  country text,
  culture text,
  categories text[],
  discovery_level integer,
  normalized_title text
)
language sql
stable
security definer
set search_path=public
as $fn$
with recipe_meta as (
  select
    r.id recipe_id,
    case when lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))='true'
         then 'cultural_recipe' else 'recipe' end source_kind,
    d.id food_dictionary_id,
    d.country,
    d.culture,
    coalesce(d.categories,'{}'::text[]) categories,
    case
      when coalesce(d.adapter_profile->>'planner_discovery_level','') ~ '^[0-2]$'
        then (d.adapter_profile->>'planner_discovery_level')::integer
      when lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))='true' then 1
      else 0
    end discovery_level,
    public.food_normalize(r.title) normalized_title
  from public.recipes r
  left join public.mt_recipe_planner_profiles pp on pp.recipe_id=r.id
  left join lateral (
    select fd.*
    from public.food_dictionary fd
    where fd.enabled=true and (
      fd.normalized_name=public.food_normalize(r.title)
      or public.food_normalize(fd.display_name)=public.food_normalize(r.title)
      or exists(
        select 1 from unnest(coalesce(fd.aliases,'{}'::text[])) a
        where public.food_normalize(a)=public.food_normalize(r.title)
      )
    )
    order by
      case when fd.normalized_name=public.food_normalize(r.title) then 0 else 1 end,
      fd.priority asc,fd.updated_at desc
    limit 1
  ) d on true
  where r.active=true
    and coalesce(pp.planner_eligible,true)
    and lower(btrim(coalesce(r.meal_type,''))) in ('breakfast','bowl','daily','dinner','lunch','meal')
    and public.food_normalize(coalesce(r.category,'')) not in ('apero','aperitif')
), external_meta as (
  select
    m.planner_id recipe_id,
    case when lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))='true'
         then 'cultural' else 'external' end source_kind,
    d.id food_dictionary_id,d.country,d.culture,coalesce(d.categories,'{}'::text[]),
    case
      when coalesce(d.adapter_profile->>'planner_discovery_level','') ~ '^[0-2]$'
        then (d.adapter_profile->>'planner_discovery_level')::integer
      when lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))='true' then 1
      else 0
    end discovery_level,
    d.normalized_name normalized_title
  from public.mt_planner_food_items m
  join public.food_dictionary d on d.id=m.food_dictionary_id
  where m.enabled=true
)
select * from recipe_meta
union all
select * from external_meta;
$fn$;

revoke all on function public.mt_planner_candidate_meta_v2() from public,anon;
grant execute on function public.mt_planner_candidate_meta_v2() to authenticated;

-- 2. Contexte personnel du planificateur. Il réutilise le cerveau existant :
-- aucune seconde mémoire et aucune donnée entre utilisateurs.
create or replace function public.mt_planner_personal_context_v2(
  p_target_date date default current_date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=public
as $fn$
declare
  b jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  b:=coalesce(public.mt_tee_global_memory_v1(p_target_date,60,false),'{}'::jsonb);
  return jsonb_build_object(
    'version','V4892_PLANNER_CONTEXT_V2',
    'user_scope','auth.uid only',
    'stage',coalesce(b->>'stage','starting'),
    'confidence',coalesce((b->>'confidence')::integer,0),
    'profile',coalesce(b->'profile','{}'::jsonb),
    'food_memory',coalesce(b->'food_memory','{}'::jsonb),
    'reference_summary',coalesce(b#>'{reference_context,summary28}','{}'::jsonb),
    'today',coalesce(b#>'{reference_context,today}','{}'::jsonb),
    'holistic',coalesce(b->'holistic_context','{}'::jsonb),
    'modules',coalesce(b->'modules','{}'::jsonb),
    'learned_model_count',(select count(*) from jsonb_object_keys(coalesce(b->'learned_models','{}'::jsonb))),
    'planner_preferences',coalesce(b->'planner_preferences','{}'::jsonb),
    'rules',coalesce(b->'rules','{}'::jsonb) || jsonb_build_object(
      'health_context_does_not_invent_food_preferences',true,
      'bmi_does_not_select_a_dish_by_itself',true,
      'explicit_food_logs_drive_food_affinity',true
    )
  );
end;
$fn$;

revoke all on function public.mt_planner_personal_context_v2(date) from public,anon;
grant execute on function public.mt_planner_personal_context_v2(date) to authenticated;

-- 3. Bornes anti-abus sur les fonctions appelables depuis le client.
create or replace function public.mt_recipe_cost_batch_v2(
  p_recipe_ids uuid[],
  p_servings numeric default 1,
  p_country text default 'FR',
  p_region text default null
)
returns table(recipe_id uuid,cost jsonb)
language plpgsql
stable
security definer
set search_path=public
as $fn$
declare
  v_i integer:=1;
  v_n integer:=coalesce(array_length(p_recipe_ids,1),0);
  v_chunk uuid[];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_n>500 then raise exception 'TOO_MANY_RECIPE_IDS'; end if;
  if coalesce(p_servings,1)<=0 or coalesce(p_servings,1)>8 then raise exception 'INVALID_SERVINGS'; end if;
  while v_i<=v_n loop
    v_chunk:=p_recipe_ids[v_i:least(v_i+59,v_n)];
    return query select b.recipe_id,b.cost
      from public.mt_recipe_cost_batch_v1(v_chunk,p_servings,p_country,p_region) b;
    v_i:=v_i+60;
  end loop;
end;
$fn$;

revoke all on function public.mt_recipe_cost_batch_v2(uuid[],numeric,text,text) from public,anon;
grant execute on function public.mt_recipe_cost_batch_v2(uuid[],numeric,text,text) to authenticated;

create or replace function public.mt_planner_record_generation_v1(
  p_budget_eur numeric,
  p_budget_mode text,
  p_generation_score numeric,
  p_estimated_cost_eur numeric,
  p_items jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path=public
as $fn$
declare
  v_uid uuid:=auth.uid();
  v_gen uuid:=gen_random_uuid();
  v_week date:=date_trunc('week',current_date)::date;
  r record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(p_budget_mode,'balanced') not in ('save','balanced','variety') then raise exception 'INVALID_BUDGET_MODE'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'INVALID_ITEMS'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))>7 then raise exception 'TOO_MANY_ITEMS'; end if;
  if p_budget_eur is not null and (p_budget_eur<0 or p_budget_eur>10000) then raise exception 'INVALID_BUDGET'; end if;

  for r in
    select * from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(
      day_index integer,candidate_id uuid,candidate_title text,is_leftover boolean
    )
  loop
    if r.day_index between 0 and 6 then
      insert into public.mt_planner_recommendation_history(
        generation_id,user_id,week_key,budget_eur,budget_mode,candidate_id,candidate_title,
        day_index,is_leftover,generation_score,estimated_cost_eur
      ) values (
        v_gen,v_uid,v_week,p_budget_eur,coalesce(p_budget_mode,'balanced'),r.candidate_id,
        left(coalesce(r.candidate_title,''),180),r.day_index,coalesce(r.is_leftover,false),
        p_generation_score,p_estimated_cost_eur
      );
    end if;
  end loop;
  delete from public.mt_planner_recommendation_history
    where user_id=v_uid and created_at<now()-interval '180 days';
  return v_gen;
end;
$fn$;

revoke all on function public.mt_planner_record_generation_v1(numeric,text,numeric,numeric,jsonb) from public,anon;
grant execute on function public.mt_planner_record_generation_v1(numeric,text,numeric,numeric,jsonb) to authenticated;

-- 4. Formats magasin et prix : deux fraîcheurs distinctes.
--    * le format/poids peut rester exploitable 365 jours ;
--    * un prix n'est jamais utilisé au-delà de 120 jours.
-- Un format ancien mais encore documenté peut donc rester visible, tandis que
-- le prix retombe sur une référence fraîche exacte ou sur le coût consommé.
alter table public.mt_food_purchase_format_reference
  add column if not exists ciqual_code text,
  add column if not exists format_observed_on date,
  add column if not exists price_observed_on date;

update public.mt_food_purchase_format_reference
set format_observed_on=coalesce(format_observed_on,observed_on),
    price_observed_on=coalesce(price_observed_on,observed_on)
where format_observed_on is null or price_observed_on is null;

create index if not exists mt_purchase_format_ciqual_idx
  on public.mt_food_purchase_format_reference(ciqual_code,country_code,format_observed_on desc)
  where enabled and verified;

update public.mt_food_purchase_format_reference pf
set ciqual_code=p.ciqual_code,
    food_dictionary_id=coalesce(pf.food_dictionary_id,p.food_dictionary_id),
    match_term=coalesce(nullif(pf.match_term,''),p.match_term),
    format_observed_on=coalesce(pf.format_observed_on,p.observed_on),
    price_observed_on=coalesce(pf.price_observed_on,p.observed_on),
    updated_at=now()
from public.mt_food_price_reference p
where p.id=pf.source_reference_id
  and (pf.ciqual_code is distinct from p.ciqual_code
       or (pf.food_dictionary_id is null and p.food_dictionary_id is not null)
       or nullif(pf.match_term,'') is null
       or pf.format_observed_on is null
       or pf.price_observed_on is null);

insert into public.mt_food_purchase_format_reference(
  food_dictionary_id,ciqual_code,match_term,package_label,package_weight_g,package_price_eur,
  source_reference_id,country_code,observed_on,format_observed_on,price_observed_on,
  verified,enabled,note,updated_at
)
select p.food_dictionary_id,p.ciqual_code,p.match_term,p.source_item_label,p.unit_weight_g,
  coalesce(p.unit_price_eur,p.price_eur),p.id,p.country_code,p.observed_on,p.observed_on,p.observed_on,
  p.verified,true,'V48921_EXACT_PACKAGE_IDENTITY_BRIDGE',now()
from public.mt_food_price_reference p
where p.price_basis='package' and p.unit_weight_g>0
  and coalesce(p.unit_price_eur,p.price_eur)>0 and p.verified=true
on conflict(source_reference_id) do update set
  food_dictionary_id=excluded.food_dictionary_id,
  ciqual_code=excluded.ciqual_code,
  match_term=excluded.match_term,
  package_label=excluded.package_label,
  package_weight_g=excluded.package_weight_g,
  package_price_eur=excluded.package_price_eur,
  observed_on=excluded.observed_on,
  format_observed_on=excluded.format_observed_on,
  price_observed_on=excluded.price_observed_on,
  verified=true,enabled=true,updated_at=now();

create or replace function public.mt_planner_purchase_quote_v2(
  p_items jsonb,
  p_country text default 'FR'
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $fn$
declare
  r record; f public.mt_food_purchase_format_reference%rowtype; fp public.mt_food_price_reference%rowtype;
  v_items jsonb:='[]'::jsonb;
  v_estimated numeric:=0; v_package_total numeric:=0;
  v_known integer:=0; v_format_known integer:=0; v_fresh_package_known integer:=0;
  v_total integer:=0; v_unknown integer:=0;
  v_packages integer; v_cost numeric; v_norm text; v_package_price numeric;
  v_price_mode text; v_price_observed date;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'INVALID_ITEMS'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))>200 then raise exception 'TOO_MANY_ITEMS'; end if;

  for r in
    select * from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(
      food_dictionary_id uuid,ciqual_code text,candidate_id uuid,
      ingredient_name text,quantity_g numeric,consumed_cost_eur numeric
    )
  loop
    v_total:=v_total+1;
    v_norm:=public.food_normalize(r.ingredient_name);
    f:=null; fp:=null; v_package_price:=null; v_price_mode:=null; v_price_observed:=null;

    select pf.* into f
    from public.mt_food_purchase_format_reference pf
    left join public.food_dictionary fd on fd.id=pf.food_dictionary_id
    where pf.enabled=true and pf.verified=true
      and pf.country_code=upper(coalesce(nullif(trim(p_country),''),'FR'))
      and (current_date-coalesce(pf.format_observed_on,pf.observed_on))<=365
      and (
        (r.food_dictionary_id is not null and pf.food_dictionary_id=r.food_dictionary_id)
        or (nullif(btrim(r.ciqual_code),'') is not null and pf.ciqual_code=r.ciqual_code)
        or (nullif(v_norm,'') is not null and public.food_normalize(pf.match_term)=v_norm)
        or (nullif(v_norm,'') is not null and fd.normalized_name=v_norm)
        or (nullif(v_norm,'') is not null and public.food_normalize(fd.display_name)=v_norm)
        or (nullif(v_norm,'') is not null and exists(
          select 1 from unnest(coalesce(fd.aliases,'{}'::text[])) a
          where public.food_normalize(a)=v_norm
        ))
      )
    order by
      case
        when r.food_dictionary_id is not null and pf.food_dictionary_id=r.food_dictionary_id then 0
        when nullif(btrim(r.ciqual_code),'') is not null and pf.ciqual_code=r.ciqual_code then 1
        else 2
      end,
      coalesce(pf.format_observed_on,pf.observed_on) desc,pf.updated_at desc
    limit 1;

    if f.id is not null then
      v_format_known:=v_format_known+1;

      -- Prix du format lui-même : utilisable seulement s'il a <=120 jours.
      if coalesce(f.package_price_eur,0)>0
         and (current_date-coalesce(f.price_observed_on,f.observed_on))<=120 then
        v_package_price:=f.package_price_eur;
        v_price_mode:='exact_package_fresh';
        v_price_observed:=coalesce(f.price_observed_on,f.observed_on);
      else
        -- Sinon, recherche d'une référence de prix fraîche avec identité exacte.
        -- On préfère un paquet de poids équivalent, puis un prix/kg exact.
        select p.* into fp
        from public.mt_food_price_reference p
        where p.verified=true
          and p.country_code=upper(coalesce(nullif(trim(p_country),''),'FR'))
          and (current_date-p.observed_on)<=120
          and (
            (r.food_dictionary_id is not null and p.food_dictionary_id=r.food_dictionary_id)
            or (nullif(btrim(r.ciqual_code),'') is not null and p.ciqual_code=r.ciqual_code)
            or (nullif(v_norm,'') is not null and public.food_normalize(p.match_term)=v_norm)
          )
          and (
            (p.price_basis='package' and p.unit_weight_g is not null and
             abs(p.unit_weight_g-f.package_weight_g)<=greatest(5,f.package_weight_g*0.05))
            or coalesce(p.eur_per_kg,0)>0
            or p.price_basis='100g'
          )
        order by
          case
            when p.price_basis='package' and p.unit_weight_g is not null and
                 abs(p.unit_weight_g-f.package_weight_g)<=greatest(5,f.package_weight_g*0.05) then 0
            when coalesce(p.eur_per_kg,0)>0 then 1
            when p.price_basis='100g' then 2
            else 9
          end,
          p.observed_on desc,p.updated_at desc
        limit 1;

        if fp.id is not null then
          if fp.price_basis='package' and fp.unit_weight_g is not null
             and abs(fp.unit_weight_g-f.package_weight_g)<=greatest(5,f.package_weight_g*0.05) then
            v_package_price:=coalesce(fp.unit_price_eur,fp.price_eur);
            v_price_mode:='exact_package_refreshed';
          elsif coalesce(fp.eur_per_kg,0)>0 then
            v_package_price:=fp.eur_per_kg*f.package_weight_g/1000;
            v_price_mode:='format_plus_fresh_kg_price';
          elsif fp.price_basis='100g' then
            v_package_price:=fp.price_eur*f.package_weight_g/100;
            v_price_mode:='format_plus_fresh_100g_price';
          end if;
          v_price_observed:=fp.observed_on;
        end if;
      end if;
    end if;

    if f.id is not null and coalesce(f.package_weight_g,0)>0 and v_package_price is not null and coalesce(r.quantity_g,0)>0 then
      v_packages:=ceil(r.quantity_g/f.package_weight_g)::integer;
      v_cost:=round(v_packages*v_package_price,2);
      v_estimated:=v_estimated+v_cost; v_package_total:=v_package_total+v_cost;
      v_known:=v_known+1; v_fresh_package_known:=v_fresh_package_known+1;
      v_items:=v_items||jsonb_build_array(jsonb_build_object(
        'ingredient_name',r.ingredient_name,'dictionary_id',r.food_dictionary_id,
        'ciqual_code',r.ciqual_code,'pricing_mode',v_price_mode,
        'package_label',f.package_label,'package_weight_g',f.package_weight_g,
        'package_price_eur',round(v_package_price,2),'packages',v_packages,
        'estimated_purchase_eur',v_cost,
        'format_observed_on',coalesce(f.format_observed_on,f.observed_on),
        'price_observed_on',v_price_observed,
        'format_max_age_days',365,'price_max_age_days',120
      ));
    elsif r.consumed_cost_eur is not null then
      v_estimated:=v_estimated+r.consumed_cost_eur; v_known:=v_known+1;
      v_items:=v_items||jsonb_build_array(jsonb_build_object(
        'ingredient_name',r.ingredient_name,'dictionary_id',r.food_dictionary_id,
        'ciqual_code',r.ciqual_code,
        'pricing_mode',case when f.id is not null then 'format_known_price_fallback_consumed' else 'consumed_quantity_fallback' end,
        'package_label',case when f.id is not null then f.package_label else null end,
        'package_weight_g',case when f.id is not null then f.package_weight_g else null end,
        'format_observed_on',case when f.id is not null then coalesce(f.format_observed_on,f.observed_on) else null end,
        'estimated_purchase_eur',r.consumed_cost_eur,
        'stale_package_price_not_used',case when f.id is not null then true else false end
      ));
    else
      v_unknown:=v_unknown+1;
      v_items:=v_items||jsonb_build_array(jsonb_build_object(
        'ingredient_name',r.ingredient_name,'dictionary_id',r.food_dictionary_id,
        'ciqual_code',r.ciqual_code,'pricing_mode','unknown',
        'package_label',case when f.id is not null then f.package_label else null end,
        'package_weight_g',case when f.id is not null then f.package_weight_g else null end
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'status','v48921_purchase_quote',
    'estimated_total_eur',round(v_estimated,2),
    'strict_package_total_eur',round(v_package_total,2),
    'total_items',v_total,'known_items',v_known,'unknown_items',v_unknown,
    'known_coverage_pct',case when v_total=0 then 100 else round(v_known::numeric/v_total*100)::int end,
    -- Compatibilité frontend : package_coverage_pct signifie désormais
    -- « format magasin documenté », indépendamment de la fraîcheur du prix.
    'package_coverage_pct',case when v_total=0 then 100 else round(v_format_known::numeric/v_total*100)::int end,
    'format_coverage_pct',case when v_total=0 then 100 else round(v_format_known::numeric/v_total*100)::int end,
    'fresh_package_price_coverage_pct',case when v_total=0 then 100 else round(v_fresh_package_known::numeric/v_total*100)::int end,
    'format_max_age_days',365,'price_max_age_days',120,
    'items',v_items,'unknown_is_zero',false,'stale_package_price_used',false
  );
end;
$fn$;

revoke all on function public.mt_planner_purchase_quote_v2(jsonb,text) from public,anon;
grant execute on function public.mt_planner_purchase_quote_v2(jsonb,text) to authenticated;

commit;

select jsonb_build_object(
  'status','v48921_rotation_culture_formats_ciqual_renforce_pret',
  'checks',jsonb_build_object(
    'candidate_meta_v2',to_regprocedure('public.mt_planner_candidate_meta_v2()') is not null,
    'ciqual_universe_v1',to_regprocedure('public.mt_planner_ciqual_universe_v1()') is not null,
    'ciqual_price_batch_v1',to_regprocedure('public.mt_planner_ciqual_price_batch_v1(text[],text,text)') is not null,
    'personal_context_v2',to_regprocedure('public.mt_planner_personal_context_v2(date)') is not null,
    'purchase_quote_v2',to_regprocedure('public.mt_planner_purchase_quote_v2(jsonb,text)') is not null,
    'exact_purchase_formats',(select count(*) from public.mt_food_purchase_format_reference where enabled and verified),
    'specific_cultural_candidates',(select count(*) from public.mt_planner_candidate_meta_v2() where discovery_level=2)
  ),
  'guards',jsonb_build_object(
    'max_specific_cultural_per_week_frontend',1,
    'minimum_ciqual_assemblies_when_feasible',2,
    'ciqual_assembly_quality_threshold',0.72,
    'format_max_age_days',365,'price_max_age_days',120,
    'generation_items_limit',7,'purchase_items_limit',200,'recipe_batch_limit',500,
    'cross_user_memory',false,'external_ai',false,'stale_package_price_allowed',false
  ),
  'unchanged',jsonb_build_object(
    'recipes',true,'ciqual_rows',true,'food_meals',true,'protocols',true,
    'payments',true,'voice',true,'phyto_safety',true,'historical_recommendations',true
  )
) as v48921_result;
