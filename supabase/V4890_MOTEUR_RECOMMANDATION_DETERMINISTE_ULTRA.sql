-- ============================================================================
-- MÉTHODE TEE — V489.0
-- MOTEUR DE RECOMMANDATION DÉTERMINISTE ULTRA · SANS IA EXTERNE
--
-- Objectifs :
-- - optimiser la semaine entière plutôt que choisir jour après jour ;
-- - séparer budget, mémoire, diversité, rotation et fiabilité ;
-- - mémoriser les recommandations pour éviter les mêmes 7 gagnants ;
-- - qualifier protéines/féculents/techniques/formats/cuisines ;
-- - chiffrer TOUS les candidats du catalogue par lots de 60 via le batch V1 ;
-- - introduire une couche « format magasin » exacte quand elle existe ;
-- - ne jamais considérer un coût inconnu comme 0 ;
-- - garder tout le cerveau historique V441/V474/V488.8.x intact.
--
-- IMPORTANT :
-- - aucun contenu de protocole, paiement, nutrition CIQUAL, voix ou recette modifié ;
-- - les 3 anciennes migrations absentes du dépôt sont archivées séparément dans
--   baseline_history/ pour rendre la chaîne du planificateur reconstructible.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. PRÉFLIGHT
-- ---------------------------------------------------------------------------
do $preflight$
begin
  if to_regclass('public.mt_planner_preferences') is null
     or to_regprocedure('public.mt_planner_recipe_catalog()') is null
     or to_regprocedure('public.mt_recipe_cost_batch_v1(uuid[],numeric,text,text)') is null
     or to_regprocedure('public.mt_planner_candidate_meta_v1()') is null
     or to_regprocedure('public.mt_planner_personal_memory_v1(integer)') is null then
    raise exception 'V489.0 : prérequis planificateur V488.8.x manquants';
  end if;

  if to_regclass('public.mt_food_price_reference') is null
     or to_regclass('public.food_dictionary') is null then
    raise exception 'V489.0 : couche prix / dictionnaire manquante';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. MODE D'UTILISATION DU BUDGET
--    Le montant seul ne dit plus si l'utilisateur veut économiser ou exploiter
--    son enveloppe. On sépare donc montant et intention.
-- ---------------------------------------------------------------------------
alter table public.mt_planner_preferences
  add column if not exists budget_mode text not null default 'balanced';

update public.mt_planner_preferences
set budget_mode='balanced'
where budget_mode is null or budget_mode not in ('save','balanced','variety');

do $constraint$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='mt_planner_preferences_budget_mode_check'
      and conrelid='public.mt_planner_preferences'::regclass
  ) then
    alter table public.mt_planner_preferences
      add constraint mt_planner_preferences_budget_mode_check
      check (budget_mode in ('save','balanced','variety'));
  end if;
end
$constraint$;

-- ---------------------------------------------------------------------------
-- 2. MÉTADONNÉES CANDIDATS : OVERRIDES ADMIN + INFÉRENCE DÉTERMINISTE
-- ---------------------------------------------------------------------------
create table if not exists public.mt_planner_candidate_traits(
  candidate_id uuid primary key,
  protein_family text,
  starch_family text,
  vegetable_family text,
  dish_format text,
  cooking_technique text,
  cuisine_family text,
  complete_meal boolean,
  leftover_compatible boolean,
  difficulty text,
  prep_minutes integer check(prep_minutes is null or prep_minutes between 0 and 600),
  season_tags text[] not null default '{}',
  source text not null default 'manual_override',
  note text,
  updated_at timestamptz not null default now()
);

alter table public.mt_planner_candidate_traits enable row level security;
drop policy if exists "planner traits read" on public.mt_planner_candidate_traits;
create policy "planner traits read" on public.mt_planner_candidate_traits
  for select to authenticated using(true);
drop policy if exists "planner traits admin" on public.mt_planner_candidate_traits;
create policy "planner traits admin" on public.mt_planner_candidate_traits
  for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.mt_planner_candidate_traits_v1()
returns table(
  candidate_id uuid,
  protein_family text,
  starch_family text,
  vegetable_family text,
  dish_format text,
  cooking_technique text,
  cuisine_family text,
  complete_meal boolean,
  leftover_compatible boolean,
  difficulty text,
  prep_minutes integer,
  season_tags text[],
  traits_source text
)
language sql
stable
security definer
set search_path=public
as $fn$
with base as (
  select
    c.recipe_id candidate_id,
    c.title,
    c.subtitle,
    c.meal_type,
    c.ingredients,
    m.source_kind,
    m.food_dictionary_id,
    m.country,
    m.categories,
    d.adapter_profile,
    d.typical_components,
    public.food_normalize(concat_ws(' ',
      c.title,c.subtitle,c.meal_type,array_to_string(c.ingredients,' '),
      coalesce(d.display_name,''),coalesce(d.country,''),
      coalesce((select string_agg(x,' ') from jsonb_array_elements_text(
        case when jsonb_typeof(coalesce(d.typical_components,'[]'::jsonb))='array'
             then coalesce(d.typical_components,'[]'::jsonb) else '[]'::jsonb end
      ) x),'')
    )) txt
  from public.mt_planner_recipe_catalog() c
  left join public.mt_planner_candidate_meta_v1() m on m.recipe_id=c.recipe_id
  left join public.food_dictionary d on d.id=m.food_dictionary_id
), inferred as (
  select
    b.*,
    case
      when txt ~ '(^| )(boeuf|steak|bourguignon|kefta|hachis)( |$)' then 'beef'
      when txt ~ '(^| )(poulet|dinde|volaille|chicken|gai)( |$)' then 'poultry'
      when txt ~ '(^| )(poisson|saumon|truite|thon|crevette|crevettes|wonton)( |$)' then 'fish_seafood'
      when txt ~ '(^| )(oeuf|oeufs)( |$)' then 'egg'
      when txt ~ '(^| )(tofu|lentille|lentilles|pois chiche|pois chiches|haricot|haricots)( |$)' then 'plant'
      else 'mixed_unknown'
    end protein_auto,
    case
      when txt ~ '(^| )(riz|paella)( |$)' then 'rice'
      when txt ~ '(^| )(ramen|nouille|nouilles|pate|pates|pasta|pad thai)( |$)' then 'pasta_noodle'
      when txt ~ '(^| )(pomme de terre|pommes de terre|hachis)( |$)' then 'potato'
      when txt ~ '(^| )(couscous|semoule|boulgour)( |$)' then 'semolina_bulgur'
      when txt ~ '(^| )(pain|tartine)( |$)' then 'bread'
      when txt ~ '(^| )(plantain|banane plantain)( |$)' then 'plantain'
      when txt ~ '(^| )(lentille|lentilles|pois chiche|pois chiches|haricot|haricots)( |$)' then 'legume'
      else 'other_none'
    end starch_auto,
    case
      when txt ~ '(^| )(roquette|epinard|salade|feuille|feuilles)( |$)' then 'leafy'
      when txt ~ '(^| )(carotte|betterave|pomme de terre|patate)( |$)' then 'root'
      when (coalesce(categories,'{}'::text[]) && array['vegetable']::text[])
           or txt ~ '(^| )(legume|legumes|tomate|courgette|concombre|poivron|aubergine)( |$)' then 'mixed_vegetables'
      else 'unknown_none'
    end vegetable_auto,
    case
      when txt ~ '(^| )(salade)( |$)' then 'salad'
      when txt ~ '(^| )(bowl)( |$)' then 'bowl'
      when txt ~ '(^| )(soupe|ramen|harira|tom kha)( |$)' then 'soup'
      when txt ~ '(^| )(tartine|sandwich|wrap)( |$)' then 'sandwich_toast'
      when txt ~ '(^| )(pate|pates|pasta|nouille|nouilles)( |$)' then 'pasta'
      when txt ~ '(^| )(bourguignon|cassoulet|potee|tajine|mafe|yassa)( |$)' then 'stew_plate'
      else 'plate'
    end format_auto,
    case
      when txt ~ '(^| )(soupe|ramen|harira|tom kha)( |$)' then 'soup'
      when txt ~ '(^| )(bourguignon|cassoulet|potee|mijote|mijotee|tajine|mafe|yassa)( |$)' then 'stew'
      when txt ~ '(^| )(frit|frite|friture|tempura)( |$)' then 'fried'
      when txt ~ '(^| )(grille|grillee|grill)( |$)' then 'grilled'
      when txt ~ '(^| )(four|gratin|moussaka|hachis)( |$)' then 'baked'
      when txt ~ '(^| )(salade|cru|crue)( |$)' then 'cold_raw'
      else 'mixed'
    end technique_auto,
    case
      when public.food_normalize(coalesce(country,'')) in ('japon','chine','thailande','coree du sud','vietnam') then 'east_southeast_asia'
      when public.food_normalize(coalesce(country,'')) in ('maroc','tunisie','algerie') then 'maghreb'
      when public.food_normalize(coalesce(country,'')) in ('senegal','cote d ivoire','mali','ghana','nigeria') then 'west_africa'
      when public.food_normalize(coalesce(country,'')) in ('cameroun','rdc','republique democratique du congo','congo') then 'central_africa'
      when public.food_normalize(coalesce(country,'')) in ('france','italie','espagne','grece','allemagne','belgique') then 'europe'
      when nullif(btrim(country),'') is not null then public.food_normalize(country)
      else 'tee_general'
    end cuisine_auto
  from base b
)
select
  i.candidate_id,
  coalesce(t.protein_family,i.protein_auto),
  coalesce(t.starch_family,i.starch_auto),
  coalesce(t.vegetable_family,i.vegetable_auto),
  coalesce(t.dish_format,i.format_auto),
  coalesce(t.cooking_technique,i.technique_auto),
  coalesce(t.cuisine_family,i.cuisine_auto),
  coalesce(t.complete_meal,
    case
      when lower(coalesce(i.adapter_profile->>'composite_complete','false'))='true' then true
      when i.meal_type in ('lunch','dinner','meal','bowl') and cardinality(i.ingredients)>=3 then true
      else false
    end
  ),
  coalesce(t.leftover_compatible,
    case when coalesce(i.source_kind,'recipe')='recipe' and i.technique_auto not in ('cold_raw') then true else false end
  ),
  t.difficulty,
  t.prep_minutes,
  coalesce(t.season_tags,'{}'::text[]),
  case when t.candidate_id is not null then 'manual_override' else 'deterministic_inference' end
from inferred i
left join public.mt_planner_candidate_traits t on t.candidate_id=i.candidate_id;
$fn$;

revoke all on function public.mt_planner_candidate_traits_v1() from public,anon;
grant execute on function public.mt_planner_candidate_traits_v1() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. CHIFFRAGE DE TOUT LE CATALOGUE : WRAPPER PAR LOTS DE 60
--    Le V1 garde sa signature et son dispatch strict V488.5. Le V2 le réutilise.
-- ---------------------------------------------------------------------------
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
  while v_i<=v_n loop
    v_chunk:=p_recipe_ids[v_i:least(v_i+59,v_n)];
    return query
      select b.recipe_id,b.cost
      from public.mt_recipe_cost_batch_v1(v_chunk,p_servings,p_country,p_region) b;
    v_i:=v_i+60;
  end loop;
end;
$fn$;

revoke all on function public.mt_recipe_cost_batch_v2(uuid[],numeric,text,text) from public,anon;
grant execute on function public.mt_recipe_cost_batch_v2(uuid[],numeric,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. MÉMOIRE DES RECOMMANDATIONS / ROTATION DÉTERMINISTE
-- ---------------------------------------------------------------------------
create table if not exists public.mt_planner_recommendation_history(
  id bigserial primary key,
  generation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key date not null,
  budget_eur numeric,
  budget_mode text not null default 'balanced',
  candidate_id uuid,
  candidate_title text,
  day_index integer not null check(day_index between 0 and 6),
  is_leftover boolean not null default false,
  generation_score numeric,
  estimated_cost_eur numeric,
  created_at timestamptz not null default now(),
  unique(generation_id,day_index)
);

create index if not exists mt_planner_reco_user_date_idx
  on public.mt_planner_recommendation_history(user_id,created_at desc);
create index if not exists mt_planner_reco_user_candidate_idx
  on public.mt_planner_recommendation_history(user_id,candidate_id,created_at desc);

alter table public.mt_planner_recommendation_history enable row level security;
drop policy if exists "planner reco owner" on public.mt_planner_recommendation_history;
create policy "planner reco owner" on public.mt_planner_recommendation_history
  for select to authenticated using(auth.uid()=user_id or public.is_admin());

create or replace function public.mt_planner_recent_recommendations_v1(p_days integer default 42)
returns jsonb
language sql
stable
security definer
set search_path=public
as $fn$
with p as (
  select auth.uid() uid,greatest(7,least(coalesce(p_days,42),180)) days
), h as (
  select r.*
  from public.mt_planner_recommendation_history r,p
  where r.user_id=p.uid
    and r.created_at>=now()-(p.days||' days')::interval
), by_candidate as (
  select
    candidate_id,
    max(candidate_title) candidate_title,
    max(created_at) last_seen,
    count(*) filter(where created_at>=now()-interval '7 days')::int times_7d,
    count(*) filter(where created_at>=now()-interval '28 days')::int times_28d,
    count(*)::int times_window
  from h
  where candidate_id is not null and not is_leftover
  group by candidate_id
), stats as (
  select
    count(distinct generation_id)::int generations_window,
    count(distinct generation_id) filter(
      where week_key=date_trunc('week',current_date)::date
    )::int generations_this_week
  from h
)
select jsonb_build_object(
  'version','V4890_RECO_HISTORY_V1',
  'generations_window',coalesce(s.generations_window,0),
  'generations_this_week',coalesce(s.generations_this_week,0),
  'items',coalesce((
    select jsonb_agg(jsonb_build_object(
      'candidate_id',candidate_id,
      'candidate_title',candidate_title,
      'last_seen',last_seen,
      'times_7d',times_7d,
      'times_28d',times_28d,
      'times_window',times_window
    ) order by last_seen desc)
    from by_candidate
  ),'[]'::jsonb)
)
from stats s;
$fn$;

revoke all on function public.mt_planner_recent_recommendations_v1(integer) from public,anon;
grant execute on function public.mt_planner_recent_recommendations_v1(integer) to authenticated;

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
  if coalesce(p_budget_mode,'balanced') not in ('save','balanced','variety') then
    raise exception 'INVALID_BUDGET_MODE';
  end if;

  for r in
    select * from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(
      day_index integer,candidate_id uuid,candidate_title text,is_leftover boolean
    )
  loop
    if r.day_index between 0 and 6 then
      insert into public.mt_planner_recommendation_history(
        generation_id,user_id,week_key,budget_eur,budget_mode,
        candidate_id,candidate_title,day_index,is_leftover,
        generation_score,estimated_cost_eur
      ) values (
        v_gen,v_uid,v_week,p_budget_eur,coalesce(p_budget_mode,'balanced'),
        r.candidate_id,r.candidate_title,r.day_index,coalesce(r.is_leftover,false),
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

-- ---------------------------------------------------------------------------
-- 5. FORMAT MAGASIN EXACT QUAND DOCUMENTÉ
--    Aucun format n'est inventé. On importe seulement les prix package exacts,
--    vérifiés et pondérés déjà présents dans mt_food_price_reference.
-- ---------------------------------------------------------------------------
create table if not exists public.mt_food_purchase_format_reference(
  id uuid primary key default gen_random_uuid(),
  food_dictionary_id uuid references public.food_dictionary(id) on delete cascade,
  match_term text,
  package_label text not null,
  package_weight_g numeric not null check(package_weight_g>0),
  package_price_eur numeric not null check(package_price_eur>0),
  source_reference_id uuid unique,
  country_code text not null default 'FR',
  observed_on date not null,
  verified boolean not null default false,
  enabled boolean not null default true,
  note text,
  updated_at timestamptz not null default now(),
  check(food_dictionary_id is not null or nullif(btrim(match_term),'') is not null)
);

create index if not exists mt_purchase_format_dictionary_idx
  on public.mt_food_purchase_format_reference(food_dictionary_id,country_code,observed_on desc);

alter table public.mt_food_purchase_format_reference enable row level security;
drop policy if exists "purchase formats read" on public.mt_food_purchase_format_reference;
create policy "purchase formats read" on public.mt_food_purchase_format_reference
  for select to authenticated using(enabled or public.is_admin());
drop policy if exists "purchase formats admin" on public.mt_food_purchase_format_reference;
create policy "purchase formats admin" on public.mt_food_purchase_format_reference
  for all to authenticated using(public.is_admin()) with check(public.is_admin());

insert into public.mt_food_purchase_format_reference(
  food_dictionary_id,match_term,package_label,package_weight_g,package_price_eur,
  source_reference_id,country_code,observed_on,verified,enabled,note,updated_at
)
select
  p.food_dictionary_id,
  p.match_term,
  p.source_item_label,
  p.unit_weight_g,
  coalesce(p.unit_price_eur,p.price_eur),
  p.id,
  p.country_code,
  p.observed_on,
  p.verified,
  true,
  'V4890_AUTO_FROM_EXACT_PACKAGE_PRICE_REFERENCE',
  now()
from public.mt_food_price_reference p
where p.price_basis='package'
  and p.unit_weight_g is not null and p.unit_weight_g>0
  and coalesce(p.unit_price_eur,p.price_eur)>0
  and p.verified=true
on conflict(source_reference_id) do update set
  package_label=excluded.package_label,
  package_weight_g=excluded.package_weight_g,
  package_price_eur=excluded.package_price_eur,
  observed_on=excluded.observed_on,
  verified=excluded.verified,
  enabled=true,
  updated_at=now();

create or replace function public.mt_planner_purchase_quote_v1(
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
  r record;
  f record;
  v_items jsonb:='[]'::jsonb;
  v_estimated numeric:=0;
  v_package_total numeric:=0;
  v_known integer:=0;
  v_package_known integer:=0;
  v_total integer:=0;
  v_unknown integer:=0;
  v_packages integer;
  v_cost numeric;
begin
  for r in
    select * from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(
      food_dictionary_id uuid,
      ingredient_name text,
      quantity_g numeric,
      consumed_cost_eur numeric
    )
  loop
    v_total:=v_total+1;

    select pf.* into f
    from public.mt_food_purchase_format_reference pf
    where pf.enabled=true and pf.verified=true
      and pf.country_code=upper(coalesce(nullif(trim(p_country),''),'FR'))
      and (current_date-pf.observed_on)<=120
      and (
        (r.food_dictionary_id is not null and pf.food_dictionary_id=r.food_dictionary_id)
        or (
          r.food_dictionary_id is null
          and nullif(public.food_normalize(r.ingredient_name),'') is not null
          and pf.match_term=public.food_normalize(r.ingredient_name)
        )
      )
    order by
      case when r.food_dictionary_id is not null and pf.food_dictionary_id=r.food_dictionary_id then 0 else 1 end,
      pf.observed_on desc,pf.updated_at desc
    limit 1;

    if f.id is not null and coalesce(r.quantity_g,0)>0 then
      v_packages:=ceil(r.quantity_g/f.package_weight_g)::integer;
      v_cost:=round(v_packages*f.package_price_eur,2);
      v_estimated:=v_estimated+v_cost;
      v_package_total:=v_package_total+v_cost;
      v_known:=v_known+1;
      v_package_known:=v_package_known+1;
      v_items:=v_items||jsonb_build_array(jsonb_build_object(
        'ingredient_name',r.ingredient_name,
        'dictionary_id',r.food_dictionary_id,
        'quantity_g',r.quantity_g,
        'pricing_mode','exact_package',
        'package_label',f.package_label,
        'package_weight_g',f.package_weight_g,
        'package_price_eur',f.package_price_eur,
        'packages',v_packages,
        'estimated_purchase_eur',v_cost,
        'observed_on',f.observed_on
      ));
    elsif r.consumed_cost_eur is not null then
      v_estimated:=v_estimated+r.consumed_cost_eur;
      v_known:=v_known+1;
      v_items:=v_items||jsonb_build_array(jsonb_build_object(
        'ingredient_name',r.ingredient_name,
        'dictionary_id',r.food_dictionary_id,
        'quantity_g',r.quantity_g,
        'pricing_mode','consumed_quantity_fallback',
        'estimated_purchase_eur',r.consumed_cost_eur
      ));
    else
      v_unknown:=v_unknown+1;
      v_items:=v_items||jsonb_build_array(jsonb_build_object(
        'ingredient_name',r.ingredient_name,
        'dictionary_id',r.food_dictionary_id,
        'quantity_g',r.quantity_g,
        'pricing_mode','unknown'
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'status','v4890_purchase_quote',
    'estimated_total_eur',round(v_estimated,2),
    'strict_package_total_eur',round(v_package_total,2),
    'total_items',v_total,
    'known_items',v_known,
    'unknown_items',v_unknown,
    'known_coverage_pct',case when v_total=0 then 100 else round(v_known::numeric/v_total*100)::int end,
    'package_coverage_pct',case when v_total=0 then 100 else round(v_package_known::numeric/v_total*100)::int end,
    'items',v_items,
    'unknown_is_zero',false
  );
end;
$fn$;

revoke all on function public.mt_planner_purchase_quote_v1(jsonb,text) from public,anon;
grant execute on function public.mt_planner_purchase_quote_v1(jsonb,text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- 6. RÉSULTAT D'INSTALLATION
-- ---------------------------------------------------------------------------
select jsonb_build_object(
  'status','v4890_moteur_recommandation_deterministe_ultra_backend_pret',
  'architecture',jsonb_build_object(
    'weekly_optimizer_frontend_required',true,
    'candidate_traits_rpc',to_regprocedure('public.mt_planner_candidate_traits_v1()') is not null,
    'all_catalog_cost_batch',to_regprocedure('public.mt_recipe_cost_batch_v2(uuid[],numeric,text,text)') is not null,
    'recommendation_memory_rpc',to_regprocedure('public.mt_planner_recent_recommendations_v1(integer)') is not null,
    'recommendation_record_rpc',to_regprocedure('public.mt_planner_record_generation_v1(numeric,text,numeric,numeric,jsonb)') is not null,
    'purchase_quote_rpc',to_regprocedure('public.mt_planner_purchase_quote_v1(jsonb,text)') is not null
  ),
  'counts',jsonb_build_object(
    'catalog_candidates',(select count(*) from public.mt_planner_recipe_catalog()),
    'candidate_trait_overrides',(select count(*) from public.mt_planner_candidate_traits),
    'exact_purchase_formats',(select count(*) from public.mt_food_purchase_format_reference where enabled and verified)
  ),
  'budget_modes',jsonb_build_array('save','balanced','variety'),
  'guards',jsonb_build_object(
    'unknown_price_becomes_zero',false,
    'external_ai_required',false,
    'price_reliability_before_memory',true,
    'weekly_global_optimization',true,
    'recommendation_rotation_persistent',true,
    'specific_cultural_default_max_per_week',1,
    'historical_brain_reused',true
  ),
  'safety',jsonb_build_object(
    'payments_changed',false,
    'protocol_content_changed',false,
    'voice_changed',false,
    'ciqual_rows_changed',false,
    'recipes_changed',false,
    'existing_food_price_rows_rewritten',false
  ),
  'next_step','Envoyer ce JSON. Puis uploader les 4 fichiers frontend V489.0 et tester 30/45/70 avec les 3 modes budget.'
) as v4890_result;
