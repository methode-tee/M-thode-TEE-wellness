-- ============================================================================
-- MÉTHODE TEE — V488.8
-- CULTURES LOT 2 · AFRIQUE / MAGHREB STRICT
--
-- Pré-requis : V488.5 + V488.6.2 + V488.7 installés.
-- Le frontend V488.7.1 peut rester tel quel : le catalogue externe est dynamique.
--
-- Ajouts activés dans le planificateur :
--   1) Poulet DG — Cameroun (entrée food_dictionary existante, nutrition conservée)
--   2) Mafé poulet & riz — Sénégal (variante documentée complète)
--   3) Poulet yassa & boulgour — Sénégal (variante documentée complète)
--   4) Harira tomate & lentilles — Maroc (variante documentée complète)
--
-- Principes :
-- - aucun prix par sous-chaîne / ingrédient ;
-- - prix whole-dish lié exactement au food_dictionary_id ;
-- - portion explicitement documentée ;
-- - les variantes créées ont leur propre nutrition produit vérifiée par 100 g ;
-- - le Poulet DG conserve sa nutrition Méthode Tee déjà vérifiée ;
-- - aucun optional_component d'un plat générique n'est promu en ingrédient certain ;
-- - les plats culturellement incomplets (Ndolè générique, Mafé générique, Yassa
--   générique, etc.) restent hors du planner tant qu'une variante complète stricte
--   n'est pas documentée.
-- ============================================================================

do $v4888$
declare
  v_source constant text := 'Méthode Tee · variante culturelle documentée V488.8';
  v_portion_source constant text := 'Méthode Tee · V488.8 · portion culturelle stricte';
  v_data jsonb := $data$
  [
    {
      "canonical_name":"Poulet DG",
      "portion_g":500,
      "package_weight_g":500,
      "price_eur":13.50,
      "source_item_label":"POULET DG — Les saveurs d'ici et d'ailleurs · 500 g/portion",
      "source_url":"https://deliveroo.fr/fr/menu/strasbourg/quartier-meinau/la-cuisine-de-mayi",
      "price_detail":"500 g/portion · 13,50 €"
    },
    {
      "canonical_name":"Mafé poulet & riz",
      "portion_g":320,
      "package_weight_g":320,
      "price_eur":6.99,
      "source_item_label":"Le Mafé poulet MON MARCHÉ — barquette 320 g",
      "source_url":"https://www.mon-marche.fr/categorie/plats-cuisines-et-accompagnements",
      "price_detail":"barquette 320 g · 6,99 € (catalogue plats cuisinés)"
    },
    {
      "canonical_name":"Poulet yassa & boulgour",
      "portion_g":300,
      "package_weight_g":300,
      "price_eur":3.89,
      "source_item_label":"Poulet Yassa et Boulgour PAUL & LOUISE — barquette 300 g · 1 personne",
      "source_url":"https://www.houra.fr/paul-et-louise-poulet-yassa-et-boulgour-300g/1429218/",
      "price_detail":"barquette 300 g · 1 personne · 3,89 €"
    },
    {
      "canonical_name":"Harira tomate & lentilles",
      "portion_g":240,
      "package_weight_g":480,
      "price_eur":4.98,
      "source_item_label":"Soupe Harira tomate lentille LE VOYAGE DE MAMABÉ — pot 480 g · 2 personnes",
      "source_url":"https://www.greenweez.com/produit/soupe-harira-tomate-lentille-bio-480g/3MAMA0055",
      "price_detail":"pot 480 g · repas complet pour 2 personnes · 4,98 €"
    }
  ]
  $data$::jsonb;

  r record;
  v_id uuid;
  v_display text;
  v_country text;
  v_ready integer;
  v_total_before integer;
  v_total_after integer;
begin
  -- -------------------------------------------------------------------------
  -- 0. Préflight
  -- -------------------------------------------------------------------------
  if to_regprocedure('public.mt_planner_ready_foods_v1()') is null
     or to_regprocedure('public.mt_planner_food_refresh_v1()') is null
     or to_regprocedure('public.mt_food_price_resolve_whole_dish_v1(uuid,text,text,text,text)') is null
     or to_regprocedure('public.mt_planner_food_cost_v1(uuid,numeric,text,text)') is null then
    raise exception 'V488.8 nécessite le pont V488.5';
  end if;

  if to_regclass('public.food_dictionary') is null
     or to_regclass('public.food_portion_profiles') is null
     or to_regclass('public.mt_food_price_reference') is null
     or to_regclass('public.mt_planner_food_items') is null then
    raise exception 'V488.8 : tables food_dictionary / portions / prix / planner absentes';
  end if;

  if not exists(
    select 1 from public.mt_price_sources where code='TEE_ADMIN' and enabled
  ) then
    raise exception 'V488.8 : source prix TEE_ADMIN absente ou désactivée';
  end if;

  -- On attend le lot précédent déjà fonctionnel. On ne demande pas exactement 13
  -- pour rester compatible avec de futurs ajouts, mais jamais moins.
  select count(*)::int into v_total_before from public.mt_planner_ready_foods_v1();
  if v_total_before < 13 then
    raise exception 'V488.8 : V488.7 semble incomplet (externes stricts=% ; attendu >=13)',v_total_before;
  end if;

  -- Nettoyage idempotent UNIQUEMENT du lot V488.8.
  delete from public.mt_food_price_reference
  where note like 'V4888_CULTURE_LOT2|%';

  delete from public.food_portion_profiles
  where source_label=v_portion_source;

  -- -------------------------------------------------------------------------
  -- 1. Trois variantes culturelles EXACTES, avec nutrition produit vérifiée.
  --    On ne transforme jamais les entrées génériques Mafé / Yassa / Harira.
  -- -------------------------------------------------------------------------

  -- MAFÉ POULET & RIZ — SÉNÉGAL
  insert into public.food_dictionary(
    canonical_name,display_name,aliases,country,region,culture,ciqual_code,
    enabled,priority,meal_contexts,categories,typical_components,optional_components,
    adapter_profile,source,
    custom_kcal_100g,custom_protein_100g,custom_fat_100g,custom_carbs_100g,
    custom_fiber_100g,custom_salt_100g,custom_micronutrients_100g,
    nutrition_basis,nutrition_source_label,nutrition_verified
  ) values (
    'Mafé poulet & riz','Mafé poulet & riz — Sénégal',
    array['mafé poulet riz','mafe poulet riz','mafé au poulet','mafe au poulet']::text[],
    'Sénégal',null,'Cuisine sénégalaise',null,
    true,18,array['lunch','dinner']::text[],
    array['protein','starch','vegetable','rich_sauce','composite_dish']::text[],
    '["riz basmati","poulet","sauce arachide","tomate","oignon","poivron"]'::jsonb,
    '[]'::jsonb,
    '{"already_contains_vegetable":true,"composite_complete":true,"planner_whole_dish":true,"planner_cultural_strict":true,"planner_cultural_lot":"V4888","exact_variant":true,"composition_variable":false,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"}'::jsonb,
    v_source,
    157,8.3,5,19,null,0.67,'{}'::jsonb,
    '100g',
    'Mon Marché · Le Mafé au poulet · barquette 320 g · valeurs nutritionnelles pour 100 g · consulté 2026-09-09',
    true
  )
  on conflict(normalized_name) do update set
    display_name=excluded.display_name,
    aliases=excluded.aliases,
    country=excluded.country,
    culture=excluded.culture,
    enabled=true,
    priority=excluded.priority,
    meal_contexts=excluded.meal_contexts,
    categories=excluded.categories,
    typical_components=excluded.typical_components,
    optional_components=excluded.optional_components,
    adapter_profile=excluded.adapter_profile,
    custom_kcal_100g=excluded.custom_kcal_100g,
    custom_protein_100g=excluded.custom_protein_100g,
    custom_fat_100g=excluded.custom_fat_100g,
    custom_carbs_100g=excluded.custom_carbs_100g,
    custom_fiber_100g=excluded.custom_fiber_100g,
    custom_salt_100g=excluded.custom_salt_100g,
    nutrition_basis=excluded.nutrition_basis,
    nutrition_source_label=excluded.nutrition_source_label,
    nutrition_verified=true,
    source=excluded.source,
    updated_at=now()
  where public.food_dictionary.source=v_source;

  -- POULET YASSA & BOULGOUR — SÉNÉGAL
  insert into public.food_dictionary(
    canonical_name,display_name,aliases,country,region,culture,ciqual_code,
    enabled,priority,meal_contexts,categories,typical_components,optional_components,
    adapter_profile,source,
    custom_kcal_100g,custom_protein_100g,custom_fat_100g,custom_carbs_100g,
    custom_fiber_100g,custom_salt_100g,custom_micronutrients_100g,
    nutrition_basis,nutrition_source_label,nutrition_verified
  ) values (
    'Poulet yassa & boulgour','Poulet yassa & boulgour — Sénégal',
    array['poulet yassa boulgour','yassa poulet boulgour']::text[],
    'Sénégal',null,'Cuisine sénégalaise',null,
    true,18,array['lunch','dinner']::text[],
    array['protein','starch','vegetable','rich_sauce','composite_dish']::text[],
    '["poulet","boulgour","carotte","oignon rouge","poivron","citron","moutarde"]'::jsonb,
    '[]'::jsonb,
    '{"already_contains_vegetable":true,"composite_complete":true,"planner_whole_dish":true,"planner_cultural_strict":true,"planner_cultural_lot":"V4888","exact_variant":true,"composition_variable":false,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"}'::jsonb,
    v_source,
    143,8.5,5.3,14.3,2.3,1.3,'{}'::jsonb,
    '100g',
    'Paul & Louise · Poulet Yassa et Boulgour · valeurs nutritionnelles pour 100 g · consulté 2026-09-09',
    true
  )
  on conflict(normalized_name) do update set
    display_name=excluded.display_name,
    aliases=excluded.aliases,
    country=excluded.country,
    culture=excluded.culture,
    enabled=true,
    priority=excluded.priority,
    meal_contexts=excluded.meal_contexts,
    categories=excluded.categories,
    typical_components=excluded.typical_components,
    optional_components=excluded.optional_components,
    adapter_profile=excluded.adapter_profile,
    custom_kcal_100g=excluded.custom_kcal_100g,
    custom_protein_100g=excluded.custom_protein_100g,
    custom_fat_100g=excluded.custom_fat_100g,
    custom_carbs_100g=excluded.custom_carbs_100g,
    custom_fiber_100g=excluded.custom_fiber_100g,
    custom_salt_100g=excluded.custom_salt_100g,
    nutrition_basis=excluded.nutrition_basis,
    nutrition_source_label=excluded.nutrition_source_label,
    nutrition_verified=true,
    source=excluded.source,
    updated_at=now()
  where public.food_dictionary.source=v_source;

  -- HARIRA TOMATE & LENTILLES — MAROC
  insert into public.food_dictionary(
    canonical_name,display_name,aliases,country,region,culture,ciqual_code,
    enabled,priority,meal_contexts,categories,typical_components,optional_components,
    adapter_profile,source,
    custom_kcal_100g,custom_protein_100g,custom_fat_100g,custom_carbs_100g,
    custom_fiber_100g,custom_salt_100g,custom_micronutrients_100g,
    nutrition_basis,nutrition_source_label,nutrition_verified
  ) values (
    'Harira tomate & lentilles','Harira tomate & lentilles — Maroc',
    array['harira tomate lentilles','soupe harira tomate lentille','soupe harira lentilles']::text[],
    'Maroc',null,'Cuisine marocaine',null,
    true,18,array['lunch','dinner']::text[],
    array['protein','vegetable','soup','composite_dish']::text[],
    '["tomate","lentilles","pois chiches","coriandre"]'::jsonb,
    '[]'::jsonb,
    '{"already_contains_vegetable":true,"composite_complete":true,"planner_whole_dish":true,"planner_cultural_strict":true,"planner_cultural_lot":"V4888","exact_variant":true,"composition_variable":false,"do_not_auto_expand_components":true,"budget_reference_kind":"whole_dish_retail_reference"}'::jsonb,
    v_source,
    111,2.5,7.8,6.5,2.2,0.73,'{}'::jsonb,
    '100g',
    'Le Voyage de Mamabé · Soupe Harira tomate lentille bio · valeurs nutritionnelles pour 100 g · consulté 2026-09-09',
    true
  )
  on conflict(normalized_name) do update set
    display_name=excluded.display_name,
    aliases=excluded.aliases,
    country=excluded.country,
    culture=excluded.culture,
    enabled=true,
    priority=excluded.priority,
    meal_contexts=excluded.meal_contexts,
    categories=excluded.categories,
    typical_components=excluded.typical_components,
    optional_components=excluded.optional_components,
    adapter_profile=excluded.adapter_profile,
    custom_kcal_100g=excluded.custom_kcal_100g,
    custom_protein_100g=excluded.custom_protein_100g,
    custom_fat_100g=excluded.custom_fat_100g,
    custom_carbs_100g=excluded.custom_carbs_100g,
    custom_fiber_100g=excluded.custom_fiber_100g,
    custom_salt_100g=excluded.custom_salt_100g,
    nutrition_basis=excluded.nutrition_basis,
    nutrition_source_label=excluded.nutrition_source_label,
    nutrition_verified=true,
    source=excluded.source,
    updated_at=now()
  where public.food_dictionary.source=v_source;

  -- Collision guard des 3 variantes : ne jamais écraser une fiche étrangère.
  if (
    select count(*)
    from public.food_dictionary d
    where d.normalized_name in (
      public.food_normalize('Mafé poulet & riz'),
      public.food_normalize('Poulet yassa & boulgour'),
      public.food_normalize('Harira tomate & lentilles')
    )
      and d.source=v_source
      and d.nutrition_verified=true
  ) <> 3 then
    raise exception 'V488.8 : collision ou création incomplète des variantes culturelles, arrêt sans écraser les données existantes';
  end if;

  -- -------------------------------------------------------------------------
  -- 2. Poulet DG existant : profil planner seulement, nutrition intacte.
  -- -------------------------------------------------------------------------
  select d.id into v_id
  from public.food_dictionary d
  where d.normalized_name=public.food_normalize('Poulet DG')
    and d.enabled=true
    and public.food_normalize(coalesce(d.country,''))=public.food_normalize('Cameroun')
  limit 1;

  if v_id is null then
    raise exception 'V488.8 : Poulet DG — Cameroun absent de food_dictionary';
  end if;

  -- On exige que sa nutrition soit déjà fiable : aucune macro n'est inventée ici.
  if not exists(
    select 1
    from public.food_dictionary d
    left join public.ciqual_foods c on c.code=d.ciqual_code
    where d.id=v_id
      and (
        (d.ciqual_code is not null and c.kcal_100g is not null and c.protein_100g is not null and c.fat_100g is not null and c.carbs_100g is not null)
        or
        (d.custom_kcal_100g is not null and d.custom_protein_100g is not null and d.custom_fat_100g is not null and d.custom_carbs_100g is not null and coalesce(d.nutrition_verified,false)=true)
      )
  ) then
    raise exception 'V488.8 : nutrition Poulet DG non suffisamment fiable ; aucune valeur ne sera inventée';
  end if;

  update public.food_dictionary
  set adapter_profile=coalesce(adapter_profile,'{}'::jsonb)||jsonb_build_object(
        'composite_complete',true,
        'planner_whole_dish',true,
        'planner_cultural_strict',true,
        'planner_cultural_lot','V4888',
        'do_not_auto_expand_components',true,
        'budget_reference_kind','whole_dish_retail_reference'
      ),
      updated_at=now()
  where id=v_id;

  -- -------------------------------------------------------------------------
  -- 3. Portion + prix strict whole-dish pour les 4 entrées.
  -- -------------------------------------------------------------------------
  for r in
    select *
    from jsonb_to_recordset(v_data) as x(
      canonical_name text,
      portion_g numeric,
      package_weight_g numeric,
      price_eur numeric,
      source_item_label text,
      source_url text,
      price_detail text
    )
  loop
    v_id := null;
    v_display := null;
    v_country := null;

    select d.id,d.display_name,d.country
      into v_id,v_display,v_country
    from public.food_dictionary d
    where d.normalized_name=public.food_normalize(r.canonical_name)
      and d.enabled=true
    limit 1;

    if v_id is null then
      raise exception 'V488.8 : fiche introuvable après préparation : %',r.canonical_name;
    end if;

    if coalesce(r.portion_g,0)<=0
       or coalesce(r.package_weight_g,0)<=0
       or coalesce(r.price_eur,0)<=0 then
      raise exception 'V488.8 : portion / poids paquet / prix invalide pour %',r.canonical_name;
    end if;

    -- Les 3 variantes doivent avoir leurs macros exactes vérifiées ; Poulet DG
    -- doit déjà disposer de nutrition fiable dans la base.
    if not exists(
      select 1
      from public.food_dictionary d
      left join public.ciqual_foods c on c.code=d.ciqual_code
      where d.id=v_id
        and (
          (d.ciqual_code is not null and c.kcal_100g is not null and c.protein_100g is not null and c.fat_100g is not null and c.carbs_100g is not null)
          or
          (d.custom_kcal_100g is not null and d.custom_protein_100g is not null and d.custom_fat_100g is not null and d.custom_carbs_100g is not null and coalesce(d.nutrition_verified,false)=true)
        )
    ) then
      raise exception 'V488.8 : nutrition non fiable pour %',r.canonical_name;
    end if;

    -- Autorisation planner explicite. Pour les variantes exactes elle existe déjà ;
    -- pour Poulet DG elle a été ajoutée ci-dessus. Les composants restent inchangés.
    update public.food_dictionary
    set adapter_profile=coalesce(adapter_profile,'{}'::jsonb)||jsonb_build_object(
          'composite_complete',true,
          'planner_whole_dish',true,
          'planner_cultural_strict',true,
          'planner_cultural_lot','V4888',
          'budget_reference_kind','whole_dish_retail_reference'
        ),
        updated_at=now()
    where id=v_id;

    insert into public.food_portion_profiles(
      food_dictionary_id,name_pattern,match_mode,unit_label,grams_per_unit,
      default_amount,step,min_amount,estimated,verified,
      source_label,notes,priority,enabled
    ) values (
      v_id,
      v_display,
      'exact',
      'portion',
      r.portion_g,
      1,1,1,
      true,false,
      v_portion_source,
      case
        when r.canonical_name='Harira tomate & lentilles' then
          'Repère planificateur : le produit documente 480 g pour 2 personnes ; 1 portion planner = 240 g. Prix lié au contenant complet de 480 g.'
        else
          'Repère planificateur : format individuel documenté = '||r.portion_g::text||' g. Prix et portion servent au budget ; la nutrition est sourcée séparément lorsque nécessaire.'
      end,
      4,
      true
    );

    insert into public.mt_food_price_reference(
      source_code,food_dictionary_id,ciqual_code,match_term,
      source_item_key,source_item_label,country_code,region_code,
      price_eur,price_basis,eur_per_kg,eur_per_l,unit_price_eur,
      unit_weight_g,density_g_ml,observed_on,confidence,verified,note,updated_at
    ) values (
      'TEE_ADMIN',
      v_id,
      null,
      public.food_normalize(r.canonical_name),
      public.food_normalize(r.source_item_label),
      r.source_item_label,
      'FR',null,
      r.price_eur,
      'package',
      round(r.price_eur*1000/r.package_weight_g,6),
      null,
      r.price_eur,
      r.package_weight_g,
      null,
      '2026-09-09'::date,
      'manual_verified',
      true,
      'V4888_CULTURE_LOT2|Prix whole-dish / contenant complet observé publiquement en France le 2026-09-09. '||
      r.price_detail||'. Prix variable selon magasin/restaurateur/livraison. Aucun prix d''ingrédient n''est utilisé. Source: '||r.source_url,
      now()
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 4. Rafraîchir le registre externe V488.5 et vérifier le lot.
  -- -------------------------------------------------------------------------
  perform public.mt_planner_food_refresh_v1();

  select count(*)::int into v_ready
  from public.mt_planner_ready_foods_v1() x
  join public.food_dictionary d on d.id=x.food_dictionary_id
  where d.normalized_name in (
    public.food_normalize('Poulet DG'),
    public.food_normalize('Mafé poulet & riz'),
    public.food_normalize('Poulet yassa & boulgour'),
    public.food_normalize('Harira tomate & lentilles')
  )
    and coalesce(d.adapter_profile->>'planner_cultural_lot','')='V4888'
    and lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))='true';

  if v_ready<>4 then
    raise exception 'V488.8 : 4 plats culturels strictement prêts attendus, obtenus % ; rollback du bloc',v_ready;
  end if;

  select count(*)::int into v_total_after from public.mt_planner_ready_foods_v1();
  -- Idempotence : au premier passage le total monte normalement de 13 à 17 ;
  -- lors d'une relance, les 4 lignes peuvent déjà être comptées dans v_total_before.
  -- On exige donc seulement qu'aucun candidat externe préexistant ne disparaisse.
  if v_total_after < v_total_before then
    raise exception 'V488.8 : perte inattendue de candidats externes (avant %, après %)',v_total_before,v_total_after;
  end if;
end
$v4888$;

-- ---------------------------------------------------------------------------
-- 5. Résultat unique
-- ---------------------------------------------------------------------------
with culture_names(name) as (values
  ('Poulet DG'),
  ('Mafé poulet & riz'),
  ('Poulet yassa & boulgour'),
  ('Harira tomate & lentilles')
), culture_ready as (
  select r.*
  from public.mt_planner_ready_foods_v1() r
  join public.food_dictionary d on d.id=r.food_dictionary_id
  join culture_names n on d.normalized_name=public.food_normalize(n.name)
  where coalesce(d.adapter_profile->>'planner_cultural_lot','')='V4888'
), examples as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'title',r.title,
    'country',d.country,
    'culture',d.culture,
    'portion_g',r.portion_g,
    'kcal_100g',r.kcal_100g,
    'protein_100g',r.protein_100g,
    'nutrition_source',coalesce(d.nutrition_source_label,'Nutrition Méthode Tee existante'),
    'estimated_cost_eur',round((c.cost->>'total_estimated_eur')::numeric,2),
    'price_source',r.strict_price->>'source_item_label',
    'strict_match_mode',r.strict_price->>'strict_match_mode'
  ) order by r.title),'[]'::jsonb) j
  from culture_ready r
  join public.food_dictionary d on d.id=r.food_dictionary_id
  join public.mt_planner_food_items m
    on m.food_dictionary_id=r.food_dictionary_id and m.enabled
  cross join lateral (
    select public.mt_planner_food_cost_v1(m.planner_id,1,'FR',null) cost
  ) c
)
select jsonb_build_object(
  'status','v4888_cultures_lot2_afrique_maghreb_strict_actif',
  'counts',jsonb_build_object(
    'v4888_strict_ready_cultural',(select count(*) from culture_ready),
    'all_strict_ready_external',(select count(*) from public.mt_planner_ready_foods_v1()),
    'enabled_external_foods',(select count(*) from public.mt_planner_food_items where enabled),
    'unified_catalog_total',(select count(*) from public.mt_planner_recipe_catalog()),
    'v4888_new_dictionary_variants',(
      select count(*) from public.food_dictionary
      where source='Méthode Tee · variante culturelle documentée V488.8'
    ),
    'v4888_existing_dictionary_enriched',(
      select count(*) from public.food_dictionary
      where normalized_name=public.food_normalize('Poulet DG')
        and coalesce(adapter_profile->>'planner_cultural_lot','')='V4888'
    ),
    'v4888_portion_rows',(
      select count(*) from public.food_portion_profiles
      where source_label='Méthode Tee · V488.8 · portion culturelle stricte'
    ),
    'v4888_price_rows',(
      select count(*) from public.mt_food_price_reference
      where note like 'V4888_CULTURE_LOT2|%'
    )
  ),
  'cultural_examples',(select j from examples),
  'held_back_on_purpose',jsonb_build_array(
    jsonb_build_object('name','Ndolè générique','reason','accompagnement/protéine variable : ne pas inventer une composition complète'),
    jsonb_build_object('name','Mafé générique','reason','sauce/composition variable : la variante Mafé poulet & riz est utilisée à la place'),
    jsonb_build_object('name','Yassa générique','reason','accompagnement variable : la variante Poulet yassa & boulgour est utilisée à la place'),
    jsonb_build_object('name','Thiéboudiène / Ceebu jën','reason','source prix trouvée mais portion pondérale stricte encore insuffisamment documentée'),
    jsonb_build_object('name','Kedjenou','reason','portion/prix whole-dish pondéré à documenter'),
    jsonb_build_object('name','Lablabi','reason','portion/prix whole-dish pondéré à documenter')
  ),
  'guards',jsonb_build_object(
    'whole_dish_exact_dictionary_binding',true,
    'legacy_substring_price_used',false,
    'optional_components_promoted',false,
    'generic_incomplete_dishes_forced_complete',false,
    'new_variant_nutrition_verified',true,
    'price_observed_on','2026-09-09',
    'price_max_age_days',120,
    'scoring_changed',false
  ),
  'safety',jsonb_build_object(
    'frontend_changed',false,
    'xcode_build_required',false,
    'recipes_changed',false,
    'ciqual_rows_changed',false,
    'voice_changed',false,
    'protocols_changed',false,
    'existing_planner_scoring_changed',false,
    'food_dictionary_new_rows',3,
    'existing_food_dictionary_profile_changed',true,
    'custom_nutrition_values_added_for_new_variants',true,
    'portion_profiles_changed',true,
    'prices_changed',true
  ),
  'next_step',
    'Envoyer ce JSON. Si v4888_strict_ready_cultural=4, aucun frontend/Xcode supplémentaire : régénérer simplement 30, 45 et 70 euros pour vérifier la présence naturelle des nouveaux plats.'
) as v4888_result;
