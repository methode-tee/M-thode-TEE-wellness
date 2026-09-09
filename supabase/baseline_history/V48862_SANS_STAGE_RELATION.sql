-- ============================================================================
-- MÉTHODE TEE — V488.6.2
-- CORRECTIF ROBUSTE : AUCUNE TABLE DE STAGE
--
-- Cause ciblée :
-- ERROR 42P01 relation public.mt_v4886_stage_work does not exist
--
-- Le lot est maintenant porté par une variable JSONB locale à UN SEUL bloc DO.
-- Aucun objet intermédiaire n'est créé entre plusieurs statements/sessions.
-- Si une garde échoue, le bloc DO est rollbacké atomiquement.
--
-- Pré-requis : V488.5 installé.
-- ============================================================================

DO $v48862$
DECLARE
  v_stage constant jsonb := $stage$[{"ciqual_code":"25111","canonical_name":"CIQUAL 25111 · Chili con carne préemballé","display_name":"Chili con carne","aliases":["chili con carne","chili con carne préemballé","chili con carne preemballe"],"country":"International","culture":"Cuisine tex-mex","meal_contexts":["lunch","dinner"],"categories":["protein","starch","vegetable","composite_dish"],"adapter_profile":{"composite_complete":true,"planner_whole_dish":true,"composition_variable":true,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"},"portion_g":400,"package_price_eur":1.79,"source_item_label":"Chili con carne au bœuf Chili con Carne CARREFOUR SENSATION — boîte 400 g","source_url":"https://www.carrefour.fr/p/chili-con-carne-au-boeuf-chili-con-carne-carrefour-sensation-3560070748938"},{"ciqual_code":"25009","canonical_name":"CIQUAL 25009 · Hachis parmentier à la viande préemballé","display_name":"Hachis parmentier","aliases":["hachis parmentier","hachis parmentier à la viande","hachis parmentier a la viande"],"country":"France","culture":"Cuisine française","meal_contexts":["lunch","dinner"],"categories":["protein","starch","composite_dish"],"adapter_profile":{"composite_complete":true,"planner_whole_dish":true,"composition_variable":true,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"},"portion_g":300,"package_price_eur":2.65,"source_item_label":"Plat cuisiné hachis parmentier CARREFOUR CLASSIC' — barquette 300 g","source_url":"https://www.carrefour.fr/p/plat-cuisine-hachis-parmentier-carrefour-classic-3245412776878"},{"ciqual_code":"25127","canonical_name":"CIQUAL 25127 · Couscous royal préemballé","display_name":"Couscous royal","aliases":["couscous royal","couscous plusieurs viandes"],"country":"Maghreb","culture":"Cuisine maghrébine","meal_contexts":["lunch","dinner"],"categories":["protein","starch","vegetable","composite_dish"],"adapter_profile":{"composite_complete":true,"planner_whole_dish":true,"composition_variable":true,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"},"portion_g":350,"package_price_eur":5.0,"source_item_label":"Plat cuisiné Couscous Royal CARREFOUR LE MARCHE — barquette 350 g","source_url":"https://www.carrefour.fr/p/plat-cuisine-couscous-royal-carrefour-le-marche-3560070504978"},{"ciqual_code":"25123","canonical_name":"CIQUAL 25123 · Moussaka préemballée","display_name":"Moussaka","aliases":["moussaka","moussaka préemballée","moussaka preemballee"],"country":"Grèce","culture":"Cuisine grecque","meal_contexts":["lunch","dinner"],"categories":["protein","starch","vegetable","composite_dish"],"adapter_profile":{"composite_complete":true,"planner_whole_dish":true,"composition_variable":true,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"},"portion_g":300,"package_price_eur":4.95,"source_item_label":"Plat cuisiné Moussaka AUTHENTIQUE GREC BY IFANTIS — barquette 300 g","source_url":"https://www.carrefour.fr/r/produits-du-monde/grece/plats-cuisines-salade-grecque"},{"ciqual_code":"25031","canonical_name":"CIQUAL 25031 · Paëlla préemballée","display_name":"Paëlla","aliases":["paella","paëlla","paella préemballée","paella preemballee"],"country":"Espagne","culture":"Cuisine espagnole","meal_contexts":["lunch","dinner"],"categories":["protein","starch","vegetable","composite_dish"],"adapter_profile":{"composite_complete":true,"planner_whole_dish":true,"composition_variable":true,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"},"portion_g":300,"package_price_eur":3.45,"source_item_label":"Paëlla Poulet, moules du Pacifique & chorizo CARREFOUR SENSATION — 300 g","source_url":"https://www.carrefour.fr/p/paella-poulet-moules-du-pacifique-chorizo-carrefour-sensation-3560071529376"},{"ciqual_code":"25002","canonical_name":"CIQUAL 25002 · Cassoulet appertisé","display_name":"Cassoulet","aliases":["cassoulet","cassoulet appertisé","cassoulet appertise"],"country":"France","culture":"Cuisine du Sud-Ouest","meal_contexts":["lunch","dinner"],"categories":["protein","starch","vegetable","composite_dish"],"adapter_profile":{"composite_complete":true,"planner_whole_dish":true,"composition_variable":true,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"},"portion_g":420,"package_price_eur":3.35,"source_item_label":"Plat Individuel Cassoulet Toulousain WILLIAM SAURIN — boîte 420 g","source_url":"https://www.carrefour.fr/p/plat-individuel-cassoulet-toulousain-william-saurin-3038355841402"},{"ciqual_code":"25003","canonical_name":"CIQUAL 25003 · Choucroute garnie préemballée","display_name":"Choucroute garnie","aliases":["choucroute garnie","choucroute préemballée","choucroute preemballee"],"country":"France","culture":"Cuisine alsacienne","meal_contexts":["lunch","dinner"],"categories":["protein","vegetable","composite_dish"],"adapter_profile":{"composite_complete":true,"planner_whole_dish":true,"composition_variable":true,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"},"portion_g":400,"package_price_eur":2.25,"source_item_label":"Plat Individuel Choucroute Garnie WILLIAM SAURIN — boîte 400 g","source_url":"https://www.carrefour.fr/p/plat-individuel-choucroute-garnie-william-saurin-3049580530160"},{"ciqual_code":"25033","canonical_name":"CIQUAL 25033 · Boeuf bourguignon préemballé","display_name":"Bœuf bourguignon","aliases":["boeuf bourguignon","bœuf bourguignon","boeuf bourguignon préemballé","boeuf bourguignon preemballe"],"country":"France","culture":"Cuisine bourguignonne","meal_contexts":["lunch","dinner"],"categories":["protein","starch","vegetable","composite_dish"],"adapter_profile":{"composite_complete":true,"planner_whole_dish":true,"composition_variable":true,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"},"portion_g":400,"package_price_eur":3.85,"source_item_label":"Plat Individuel Bœuf Bourguignon WILLIAM SAURIN — boîte 400 g","source_url":"https://www.carrefour.fr/p/plat-individuel-boeuf-bourguignon-william-saurin-3049580540145"},{"ciqual_code":"25071","canonical_name":"CIQUAL 25071 · Potée auvergnate chou et porc","display_name":"Potée auvergnate","aliases":["potée auvergnate","potee auvergnate","potée aux choux","potee aux choux"],"country":"France","culture":"Cuisine auvergnate","meal_contexts":["lunch","dinner"],"categories":["protein","starch","vegetable","composite_dish"],"adapter_profile":{"composite_complete":true,"planner_whole_dish":true,"composition_variable":true,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"},"portion_g":420,"package_price_eur":3.55,"source_item_label":"Plat Individuel Potée aux Choux WILLIAM SAURIN — boîte 420 g","source_url":"https://www.carrefour.fr/r/epicerie-salee/les-plats-cuisines/choucroutes-et-autres-plats?page=2"}]$stage$::jsonb;
  v_count integer;
BEGIN
  -- -------------------------------------------------------------------------
  -- 0. PRÉ-VÉRIFICATIONS
  -- -------------------------------------------------------------------------
  if to_regprocedure('public.mt_planner_ready_foods_v1()') is null
     or to_regprocedure('public.mt_planner_food_refresh_v1()') is null
     or to_regprocedure('public.mt_food_price_resolve_whole_dish_v1(uuid,text,text,text,text)') is null then
    raise exception 'V488.6.2 nécessite V488.5';
  end if;

  if not exists(
    select 1 from public.mt_price_sources
    where code='TEE_ADMIN' and enabled
  ) then
    raise exception 'V488.6.2 : source prix TEE_ADMIN absente ou désactivée';
  end if;

  if (select count(*) from public.ciqual_foods
      where code=any(array['25111','25009','25127','25123','25031','25002','25003','25033','25071']::text[])) <> 9 then
    raise exception 'V488.6.2 : les 9 codes CIQUAL attendus ne sont pas tous présents';
  end if;

  if jsonb_array_length(v_stage) <> 9 then
    raise exception 'V488.6.2 : 9 plats attendus dans le lot';
  end if;

  if exists(
    select 1
    from jsonb_to_recordset(v_stage) as s(
      ciqual_code text,
      canonical_name text,
      display_name text,
      aliases text[],
      country text,
      culture text,
      meal_contexts text[],
      categories text[],
      adapter_profile jsonb,
      portion_g numeric,
      package_price_eur numeric,
      source_item_label text,
      source_url text
    )
    where s.portion_g<=0 or s.package_price_eur<=0
  ) then
    raise exception 'V488.6.2 : portion ou prix invalide';
  end if;

  -- -------------------------------------------------------------------------
  -- 1. PONT FOOD_DICTIONARY -> CIQUAL
  -- -------------------------------------------------------------------------
  insert into public.food_dictionary(
    canonical_name,display_name,aliases,country,region,culture,ciqual_code,
    enabled,priority,meal_contexts,categories,typical_components,optional_components,
    adapter_profile,source,
    custom_kcal_100g,custom_protein_100g,custom_fat_100g,custom_carbs_100g,
    custom_fiber_100g,custom_salt_100g,custom_micronutrients_100g,
    nutrition_basis,nutrition_source_label,nutrition_verified,
    custom_nutrition_extra_100g
  )
  select
    s.canonical_name,
    s.display_name,
    s.aliases,
    s.country,
    null,
    s.culture,
    s.ciqual_code,
    true,
    80,
    s.meal_contexts,
    s.categories,
    '[]'::jsonb,
    '[]'::jsonb,
    s.adapter_profile,
    'Méthode Tee · Pont CIQUAL planificateur V488.6',
    null,null,null,null,null,null,
    '{}'::jsonb,
    '100g',
    'CIQUAL 2025 · code '||s.ciqual_code||' · nutrition générique du plat',
    false,
    '{}'::jsonb
  from jsonb_to_recordset(v_stage) as s(
    ciqual_code text,
    canonical_name text,
    display_name text,
    aliases text[],
    country text,
    culture text,
    meal_contexts text[],
    categories text[],
    adapter_profile jsonb,
    portion_g numeric,
    package_price_eur numeric,
    source_item_label text,
    source_url text
  )
  on conflict(normalized_name) do update set
    display_name=excluded.display_name,
    aliases=excluded.aliases,
    country=excluded.country,
    culture=excluded.culture,
    ciqual_code=excluded.ciqual_code,
    enabled=true,
    priority=excluded.priority,
    meal_contexts=excluded.meal_contexts,
    categories=excluded.categories,
    typical_components='[]'::jsonb,
    optional_components='[]'::jsonb,
    adapter_profile=excluded.adapter_profile,
    source=excluded.source,
    nutrition_basis=excluded.nutrition_basis,
    nutrition_source_label=excluded.nutrition_source_label,
    updated_at=now()
  where public.food_dictionary.source='Méthode Tee · Pont CIQUAL planificateur V488.6';

  -- Collision guard
  select count(*) into v_count
  from jsonb_to_recordset(v_stage) as s(
    ciqual_code text,
    canonical_name text,
    display_name text,
    aliases text[],
    country text,
    culture text,
    meal_contexts text[],
    categories text[],
    adapter_profile jsonb,
    portion_g numeric,
    package_price_eur numeric,
    source_item_label text,
    source_url text
  )
  join public.food_dictionary d
    on d.normalized_name=public.food_normalize(s.canonical_name)
  where d.source='Méthode Tee · Pont CIQUAL planificateur V488.6'
    and d.ciqual_code=s.ciqual_code;

  if v_count <> 9 then
    raise exception 'V488.6.2 : collision food_dictionary, rollback complet';
  end if;

  -- -------------------------------------------------------------------------
  -- 2. PORTIONS
  -- -------------------------------------------------------------------------
  delete from public.food_portion_profiles p
  using public.food_dictionary d,
        jsonb_to_recordset(v_stage) as s(
          ciqual_code text,
          canonical_name text,
          display_name text,
          aliases text[],
          country text,
          culture text,
          meal_contexts text[],
          categories text[],
          adapter_profile jsonb,
          portion_g numeric,
          package_price_eur numeric,
          source_item_label text,
          source_url text
        )
  where p.food_dictionary_id=d.id
    and d.normalized_name=public.food_normalize(s.canonical_name)
    and p.source_label='Méthode Tee · V488.6 · portion format individuel';

  insert into public.food_portion_profiles(
    food_dictionary_id,name_pattern,match_mode,unit_label,grams_per_unit,
    default_amount,step,min_amount,estimated,verified,
    source_label,notes,priority,enabled
  )
  select
    d.id,
    d.display_name,
    'exact',
    'portion',
    s.portion_g,
    1,
    1,
    1,
    true,
    false,
    'Méthode Tee · V488.6 · portion format individuel',
    'Repère planificateur : 1 portion = format individuel du produit de prix de référence ('||
    s.portion_g::text||' g). Nutrition utilisée : fiche CIQUAL générique, non l''étiquette du produit magasin.',
    10,
    true
  from jsonb_to_recordset(v_stage) as s(
    ciqual_code text,
    canonical_name text,
    display_name text,
    aliases text[],
    country text,
    culture text,
    meal_contexts text[],
    categories text[],
    adapter_profile jsonb,
    portion_g numeric,
    package_price_eur numeric,
    source_item_label text,
    source_url text
  )
  join public.food_dictionary d
    on d.normalized_name=public.food_normalize(s.canonical_name);

  -- -------------------------------------------------------------------------
  -- 3. PRIX STRICTS DU PLAT ENTIER
  -- -------------------------------------------------------------------------
  delete from public.mt_food_price_reference
  where note like 'V4886_LOT1|%';

  insert into public.mt_food_price_reference(
    source_code,
    food_dictionary_id,
    ciqual_code,
    match_term,
    source_item_key,
    source_item_label,
    country_code,
    region_code,
    price_eur,
    price_basis,
    eur_per_kg,
    eur_per_l,
    unit_price_eur,
    unit_weight_g,
    density_g_ml,
    observed_on,
    confidence,
    verified,
    note,
    updated_at
  )
  select
    'TEE_ADMIN',
    d.id,
    null::text,
    public.food_normalize(s.canonical_name),
    public.food_normalize(s.source_item_label),
    s.source_item_label,
    'FR',
    null,
    s.package_price_eur,
    'package',
    round(s.package_price_eur*1000/s.portion_g,6),
    null,
    s.package_price_eur,
    s.portion_g,
    null,
    '2026-09-08'::date,
    'manual_verified',
    true,
    'V4886_LOT1|Prix du plat entier / format repère observé Carrefour France le 2026-09-08. '||
    'Prix variable selon magasin/Drive. Ce prix est un repère budgétaire whole-dish ; '||
    'la nutrition reste la référence CIQUAL générique. Source: '||s.source_url,
    now()
  from jsonb_to_recordset(v_stage) as s(
    ciqual_code text,
    canonical_name text,
    display_name text,
    aliases text[],
    country text,
    culture text,
    meal_contexts text[],
    categories text[],
    adapter_profile jsonb,
    portion_g numeric,
    package_price_eur numeric,
    source_item_label text,
    source_url text
  )
  join public.food_dictionary d
    on d.normalized_name=public.food_normalize(s.canonical_name);

  -- -------------------------------------------------------------------------
  -- 4. RAFRAÎCHIR LE PONT V488.5
  -- -------------------------------------------------------------------------
  perform public.mt_planner_food_refresh_v1();

  select count(*) into v_count
  from public.mt_planner_ready_foods_v1() r
  join public.food_dictionary d on d.id=r.food_dictionary_id
  where d.source='Méthode Tee · Pont CIQUAL planificateur V488.6';

  if v_count <> 9 then
    raise exception 'V488.6.2 : les 9 plats ne sont pas strictement prêts (trouvés=%), rollback complet', v_count;
  end if;
END
$v48862$;

-- ---------------------------------------------------------------------------
-- 5. RÉSULTAT UNIQUE
-- ---------------------------------------------------------------------------
with pre_access as (
  select count(*)::int n
  from public.recipes r
  left join public.mt_recipe_planner_profiles pp on pp.recipe_id=r.id
  where r.active=true
    and coalesce(pp.planner_eligible,true)
    and lower(btrim(coalesce(r.meal_type,''))) in (
      'breakfast','bowl','daily','dinner','lunch','meal'
    )
    and public.food_normalize(coalesce(r.category,'')) not in ('apero','aperitif')
), visible_recipe_catalog as (
  select count(*)::int n
  from public.mt_planner_recipe_catalog() c
  where exists(select 1 from public.recipes r where r.id=c.recipe_id)
), v4886_ready as (
  select count(*)::int n
  from public.mt_planner_ready_foods_v1() r
  join public.food_dictionary d on d.id=r.food_dictionary_id
  where d.source='Méthode Tee · Pont CIQUAL planificateur V488.6'
), all_ready as (
  select count(*)::int n from public.mt_planner_ready_foods_v1()
), enabled_external as (
  select count(*)::int n from public.mt_planner_food_items where enabled
), unified as (
  select count(*)::int n from public.mt_planner_recipe_catalog()
), examples as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'title',x.title,
    'ciqual_code',x.ciqual_code,
    'kcal_100g',x.kcal_100g,
    'portion_g',x.portion_g,
    'estimated_cost_eur',round((x.cost->>'total_estimated_eur')::numeric,2),
    'price_source',x.strict_price->>'source_item_label',
    'strict_match_mode',x.strict_price->>'strict_match_mode'
  ) order by x.title),'[]'::jsonb) j
  from (
    select
      r.*,
      public.mt_planner_food_cost_v1(m.planner_id,1,'FR',null) cost
    from public.mt_planner_ready_foods_v1() r
    join public.food_dictionary d on d.id=r.food_dictionary_id
    join public.mt_planner_food_items m
      on m.food_dictionary_id=r.food_dictionary_id and m.enabled
    where d.source='Méthode Tee · Pont CIQUAL planificateur V488.6'
  ) x
)
select jsonb_build_object(
  'status','v48862_lot1_9_plats_ciqual_stricts_actifs',
  'counts',jsonb_build_object(
    'recipe_candidates_pre_access',(select n from pre_access),
    'visible_recipe_catalog',(select n from visible_recipe_catalog),
    'v4886_strict_ready_external',(select n from v4886_ready),
    'all_strict_ready_external',(select n from all_ready),
    'enabled_external_foods',(select n from enabled_external),
    'unified_catalog_total',(select n from unified),
    'v4886_dictionary_rows',(
      select count(*) from public.food_dictionary
      where source='Méthode Tee · Pont CIQUAL planificateur V488.6'
    ),
    'v4886_portion_rows',(
      select count(*)
      from public.food_portion_profiles p
      join public.food_dictionary d on d.id=p.food_dictionary_id
      where d.source='Méthode Tee · Pont CIQUAL planificateur V488.6'
        and p.source_label='Méthode Tee · V488.6 · portion format individuel'
        and p.enabled
    ),
    'v4886_price_rows',(
      select count(*) from public.mt_food_price_reference
      where note like 'V4886_LOT1|%'
    )
  ),
  'external_examples',(select j from examples),
  'guards',jsonb_build_object(
    'no_stage_relation',true,
    'whole_dish_exact_dictionary_binding',true,
    'legacy_substring_price_used',false,
    'missing_price_becomes_zero',false,
    'portion_is_explicitly_sourced',true,
    'nutrition_source','CIQUAL',
    'retail_price_is_budget_reference_not_nutrition_identity',true
  ),
  'safety',jsonb_build_object(
    'frontend_changed',false,
    'voice_changed',false,
    'protocols_changed',false,
    'recipes_changed',false,
    'ciqual_rows_changed',false,
    'food_dictionary_changed',true,
    'portion_profiles_changed',true,
    'prices_changed',true
  ),
  'next_step',
    'Envoyer ce JSON. Si les 9 plats sont actifs, recharger l app puis refaire 30, 45 et 70 euros.'
) as v4886_result;
