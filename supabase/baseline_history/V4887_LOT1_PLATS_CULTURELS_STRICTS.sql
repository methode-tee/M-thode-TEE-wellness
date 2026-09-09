-- ============================================================================
-- MÉTHODE TEE — V488.7
-- LOT 1 · PLATS CULTURELS STRICTS + PONT V488.5
--
-- Pré-requis : V488.5 + V488.6.2 installés.
--
-- Cette migration active uniquement 4 plats culturels/internationaux déjà
-- connus de food_dictionary et disposant d'un produit complet 1 part avec
-- prix public observé en France le 2026-09-08.
--
-- Plats :
--   - Ramen — Japon
--   - Pad thaï — Thaïlande
--   - Soupe wonton — Chine
--   - Tom kha gai — Thaïlande
--
-- Garde-fous :
--   - aucun prix par sous-chaîne/ingrédient ;
--   - prix lié exactement au food_dictionary_id ;
--   - portion = format 1 part documenté ;
--   - nutrition existante conservée (CIQUAL ou nutrition TEE vérifiée) ;
--   - optional_components conservés et jamais promus en composants certains ;
--   - aucun changement recipes / CIQUAL / voice / protocoles.
-- ============================================================================

do $v4887$
declare
  v_data jsonb := $data$
  [
    {
      "canonical_name":"Ramen",
      "portion_g":350,
      "price_eur":4.49,
      "source_item_label":"Soupe ramen Cuisine Evasion PICARD — bol 350 g · 1 part",
      "source_url":"https://www.picard.fr/produits/soupe-ramen-000000000000072426.html",
      "country_expected":"Japon"
    },
    {
      "canonical_name":"Pad thaï",
      "portion_g":350,
      "price_eur":5.70,
      "source_item_label":"Pad thaï PICARD — boîte 350 g · 1 part",
      "source_url":"https://www.picard.fr/produits/pad-thai-000000000000086410.html",
      "country_expected":"Thaïlande"
    },
    {
      "canonical_name":"Soupe wonton",
      "portion_g":350,
      "price_eur":4.59,
      "source_item_label":"Soupe wonton bouillon légumes, raviolis crevettes PICARD — bol 350 g · 1 part",
      "source_url":"https://www.picard.fr/produits/soupe-wonton-000000000000086461.html",
      "country_expected":"Chine"
    },
    {
      "canonical_name":"Tom kha gai",
      "portion_g":350,
      "price_eur":4.60,
      "source_item_label":"Soupe Tom Kha Kaï PICARD — bol 350 g · 1 part",
      "source_url":"https://www.picard.fr/produits/soupe-tom-kha-kai-000000000000086157.html",
      "country_expected":"Thaïlande"
    }
  ]
  $data$::jsonb;

  r record;
  v_id uuid;
  v_display text;
  v_country text;
  v_ready integer;
begin
  -- -------------------------------------------------------------------------
  -- 0. Préflight
  -- -------------------------------------------------------------------------
  if to_regprocedure('public.mt_planner_ready_foods_v1()') is null
     or to_regprocedure('public.mt_planner_food_refresh_v1()') is null
     or to_regprocedure('public.mt_food_price_resolve_whole_dish_v1(uuid,text,text,text,text)') is null
     or to_regprocedure('public.mt_planner_food_cost_v1(uuid,numeric,text,text)') is null then
    raise exception 'V488.7 nécessite V488.5';
  end if;

  if to_regclass('public.mt_planner_food_items') is null
     or to_regclass('public.food_portion_profiles') is null
     or to_regclass('public.mt_food_price_reference') is null then
    raise exception 'V488.7 : tables du pont/prix/portions introuvables';
  end if;

  if not exists(
    select 1 from public.mt_price_sources
    where code='TEE_ADMIN' and enabled
  ) then
    raise exception 'V488.7 : source TEE_ADMIN absente ou désactivée';
  end if;

  -- Nettoyage idempotent UNIQUEMENT du lot V488.7.
  delete from public.mt_food_price_reference
  where note like 'V4887_CULTURE_LOT1|%';

  delete from public.food_portion_profiles p
  using public.food_dictionary d
  where p.food_dictionary_id=d.id
    and p.source_label='Méthode Tee · V488.7 · portion produit culturel 1 part';

  -- -------------------------------------------------------------------------
  -- 1. Enrichissement strict, sans table de stage
  -- -------------------------------------------------------------------------
  for r in
    select *
    from jsonb_to_recordset(v_data) as x(
      canonical_name text,
      portion_g numeric,
      price_eur numeric,
      source_item_label text,
      source_url text,
      country_expected text
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
      raise exception 'V488.7 : plat culturel absent de food_dictionary : %',r.canonical_name;
    end if;

    if public.food_normalize(coalesce(v_country,''))
       <> public.food_normalize(coalesce(r.country_expected,'')) then
      raise exception 'V488.7 : pays inattendu pour % : %',r.canonical_name,v_country;
    end if;

    -- Nutrition : on ne crée/invente aucune macro. On exige une source déjà
    -- complète dans CIQUAL OU les colonnes custom vérifiées existantes.
    if not exists(
      select 1
      from public.food_dictionary d
      left join public.ciqual_foods c on c.code=d.ciqual_code
      where d.id=v_id
        and (
          (
            d.ciqual_code is not null
            and c.kcal_100g is not null
            and c.protein_100g is not null
            and c.fat_100g is not null
            and c.carbs_100g is not null
          )
          or (
            d.custom_kcal_100g is not null
            and d.custom_protein_100g is not null
            and d.custom_fat_100g is not null
            and d.custom_carbs_100g is not null
            and coalesce(d.nutrition_verified,false)=true
          )
        )
    ) then
      raise exception 'V488.7 : nutrition non suffisamment fiable pour %',r.canonical_name;
    end if;

    if coalesce(r.portion_g,0)<=0 or coalesce(r.price_eur,0)<=0 then
      raise exception 'V488.7 : portion/prix invalide pour %',r.canonical_name;
    end if;

    -- On préserve categories, typical_components et optional_components.
    -- Seul le profil reçoit l'autorisation explicite "repas complet planner".
    update public.food_dictionary
    set adapter_profile=coalesce(adapter_profile,'{}'::jsonb)||jsonb_build_object(
          'composite_complete',true,
          'planner_whole_dish',true,
          'planner_cultural_strict',true,
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
      'Méthode Tee · V488.7 · portion produit culturel 1 part',
      'Repère planificateur : format individuel 1 part documenté par le produit de prix ('||
        r.portion_g::text||' g). La nutrition utilisée reste la fiche alimentaire déjà présente dans Méthode Tee ; le produit magasin sert uniquement de repère de portion/prix.',
      5,
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
      round(r.price_eur*1000/r.portion_g,6),
      null,
      r.price_eur,
      r.portion_g,
      null,
      '2026-09-08'::date,
      'manual_verified',
      true,
      'V4887_CULTURE_LOT1|Prix du plat entier 1 part observé sur Picard France le 2026-09-08. Prix variable selon magasin/livraison. Référence budgétaire whole-dish uniquement ; nutrition conservée depuis la base Méthode Tee. Source: '||r.source_url,
      now()
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 2. Rafraîchir le registre externe V488.5
  -- -------------------------------------------------------------------------
  perform public.mt_planner_food_refresh_v1();

  select count(*)::int into v_ready
  from public.mt_planner_ready_foods_v1() x
  join public.food_dictionary d on d.id=x.food_dictionary_id
  where d.normalized_name in (
    public.food_normalize('Ramen'),
    public.food_normalize('Pad thaï'),
    public.food_normalize('Soupe wonton'),
    public.food_normalize('Tom kha gai')
  )
    and lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))='true';

  if v_ready<>4 then
    raise exception 'V488.7 : 4 plats culturels strictement prêts attendus, obtenus %',v_ready;
  end if;
end
$v4887$;

-- ---------------------------------------------------------------------------
-- 3. Résultat unique
-- ---------------------------------------------------------------------------
with culture_names(name) as (values
  ('Ramen'),('Pad thaï'),('Soupe wonton'),('Tom kha gai')
), culture_ready as (
  select r.*
  from public.mt_planner_ready_foods_v1() r
  join public.food_dictionary d on d.id=r.food_dictionary_id
  join culture_names n on d.normalized_name=public.food_normalize(n.name)
), examples as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'title',r.title,
    'country',d.country,
    'portion_g',r.portion_g,
    'kcal_100g',r.kcal_100g,
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
  'status','v4887_scoring_fiable_cultures_lot1_backend_pret',
  'counts',jsonb_build_object(
    'v4887_strict_ready_cultural',(select count(*) from culture_ready),
    'all_strict_ready_external',(select count(*) from public.mt_planner_ready_foods_v1()),
    'enabled_external_foods',(select count(*) from public.mt_planner_food_items where enabled),
    'unified_catalog_total',(select count(*) from public.mt_planner_recipe_catalog()),
    'v4887_portion_rows',(
      select count(*) from public.food_portion_profiles
      where source_label='Méthode Tee · V488.7 · portion produit culturel 1 part'
    ),
    'v4887_price_rows',(
      select count(*) from public.mt_food_price_reference
      where note like 'V4887_CULTURE_LOT1|%'
    )
  ),
  'cultural_examples',(select j from examples),
  'guards',jsonb_build_object(
    'whole_dish_exact_dictionary_binding',true,
    'legacy_substring_price_used',false,
    'optional_components_promoted',false,
    'nutrition_values_modified',false,
    'price_observed_on','2026-09-08',
    'price_max_age_days',120
  ),
  'safety',jsonb_build_object(
    'recipes_changed',false,
    'ciqual_rows_changed',false,
    'voice_changed',false,
    'protocols_changed',false,
    'food_dictionary_profile_changed',true,
    'portion_profiles_changed',true,
    'prices_changed',true,
    'frontend_changed_by_this_sql',false
  ),
  'frontend_patch_required',true,
  'next_step','Envoyer ce JSON. Si v4887_strict_ready_cultural=4, uploader ensuite les 4 fichiers frontend V488.7 puis refaire les semaines 30, 45 et 70 euros.'
) as v4887_result;
