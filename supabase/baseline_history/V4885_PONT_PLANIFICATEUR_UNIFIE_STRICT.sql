-- ============================================================================
-- MÉTHODE TEE — V488.5
-- PONT PLANIFICATEUR UNIFIÉ STRICT
--
-- Objectif : préparer le planificateur à recevoir, sans nouvelle version iOS,
-- des plats structurés issus de food_dictionary / CIQUAL lorsque ET SEULEMENT
-- lorsque 4 conditions sont réunies :
--   1) plat explicitement complet pour le planificateur ;
--   2) nutrition exploitable ;
--   3) portion exploitable ;
--   4) prix du PLAT ENTIER exact, récent et vérifié.
--
-- IMPORTANT :
-- - V488.4.1 a confirmé 0 candidat externe strictement prêt aujourd'hui.
-- - V488.5 ne force donc AUCUN nouveau plat dans la semaine.
-- - Les 19 recettes déjà éligibles restent le catalogue actif tant qu'aucun
--   nouvel élément n'atteint les critères stricts.
-- - Aucun prix d'ingrédient trouvé par sous-chaîne n'est accepté comme prix du
--   plat entier.
-- - Aucun composant culturel seul (foufou, attiéké, banku, etc.) n'est admis
--   comme repas autonome. Les futurs couples plat + accompagnement seront
--   traités par une couche dédiée, pas par une fausse complétude.
--
-- Ce patch :
-- - crée une petite table de correspondance stable planner_id -> food_dictionary;
-- - crée un résolveur de prix strict du plat entier ;
-- - crée une fonction de qualification stricte ;
-- - étend mt_planner_recipe_catalog() SANS changer sa signature ;
-- - étend mt_recipe_cost_batch_v1() SANS changer sa signature ;
-- - ne modifie ni recipes, ni CIQUAL, ni food_dictionary, ni prix, ni portions.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. PRÉ-VÉRIFICATIONS
-- ---------------------------------------------------------------------------
do $preflight$
begin
  if to_regclass('public.recipes') is null then
    raise exception 'V488.5 : table recipes introuvable';
  end if;
  if to_regclass('public.food_dictionary') is null then
    raise exception 'V488.5 : table food_dictionary introuvable';
  end if;
  if to_regclass('public.ciqual_foods') is null then
    raise exception 'V488.5 : table ciqual_foods introuvable';
  end if;
  if to_regclass('public.food_portion_profiles') is null then
    raise exception 'V488.5 : table food_portion_profiles introuvable';
  end if;
  if to_regclass('public.mt_food_price_reference') is null then
    raise exception 'V488.5 : table mt_food_price_reference introuvable';
  end if;
  if to_regclass('public.mt_price_sources') is null then
    raise exception 'V488.5 : table mt_price_sources introuvable';
  end if;
  if to_regprocedure('public.mt_recipe_cost_estimate_v2(uuid,numeric,text,text)') is null then
    raise exception 'V488.5 : mt_recipe_cost_estimate_v2 introuvable';
  end if;
  if to_regprocedure('public.food_normalize(text)') is null then
    raise exception 'V488.5 : food_normalize introuvable';
  end if;

  -- Colonnes nutritionnelles modernes attendues sur food_dictionary.
  if exists (
    select 1
    from (values
      ('custom_kcal_100g'),
      ('custom_protein_100g'),
      ('custom_fat_100g'),
      ('custom_carbs_100g'),
      ('nutrition_verified')
    ) required(column_name)
    where not exists (
      select 1
      from information_schema.columns c
      where c.table_schema='public'
        and c.table_name='food_dictionary'
        and c.column_name=required.column_name
    )
  ) then
    raise exception 'V488.5 : colonnes nutritionnelles food_dictionary incomplètes';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. IDENTITÉ STABLE DES FUTURS PLATS EXTERNES
-- ---------------------------------------------------------------------------
create table if not exists public.mt_planner_food_items(
  planner_id uuid primary key default gen_random_uuid(),
  food_dictionary_id uuid not null unique
    references public.food_dictionary(id) on delete cascade,
  enabled boolean not null default true,
  source_version text not null default 'V4885_UNIFIED_STRICT_V1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mt_planner_food_items_enabled_idx
  on public.mt_planner_food_items(enabled,food_dictionary_id);

alter table public.mt_planner_food_items enable row level security;

drop policy if exists "planner food items admin" on public.mt_planner_food_items;
create policy "planner food items admin"
  on public.mt_planner_food_items
  for all to authenticated
  using(public.is_admin()) with check(public.is_admin());

revoke all on public.mt_planner_food_items from public,anon;
grant select,insert,update,delete on public.mt_planner_food_items to authenticated;

-- ---------------------------------------------------------------------------
-- 2. PRIX STRICT DU PLAT ENTIER
--    Aucun fallback legacy, aucune sous-chaîne.
-- ---------------------------------------------------------------------------
create or replace function public.mt_food_price_resolve_whole_dish_v1(
  p_dictionary_id uuid,
  p_ciqual_code text default null,
  p_term text default null,
  p_country text default 'FR',
  p_region text default null
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $fn$
  select jsonb_strip_nulls(jsonb_build_object(
    'reference_id',p.id,
    'source_code',p.source_code,
    'source_label',s.label,
    'source_item_label',p.source_item_label,
    'country_code',p.country_code,
    'region_code',p.region_code,
    'observed_on',p.observed_on,
    'age_days',(current_date-p.observed_on),
    'stale',(current_date-p.observed_on)>120,
    'confidence',p.confidence,
    'verified',p.verified,
    'price_eur',p.price_eur,
    'price_basis',p.price_basis,
    'eur_per_kg',p.eur_per_kg,
    'eur_per_l',p.eur_per_l,
    'unit_price_eur',p.unit_price_eur,
    'unit_weight_g',p.unit_weight_g,
    'density_g_ml',p.density_g_ml,
    'match_term',p.match_term,
    'strict_match_mode',case
      when p_dictionary_id is not null and p.food_dictionary_id=p_dictionary_id
        then 'dictionary_id'
      when p_ciqual_code is not null and p.ciqual_code=p_ciqual_code
        then 'ciqual_code'
      else 'full_name_exact'
    end
  ))
  from public.mt_food_price_reference p
  join public.mt_price_sources s
    on s.code=p.source_code
   and s.enabled
  where p.country_code=upper(coalesce(nullif(trim(p_country),''),'FR'))
    and p.verified=true
    and p.observed_on is not null
    and (current_date-p.observed_on)<=120
    and (
      p_region is null
      or p.region_code=p_region
      or p.region_code is null
    )
    and (
      (p_dictionary_id is not null and p.food_dictionary_id=p_dictionary_id)
      or (p_ciqual_code is not null and p.ciqual_code=p_ciqual_code)
      or (
        nullif(public.food_normalize(p_term),'') is not null
        and p.match_term=public.food_normalize(p_term)
      )
    )
  order by
    case
      when p_dictionary_id is not null and p.food_dictionary_id=p_dictionary_id then 0
      when p_ciqual_code is not null and p.ciqual_code=p_ciqual_code then 1
      else 2
    end,
    case when p.region_code=p_region then 0 else 1 end,
    s.priority,
    p.observed_on desc,
    p.updated_at desc,
    p.id
  limit 1;
$fn$;

revoke all on function public.mt_food_price_resolve_whole_dish_v1(uuid,text,text,text,text)
  from public,anon;
grant execute on function public.mt_food_price_resolve_whole_dish_v1(uuid,text,text,text,text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. CANDIDATS FOOD_DICTIONARY STRICTEMENT PRÊTS
--
-- Règle de complétude volontairement plus stricte que l'audit V488.4.1 :
-- - composite_complete=true explicite ; OU
-- - présence simultanée protein + starch + vegetable.
-- Ainsi une sauce, un féculent seul ou un accompagnement n'entre pas seul.
-- ---------------------------------------------------------------------------
create or replace function public.mt_planner_ready_foods_v1()
returns table(
  food_dictionary_id uuid,
  title text,
  subtitle text,
  meal_type text,
  mood text,
  ingredients text[],
  portion_g numeric,
  portion_source text,
  ciqual_code text,
  kcal_100g numeric,
  protein_100g numeric,
  fat_100g numeric,
  carbs_100g numeric,
  strict_price jsonb
)
language sql
stable
security definer
set search_path=public
as $fn$
  with base as (
    select
      d.*,
      c.kcal_100g as c_kcal,
      c.protein_100g as c_protein,
      c.fat_100g as c_fat,
      c.carbs_100g as c_carbs,
      (
        lower(coalesce(d.adapter_profile->>'composite_complete','false'))='true'
        or (
          d.categories && array['protein']::text[]
          and d.categories && array['starch']::text[]
          and d.categories && array['vegetable']::text[]
        )
      ) as explicitly_complete,
      (
        lower(coalesce(d.adapter_profile->>'ingredient_only','false'))='true'
      ) as ingredient_only,
      (
        d.categories && array['restaurant_product','fast_food','protein_powder','ingredient']::text[]
      ) as excluded_family
    from public.food_dictionary d
    left join public.ciqual_foods c on c.code=d.ciqual_code
    where d.enabled=true
      and d.categories && array['composite_dish']::text[]
      and d.meal_contexts && array['breakfast','lunch','dinner']::text[]
  ), enriched as (
    select
      b.*,
      pp.grams_per_unit as portion_g,
      pp.source_label as portion_source,
      pp.estimated as portion_estimated,
      pp.verified as portion_verified,
      public.mt_food_price_resolve_whole_dish_v1(
        b.id,b.ciqual_code,b.canonical_name,'FR',null
      ) as strict_price
    from base b
    left join lateral (
      select p.*
      from public.food_portion_profiles p
      where p.food_dictionary_id=b.id
        and p.enabled=true
        and coalesce(p.grams_per_unit,0)>0
      order by p.verified desc,p.estimated asc,p.priority asc,p.id
      limit 1
    ) pp on true
  ), ready as (
    select e.*
    from enriched e
    where e.explicitly_complete
      and not e.ingredient_only
      and not e.excluded_family
      and (
        (
          e.ciqual_code is not null
          and e.c_kcal is not null
          and e.c_protein is not null
          and e.c_fat is not null
          and e.c_carbs is not null
        )
        or (
          e.custom_kcal_100g is not null
          and e.custom_protein_100g is not null
          and e.custom_fat_100g is not null
          and e.custom_carbs_100g is not null
          and coalesce(e.nutrition_verified,false)=true
        )
      )
      and e.portion_g is not null
      and e.portion_g>0
      and (
        coalesce(e.portion_verified,false)=true
        or (
          coalesce(e.portion_estimated,false)=true
          and nullif(e.portion_source,'') is not null
        )
      )
      and e.strict_price is not null
      and coalesce((e.strict_price->>'verified')::boolean,false)=true
      and coalesce((e.strict_price->>'stale')::boolean,false)=false
      and coalesce(
        nullif(e.strict_price->>'eur_per_kg',''),
        nullif(e.strict_price->>'unit_price_eur','')
      ) is not null
  )
  select
    r.id as food_dictionary_id,
    r.display_name as title,
    concat_ws(' · ',nullif(r.country,''),nullif(r.culture,'')) as subtitle,
    case
      when r.meal_contexts && array['breakfast']::text[]
       and not (r.meal_contexts && array['lunch','dinner']::text[]) then 'breakfast'
      when r.meal_contexts && array['lunch']::text[] then 'lunch'
      else 'dinner'
    end as meal_type,
    case when r.country is not null then 'Cuisine · '||r.country else 'Repas du catalogue' end as mood,
    array_remove(array_cat(
      array[r.display_name]::text[],
      coalesce((
        select array_agg(x order by ord)
        from jsonb_array_elements_text(
          case when jsonb_typeof(r.typical_components)='array'
               then r.typical_components else '[]'::jsonb end
        ) with ordinality t(x,ord)
      ),'{}'::text[])
    ),null) as ingredients,
    r.portion_g,
    r.portion_source,
    r.ciqual_code,
    coalesce(r.c_kcal,r.custom_kcal_100g) as kcal_100g,
    coalesce(r.c_protein,r.custom_protein_100g) as protein_100g,
    coalesce(r.c_fat,r.custom_fat_100g) as fat_100g,
    coalesce(r.c_carbs,r.custom_carbs_100g) as carbs_100g,
    r.strict_price
  from ready r
  order by r.priority,r.display_name;
$fn$;

revoke all on function public.mt_planner_ready_foods_v1() from public,anon;
grant execute on function public.mt_planner_ready_foods_v1() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RAFRAÎCHISSEMENT DU REGISTRE EXTERNE
--    Les éléments qui ne sont plus strictement prêts sont désactivés.
-- ---------------------------------------------------------------------------
create or replace function public.mt_planner_food_refresh_v1()
returns jsonb
language plpgsql
security definer
set search_path=public
as $fn$
declare
  n_ready integer:=0;
  n_inserted integer:=0;
  n_enabled integer:=0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'admin required';
  end if;

  select count(*) into n_ready from public.mt_planner_ready_foods_v1();

  update public.mt_planner_food_items m
  set enabled=false,
      updated_at=now()
  where m.enabled=true
    and not exists (
      select 1
      from public.mt_planner_ready_foods_v1() r
      where r.food_dictionary_id=m.food_dictionary_id
    );

  with ins as (
    insert into public.mt_planner_food_items(
      food_dictionary_id,enabled,source_version,updated_at
    )
    select r.food_dictionary_id,true,'V4885_UNIFIED_STRICT_V1',now()
    from public.mt_planner_ready_foods_v1() r
    on conflict(food_dictionary_id) do update set
      enabled=true,
      source_version='V4885_UNIFIED_STRICT_V1',
      updated_at=now()
    returning 1
  )
  select count(*) into n_inserted from ins;

  select count(*) into n_enabled
  from public.mt_planner_food_items
  where enabled=true;

  return jsonb_build_object(
    'status','ok',
    'strict_ready_foods',n_ready,
    'upserted_rows',n_inserted,
    'enabled_external_items',n_enabled
  );
end;
$fn$;

revoke all on function public.mt_planner_food_refresh_v1() from public,anon;
grant execute on function public.mt_planner_food_refresh_v1() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. COÛT D'UN PLAT EXTERNE PRÊT
--    Le résultat garde la même forme JSON que les recettes existantes.
-- ---------------------------------------------------------------------------
create or replace function public.mt_planner_food_cost_v1(
  p_planner_id uuid,
  p_servings numeric default 1,
  p_country text default 'FR',
  p_region text default null
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $fn$
  with candidate as (
    select
      m.planner_id,
      m.food_dictionary_id,
      r.title,
      r.portion_g,
      public.mt_food_price_resolve_whole_dish_v1(
        r.food_dictionary_id,r.ciqual_code,r.title,p_country,p_region
      ) as price
    from public.mt_planner_food_items m
    join public.mt_planner_ready_foods_v1() r
      on r.food_dictionary_id=m.food_dictionary_id
    where m.planner_id=p_planner_id
      and m.enabled=true
    limit 1
  ), calc as (
    select
      c.*,
      greatest(coalesce(p_servings,1),0.01)*c.portion_g as quantity_g,
      case
        when nullif(c.price->>'eur_per_kg','') is not null
          then greatest(coalesce(p_servings,1),0.01)*c.portion_g/1000
               *(c.price->>'eur_per_kg')::numeric
        when nullif(c.price->>'unit_price_eur','') is not null
          and nullif(c.price->>'unit_weight_g','') is not null
          and (c.price->>'unit_weight_g')::numeric>0
          then greatest(coalesce(p_servings,1),0.01)*c.portion_g
               /(c.price->>'unit_weight_g')::numeric
               *(c.price->>'unit_price_eur')::numeric
        else null::numeric
      end as cost_eur
    from candidate c
  )
  select case
    when not exists(select 1 from calc) then null::jsonb
    else (
      select jsonb_build_object(
        'recipe_id',p_planner_id,
        'status','planner_food_whole_dish_v1',
        'servings',p_servings,
        'base_servings',1,
        'total_estimated_eur',round(coalesce(cost_eur,0),2),
        'total_items',1,
        'priced_items',case when cost_eur is null then 0 else 1 end,
        'coverage_pct',case when cost_eur is null then 0 else 100 end,
        'complete',(cost_eur is not null),
        'items',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'ingredient_name',title,
          'raw_line',title,
          'quantity_g',round(quantity_g,2),
          'quantity_estimated',false,
          'optional',false,
          'requires_choice',false,
          'budget_exempt',false,
          'resolution_status','whole_dish_strict',
          'cost_eur',case when cost_eur is not null then round(cost_eur,2) end,
          'source_label',price->>'source_label',
          'source_code',price->>'source_code',
          'observed_on',price->>'observed_on',
          'eur_per_kg',price->>'eur_per_kg',
          'unit_price_eur',price->>'unit_price_eur',
          'unit_weight_g',price->>'unit_weight_g',
          'strict_match_mode',price->>'strict_match_mode'
        )))
      )
      from calc
    )
  end;
$fn$;

revoke all on function public.mt_planner_food_cost_v1(uuid,numeric,text,text)
  from public,anon;
grant execute on function public.mt_planner_food_cost_v1(uuid,numeric,text,text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. CATALOGUE UNIFIÉ — SIGNATURE INCHANGÉE POUR LE FRONTEND V488.2
-- ---------------------------------------------------------------------------
create or replace function public.mt_planner_recipe_catalog()
returns table(
  recipe_id uuid,
  title text,
  subtitle text,
  meal_type text,
  mood text,
  ingredients text[]
)
language sql
stable
security definer
set search_path=public
as $fn$
  with recipe_rows as (
    select
      r.id as recipe_id,
      r.title,
      r.subtitle,
      r.meal_type,
      r.mood,
      case
        when exists(
          select 1
          from public.recipe_nutrition_items ni
          where ni.recipe_id=r.id
            and ni.included_in_reference=true
        )
        then coalesce((
          select array_agg(ni.ingredient_name order by ni.sort_order,ni.id)
          from public.recipe_nutrition_items ni
          where ni.recipe_id=r.id
            and ni.included_in_reference=true
        ),'{}'::text[])
        else coalesce((
          select array_agg(pi.ingredient_name order by pi.sort_order,pi.id)
          from public.mt_recipe_planner_items pi
          where pi.recipe_id=r.id
            and not pi.optional
            and not pi.budget_exempt
        ),'{}'::text[])
      end as ingredients,
      0 as source_rank,
      coalesce(r.sort_order,0) as sort_rank
    from public.recipes r
    left join public.mt_recipe_planner_profiles pp on pp.recipe_id=r.id
    where r.active=true
      and coalesce(pp.planner_eligible,true)
      and lower(btrim(coalesce(r.meal_type,''))) in (
        'breakfast','bowl','daily','dinner','lunch','meal'
      )
      and public.food_normalize(coalesce(r.category,'')) not in ('apero','aperitif')
      and (
        coalesce(r.is_premium,false)=false
        or public.mt_recipe_access_allowed(r.id)
      )
  ), food_rows as (
    select
      m.planner_id as recipe_id,
      f.title,
      f.subtitle,
      f.meal_type,
      f.mood,
      f.ingredients,
      1 as source_rank,
      1000 as sort_rank
    from public.mt_planner_food_items m
    join public.mt_planner_ready_foods_v1() f
      on f.food_dictionary_id=m.food_dictionary_id
    where m.enabled=true
      and not exists(
        select 1
        from public.recipes r
        where r.id=m.planner_id
      )
      and not exists(
        select 1
        from public.recipes r
        where r.active=true
          and public.food_normalize(r.title)=public.food_normalize(f.title)
      )
  )
  select recipe_id,title,subtitle,meal_type,mood,ingredients
  from (
    select * from recipe_rows
    union all
    select * from food_rows
  ) u
  order by source_rank,sort_rank,title
  limit 500;
$fn$;

revoke all on function public.mt_planner_recipe_catalog() from public,anon;
grant execute on function public.mt_planner_recipe_catalog() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. BATCH DE COÛT UNIFIÉ — SIGNATURE INCHANGÉE POUR LE FRONTEND V488.2
-- ---------------------------------------------------------------------------
create or replace function public.mt_recipe_cost_batch_v1(
  p_recipe_ids uuid[],
  p_servings numeric default 1,
  p_country text default 'FR',
  p_region text default null
)
returns table(recipe_id uuid,cost jsonb)
language sql
stable
security definer
set search_path=public
as $fn$
  select
    x.recipe_id,
    case
      when exists(
        select 1 from public.recipes r where r.id=x.recipe_id
      )
      then public.mt_recipe_cost_estimate_v2(
        x.recipe_id,p_servings,p_country,p_region
      )
      when exists(
        select 1
        from public.mt_planner_food_items m
        where m.planner_id=x.recipe_id
          and m.enabled=true
      )
      then public.mt_planner_food_cost_v1(
        x.recipe_id,p_servings,p_country,p_region
      )
      else null::jsonb
    end as cost
  from (
    select u.recipe_id,u.ord
    from unnest(coalesce(p_recipe_ids,'{}'::uuid[]))
      with ordinality u(recipe_id,ord)
    where u.ord<=60
  ) x
  order by x.ord;
$fn$;

revoke all on function public.mt_recipe_cost_batch_v1(uuid[],numeric,text,text)
  from public,anon;
grant execute on function public.mt_recipe_cost_batch_v1(uuid[],numeric,text,text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 8. PREMIER REFRESH
--    V488.4.1 doit normalement conduire à 0 externe activé pour l'instant.
-- ---------------------------------------------------------------------------
select public.mt_planner_food_refresh_v1();

commit;

-- ---------------------------------------------------------------------------
-- 9. RÉSULTAT UNIQUE À RENVOYER
-- ---------------------------------------------------------------------------
with current_recipe_count as (
  select count(*)::int n
  from public.recipes r
  left join public.mt_recipe_planner_profiles pp on pp.recipe_id=r.id
  where r.active=true
    and coalesce(pp.planner_eligible,true)
    and lower(btrim(coalesce(r.meal_type,''))) in (
      'breakfast','bowl','daily','dinner','lunch','meal'
    )
    and public.food_normalize(coalesce(r.category,'')) not in ('apero','aperitif')
), ready_external as (
  select count(*)::int n from public.mt_planner_ready_foods_v1()
), mapped_external as (
  select count(*)::int n
  from public.mt_planner_food_items
  where enabled=true
), unified_catalog as (
  select count(*)::int n from public.mt_planner_recipe_catalog()
), strict_examples as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',title,
    'portion_g',portion_g,
    'portion_source',portion_source,
    'strict_price_source',strict_price->>'source_item_label',
    'strict_match_mode',strict_price->>'strict_match_mode',
    'eur_per_kg',strict_price->>'eur_per_kg',
    'unit_price_eur',strict_price->>'unit_price_eur'
  ) order by title),'[]'::jsonb) j
  from (
    select * from public.mt_planner_ready_foods_v1()
    limit 20
  ) x
)
select jsonb_build_object(
  'status','v4885_pont_planificateur_unifie_strict_installe',
  'counts',jsonb_build_object(
    'current_recipe_candidates',(select n from current_recipe_count),
    'strict_ready_external_foods',(select n from ready_external),
    'enabled_external_foods',(select n from mapped_external),
    'unified_catalog_total',(select n from unified_catalog)
  ),
  'strict_ready_examples',(select j from strict_examples),
  'guards',jsonb_build_object(
    'legacy_substring_price_allowed_for_external',false,
    'whole_dish_price_must_be_exact',true,
    'whole_dish_price_must_be_verified',true,
    'whole_dish_price_max_age_days',120,
    'standalone_components_allowed',false,
    'frontend_signature_changed',false,
    'existing_recipe_cost_path_preserved',true
  ),
  'safety',jsonb_build_object(
    'voice_changed',false,
    'prices_changed',false,
    'recipes_changed',false,
    'frontend_changed',false,
    'nutrition_changed',false,
    'protocols_changed',false,
    'food_dictionary_changed',false,
    'portion_profiles_changed',false
  ),
  'next_step',
  'Envoyer ce JSON. Si strict_ready_external_foods reste à 0, c est attendu : la prochaine étape sera un petit lot de données fiable (pont dictionary + portions + prix stricts) plutôt que d activer artificiellement 372 candidats.'
) as v4885_result;
