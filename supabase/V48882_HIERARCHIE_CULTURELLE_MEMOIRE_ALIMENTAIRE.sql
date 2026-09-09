-- ============================================================================
-- MÉTHODE TEE — V488.8.2 CUMULATIF
-- HIÉRARCHIE CULTURELLE + MÉMOIRE ALIMENTAIRE PERSONNELLE
--
-- Pré-requis : V488.5 + V488.6.2 + V488.7 + V488.8 installés.
--
-- But :
-- 1) hiérarchiser les plats culturels sans en supprimer :
--    niveau 0 = familier / grand public ;
--    niveau 1 = découverte accessible ;
--    niveau 2 = culturel spécifique / plus complexe par défaut ;
-- 2) permettre au planificateur de lire une mémoire AGRÉGÉE des repas réellement
--    enregistrés dans Ma journée alimentaire, sur 60 jours ;
-- 3) favoriser des plats proches des habitudes sans reproposer exactement les
--    mêmes plats récents ;
-- 4) ne laisser passer qu'une nouveauté réellement éloignée à la fois lorsque
--    la mémoire est suffisamment documentée ;
-- 5) V488.8.1 inclus côté frontend : 100 % chiffrable en budget flexible tant
--    qu'un pool 100 % existe + pas de faux "restes" pour les whole-dish achetés.
--
-- Important : aucune origine supposée depuis le profil utilisateur.
-- La familiarité culturelle n'est dérivée QUE de l'historique alimentaire que
-- l'utilisateur a lui-même enregistré.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. PRÉFLIGHT
-- ---------------------------------------------------------------------------
do $preflight$
begin
  if to_regclass('public.food_meals') is null
     or to_regclass('public.food_meal_items') is null
     or to_regclass('public.food_dictionary') is null
     or to_regclass('public.mt_planner_food_items') is null then
    raise exception 'V488.8.2 : tables alimentation / planificateur manquantes';
  end if;

  if to_regprocedure('public.mt_planner_recipe_catalog()') is null
     or to_regprocedure('public.mt_planner_ready_foods_v1()') is null then
    raise exception 'V488.8.2 nécessite le pont planificateur V488.5+';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. MÉTADONNÉE DE DÉCOUVERTE
--    On ne modifie ni nutrition, ni prix, ni composants.
-- ---------------------------------------------------------------------------

-- Base : les plats externes non culturels restent au premier plan.
update public.food_dictionary d
set adapter_profile=coalesce(d.adapter_profile,'{}'::jsonb) || jsonb_build_object(
      'planner_discovery_level',0,
      'planner_discovery_band','mainstream'
    ),
    updated_at=now()
from public.mt_planner_food_items m
where m.food_dictionary_id=d.id
  and m.enabled=true
  and lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))<>'true'
  and coalesce(d.adapter_profile->>'planner_discovery_level','')='';

-- Tout plat culturel strict sans réglage explicite passe au moins en découverte
-- accessible, jamais automatiquement au premier plan.
update public.food_dictionary d
set adapter_profile=coalesce(d.adapter_profile,'{}'::jsonb) || jsonb_build_object(
      'planner_discovery_level',1,
      'planner_discovery_band','accessible_discovery'
    ),
    updated_at=now()
from public.mt_planner_food_items m
where m.food_dictionary_id=d.id
  and m.enabled=true
  and lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))='true'
  and coalesce(d.adapter_profile->>'planner_discovery_level','')='';

-- Plats internationaux largement familiers : premier plan.
update public.food_dictionary
set adapter_profile=coalesce(adapter_profile,'{}'::jsonb) || jsonb_build_object(
      'planner_discovery_level',0,
      'planner_discovery_band','mainstream'
    ),
    updated_at=now()
where normalized_name in (
  public.food_normalize('Ramen'),
  public.food_normalize('Pad thaï'),
  public.food_normalize('Soupe wonton')
);

-- Découverte accessible : connue ou lisible, mais pas dominante par défaut.
update public.food_dictionary
set adapter_profile=coalesce(adapter_profile,'{}'::jsonb) || jsonb_build_object(
      'planner_discovery_level',1,
      'planner_discovery_band','accessible_discovery'
    ),
    updated_at=now()
where normalized_name in (
  public.food_normalize('Tom kha gai'),
  public.food_normalize('Harira tomate & lentilles'),
  public.food_normalize('Mafé poulet & riz'),
  public.food_normalize('Poulet yassa & boulgour')
);

-- Plat culturel spécifique : second plan par défaut. Il pourra remonter si
-- l'historique alimentaire montre une familiarité réelle avec cette cuisine.
update public.food_dictionary
set adapter_profile=coalesce(adapter_profile,'{}'::jsonb) || jsonb_build_object(
      'planner_discovery_level',2,
      'planner_discovery_band','specific_discovery'
    ),
    updated_at=now()
where normalized_name=public.food_normalize('Poulet DG');

-- ---------------------------------------------------------------------------
-- 2. MÉTADONNÉES COMPACTES DU CATALOGUE POUR LE FRONTEND
--    Signature séparée : mt_planner_recipe_catalog() reste INCHANGÉE.
-- ---------------------------------------------------------------------------
create or replace function public.mt_planner_candidate_meta_v1()
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
      r.id as recipe_id,
      'recipe'::text as source_kind,
      null::uuid as food_dictionary_id,
      null::text as country,
      null::text as culture,
      '{}'::text[] as categories,
      0::integer as discovery_level,
      public.food_normalize(r.title) as normalized_title
    from public.recipes r
    left join public.mt_recipe_planner_profiles pp on pp.recipe_id=r.id
    where r.active=true
      and coalesce(pp.planner_eligible,true)
      and lower(btrim(coalesce(r.meal_type,''))) in (
        'breakfast','bowl','daily','dinner','lunch','meal'
      )
      and public.food_normalize(coalesce(r.category,'')) not in ('apero','aperitif')
  ), external_meta as (
    select
      m.planner_id as recipe_id,
      case
        when lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))='true'
          then 'cultural'
        else 'external'
      end as source_kind,
      d.id as food_dictionary_id,
      d.country,
      d.culture,
      d.categories,
      case
        when coalesce(d.adapter_profile->>'planner_discovery_level','') ~ '^[0-2]$'
          then (d.adapter_profile->>'planner_discovery_level')::integer
        when lower(coalesce(d.adapter_profile->>'planner_cultural_strict','false'))='true'
          then 1
        else 0
      end as discovery_level,
      d.normalized_name as normalized_title
    from public.mt_planner_food_items m
    join public.food_dictionary d on d.id=m.food_dictionary_id
    where m.enabled=true
  )
  select * from recipe_meta
  union all
  select * from external_meta;
$fn$;

revoke all on function public.mt_planner_candidate_meta_v1() from public,anon;
grant execute on function public.mt_planner_candidate_meta_v1() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. MÉMOIRE ALIMENTAIRE AGRÉGÉE
--    Pas de nouvelle table de profil cachée : la mémoire est calculée à partir
--    des entrées déjà enregistrées dans Ma journée alimentaire.
--    - fenêtre max : 90 jours ; défaut : 60 jours ;
--    - repas déjeuner/dîner plus pondérés pour le planificateur ;
--    - récence pondérée ;
--    - aucun texte libre complet n'est renvoyé, uniquement des agrégats courts.
-- ---------------------------------------------------------------------------
create or replace function public.mt_planner_personal_memory_v1(p_days integer default 60)
returns jsonb
language sql
stable
security definer
set search_path=public
as $fn$
  with params as (
    select
      auth.uid() as uid,
      greatest(14,least(coalesce(p_days,60),90))::integer as days
  ), meals as (
    select
      m.id,
      m.meal_date,
      m.meal_type,
      nullif(btrim(m.source_recipe_title),'') as source_recipe_title,
      (
        case
          when m.meal_date>=current_date-6 then 3.0
          when m.meal_date>=current_date-20 then 2.0
          else 1.0
        end
        * case when m.meal_type in ('lunch','dinner') then 1.0 else 0.45 end
      )::numeric as recency_weight
    from public.food_meals m,params p
    where p.uid is not null
      and m.user_id=p.uid
      and m.meal_date between current_date-(p.days-1) and current_date
  ), items as (
    select
      m.id as meal_id,
      m.meal_date,
      m.meal_type,
      m.recency_weight,
      i.food_dictionary_id,
      coalesce(nullif(d.display_name,''),nullif(i.food_name,''),'') as label,
      d.normalized_name as dictionary_normalized_name,
      d.country,
      coalesce(d.categories,'{}'::text[]) as categories,
      coalesce(d.typical_components,'[]'::jsonb) as typical_components
    from meals m
    join public.food_meal_items i on i.meal_id=m.id
    left join public.food_dictionary d on d.id=i.food_dictionary_id
  ), item_text as (
    select
      i.*,
      concat_ws(' ',
        i.label,
        coalesce((
          select string_agg(x,' ')
          from jsonb_array_elements_text(
            case when jsonb_typeof(i.typical_components)='array'
                 then i.typical_components else '[]'::jsonb end
          ) x
        ),'')
      ) as search_text
    from items i
  ), token_events as (
    select
      tok.token,
      i.recency_weight as weight
    from item_text i
    cross join lateral regexp_split_to_table(public.food_normalize(i.search_text),' +') tok(token)
    where length(tok.token)>=3
      and tok.token not in (
        'avec','sans','pour','dans','aux','des','une','les','est','sur','plat','plats',
        'frais','fraiche','fraiches','cuit','cuite','cuits','cuites','cru','crue','maison',
        'portion','preemballe','preemballee','prepare','preparee','type','base','sauce'
      )
  ), token_scores as (
    select token,round(sum(weight),2) as score,count(*)::integer as occurrences
    from token_events
    group by token
  ), top_tokens as (
    select token,score,occurrences
    from token_scores
    order by score desc,occurrences desc,token
    limit 18
  ), category_scores as (
    select cat as category,round(sum(i.recency_weight),2) as score,count(*)::integer as occurrences
    from items i
    cross join lateral unnest(i.categories) c(cat)
    where nullif(btrim(cat),'') is not null
    group by cat
    order by score desc,occurrences desc,cat
    limit 10
  ), country_scores as (
    select
      public.food_normalize(i.country) as country_key,
      max(i.country) as country,
      round(sum(i.recency_weight),2) as score,
      count(*)::integer as occurrences
    from items i
    where nullif(btrim(i.country),'') is not null
    group by public.food_normalize(i.country)
    order by score desc,occurrences desc,country_key
    limit 8
  ), recent_title_values as (
    select public.food_normalize(m.source_recipe_title) as title_key,m.meal_date
    from meals m
    where m.source_recipe_title is not null
      and m.meal_date>=current_date-20
    union all
    select i.dictionary_normalized_name as title_key,i.meal_date
    from items i
    where i.dictionary_normalized_name is not null
      and i.meal_date>=current_date-20
      and i.categories && array['composite_dish']::text[]
  ), recent_titles as (
    select title_key,max(meal_date) as last_seen
    from recent_title_values
    where nullif(title_key,'') is not null
    group by title_key
    order by max(meal_date) desc,title_key
    limit 24
  ), familiar_dictionary as (
    select
      i.food_dictionary_id,
      count(distinct i.meal_id)::integer as meal_count,
      round(sum(i.recency_weight),2) as score
    from items i
    where i.food_dictionary_id is not null
    group by i.food_dictionary_id
    having count(distinct i.meal_id)>=2
    order by score desc,meal_count desc
    limit 24
  ), stats as (
    select
      count(*)::integer as meal_count,
      count(*) filter(where meal_type in ('lunch','dinner'))::integer as planner_meal_count,
      count(distinct meal_date)::integer as days_with_meals,
      count(distinct meal_date) filter(where meal_type in ('lunch','dinner'))::integer as planner_days_with_meals
    from meals
  )
  select jsonb_build_object(
    'version','V48882_MEMORY_V1',
    'window_days',(select days from params),
    'meal_count',s.meal_count,
    'planner_meal_count',s.planner_meal_count,
    'days_with_meals',s.days_with_meals,
    'planner_days_with_meals',s.planner_days_with_meals,
    'active',(s.planner_meal_count>=8 and s.planner_days_with_meals>=4),
    'strong',(s.planner_meal_count>=16 and s.planner_days_with_meals>=7),
    'dominant_tokens',coalesce((
      select jsonb_agg(jsonb_build_object('token',token,'score',score,'occurrences',occurrences)
                       order by score desc,occurrences desc,token)
      from top_tokens
    ),'[]'::jsonb),
    'dominant_categories',coalesce((
      select jsonb_agg(jsonb_build_object('category',category,'score',score,'occurrences',occurrences)
                       order by score desc,occurrences desc,category)
      from category_scores
    ),'[]'::jsonb),
    'dominant_countries',coalesce((
      select jsonb_agg(jsonb_build_object('country_key',country_key,'country',country,'score',score,'occurrences',occurrences)
                       order by score desc,occurrences desc,country_key)
      from country_scores
    ),'[]'::jsonb),
    'recent_titles',coalesce((
      select jsonb_agg(title_key order by last_seen desc,title_key)
      from recent_titles
    ),'[]'::jsonb),
    'familiar_dictionary_ids',coalesce((
      select jsonb_agg(jsonb_build_object('food_dictionary_id',food_dictionary_id,'meal_count',meal_count,'score',score)
                       order by score desc,meal_count desc)
      from familiar_dictionary
    ),'[]'::jsonb)
  )
  from stats s;
$fn$;

revoke all on function public.mt_planner_personal_memory_v1(integer) from public,anon;
grant execute on function public.mt_planner_personal_memory_v1(integer) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 4. RÉSULTAT UNIQUE D'INSTALLATION
-- ---------------------------------------------------------------------------
with bands as (
  select
    case
      when coalesce(d.adapter_profile->>'planner_discovery_level','') ~ '^[0-2]$'
        then (d.adapter_profile->>'planner_discovery_level')::integer
      else null
    end as level,
    count(*)::integer n
  from public.mt_planner_food_items m
  join public.food_dictionary d on d.id=m.food_dictionary_id
  where m.enabled=true
  group by 1
)
select jsonb_build_object(
  'status','v48882_hierarchie_culturelle_memoire_alimentaire_backend_pret',
  'counts',jsonb_build_object(
    'enabled_external_foods',(select count(*) from public.mt_planner_food_items where enabled),
    'level_0_mainstream',coalesce((select n from bands where level=0),0),
    'level_1_accessible_discovery',coalesce((select n from bands where level=1),0),
    'level_2_specific_discovery',coalesce((select n from bands where level=2),0)
  ),
  'functions',jsonb_build_object(
    'candidate_meta',to_regprocedure('public.mt_planner_candidate_meta_v1()') is not null,
    'personal_memory',to_regprocedure('public.mt_planner_personal_memory_v1(integer)') is not null
  ),
  'memory_rules',jsonb_build_object(
    'window_days_default',60,
    'active_after_planner_meals',8,
    'active_after_planner_days',4,
    'strong_after_planner_meals',16,
    'strong_after_planner_days',7,
    'uses_only_logged_food_history',true,
    'infers_ethnicity_or_origin',false,
    'recent_exact_meals_avoided_when_alternatives_exist',true,
    'max_far_novelty_when_familiar_alternatives_exist',1
  ),
  'ranking_rules',jsonb_build_object(
    'mainstream_first_plan',true,
    'accessible_discovery_secondary',true,
    'specific_discovery_secondary',true,
    'specific_can_be_promoted_by_logged_familiarity',true,
    'v48881_flexible_requires_100_when_available',true,
    'v48881_whole_dish_not_reused_as_leftovers',true
  ),
  'safety',jsonb_build_object(
    'prices_changed',false,
    'nutrition_changed',false,
    'recipes_changed',false,
    'ciqual_rows_changed',false,
    'voice_changed',false,
    'protocols_changed',false,
    'food_dictionary_adapter_profile_changed',true,
    'frontend_changed_by_this_sql',false
  ),
  'frontend_patch_required',true,
  'xcode_build_required_for_native_app',true,
  'next_step','Envoyer ce JSON. Si les deux fonctions sont true, uploader les 2 fichiers tee-next.js V488.8.2 puis faire le sync/build Xcode.'
) as v48882_result;
