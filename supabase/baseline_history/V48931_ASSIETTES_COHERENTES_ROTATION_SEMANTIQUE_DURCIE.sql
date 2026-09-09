-- MÉTHODE TEE — V489.3.1
-- Assiettes CIQUAL cohérentes + rotation sémantique durcie, sans IA externe.
-- Remplace V489.3 si celui-ci n'a pas encore été appliqué.
-- À appliquer après V489.2.2. Aucune donnée métier n'est réécrite.

begin;

do $$
begin
  if to_regclass('public.mt_planner_recommendation_history') is null
     or to_regprocedure('public.mt_planner_recent_recommendations_v2(integer,integer)') is null
     or to_regprocedure('public.mt_planner_record_generation_v2(numeric,text,numeric,numeric,jsonb)') is null
     or to_regprocedure('public.mt_planner_ciqual_universe_v1()') is null
     or to_regprocedure('public.mt_planner_ciqual_price_batch_v1(text[],text,text)') is null
     or to_regprocedure('public.mt_planner_candidate_meta_v2()') is null
     or to_regprocedure('public.mt_planner_purchase_quote_v2(jsonb,text)') is null
  then
    raise exception 'V48931_PREREQUIS_MANQUANT_APPLIQUER_V48922_AVANT';
  end if;
end $$;

-- Le rôle reste disponible pour les 3 585 lignes, mais les macros seules ne
-- peuvent plus promouvoir un aliment en pilier d'assiette. Le frontend V489.3
-- applique en plus une liste culinaire positive et indépendante.
create or replace function public.mt_ciqual_role_v1(
  p_name text,
  p_kcal numeric,
  p_protein numeric,
  p_fat numeric,
  p_carbs numeric,
  p_fiber numeric
)
returns text
language plpgsql
immutable
as $fn$
declare
  t text:=public.food_normalize(coalesce(p_name,''));
  pr numeric:=coalesce(p_protein,0);
begin
  if t ~ '(^| )(eau|boisson|soda|jus|nectar|cafe|the|biere|vin|cidre|alcool)( |$)'
    then return 'beverage'; end if;
  if t ~ '(^| )(gateau|biscuit|bonbon|chocolat|glace|creme dessert|dessert|viennoiserie|croissant|tarte sucree)( |$)'
    then return 'sweet'; end if;
  if t ~ '(^| )(huile|beurre|margarine|mayonnaise|sauce|vinaigrette|sel|epice|epices|sucre|sirop|miel|condiment|vinaigre|cornichon|pickle|capre|bouillon)( |$)'
    then return 'condiment_fat'; end if;
  if t ~ '(^| )(graine|graines|semence|semences|ail|oignon|oignons|echalote|echalotes|basilic|persil|coriandre|ciboulette|menthe|aneth|thym|romarin|origan|estragon|herbe|herbes)( |$)'
    then return 'aromatic'; end if;
  if t ~ '(^| )(fruit|fruits|specialite de fruit|specialite de fruits|compote|confiture|pomme|poire|banane|orange|mandarine|clementine|citron|fraise|framboise|myrtille|raisin|mangue|ananas|kiwi|peche|abricot|prune|melon|pasteque|figue|datte)( |$)'
    then return 'fruit'; end if;
  if t ~ '(^| )(lait|yaourt|yaourts|fromage blanc|fromages blancs|skyr|skyrs|ricotta|mozzarella|feta|fromage|fromages|camembert|emmental|comte|brie|chevre)( |$)'
    then return 'dairy'; end if;
  if t ~ '(^| )(pizza|lasagne|lasagnes|couscous|paella|cassoulet|hachis|moussaka|choucroute|pot au feu|potee|bourguignon|chili|curry|tajine|risotto|ravioli|quiche|gratin|sandwich|burger|wrap|salade composee|plat compose|plat cuisine|soupe complete)( |$)'
    then return 'composite'; end if;
  -- V489.3.1 : ces produits restent visibles dans CIQUAL et dans la mémoire,
  -- mais ne peuvent jamais devenir automatiquement un pilier d'assiette.
  if t ~ '(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|charcuteries|cordon bleu|cordons bleus|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|hot dog|hot dogs|knack|knacks)( |$)'
    then return 'other'; end if;
  if t ~ '(^| )(lentille|lentilles|pois chiche|pois chiches|haricot blanc|haricots blancs|haricot rouge|haricots rouges|haricot noir|haricots noirs|flageolet|flageolets|tofu|tempeh|seitan)( |$)'
    then return 'protein_plant'; end if;
  if t ~ '(^| )(boeuf|veau|agneau|mouton|porc|jambon|poulet|dinde|canard|lapin|saumon|truite|thon|cabillaud|colin|merlu|lieu|dorade|bar|sardine|maquereau|hareng|anchois|crevette|crevettes|moule|moules|huitre|huitres|calamar|seiche|oeuf|oeufs)( |$)'
     and pr>=5
    then return 'protein'; end if;
  if t ~ '(^| )(riz|pate|pates|spaghetti|nouille|nouilles|vermicelle|macaroni|semoule|couscous grain|boulgour|quinoa|pomme de terre|pommes de terre|patate douce|patates douces|pain|avoine|orge|millet|polenta|sarrasin|plantain)( |$)'
    then return 'starch'; end if;
  if t ~ '(^| )(courgette|courgettes|aubergine|aubergines|tomate|tomates|concombre|concombres|carotte|carottes|poivron|poivrons|brocoli|brocolis|chou|choux|epinard|epinards|salade|laitue|roquette|haricot vert|haricots verts|champignon|champignons|asperge|asperges|poireau|poireaux|betterave|betteraves|fenouil|celeri|navet|navets|courge|courges|potiron|potimarron|artichaut|artichauts|endive|endives|blette|blettes)( |$)'
    then return 'vegetable'; end if;
  return 'other';
end;
$fn$;

-- V3 ajoute les signatures culinaires à la mémoire renvoyée. Les anciennes
-- lignes sans signature restent exploitables par candidate_id.
create or replace function public.mt_planner_recent_recommendations_v3(
  p_days integer default 42,
  p_generations integer default 4
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $fn$
with p as (
  select auth.uid() uid,
         greatest(7,least(coalesce(p_days,42),180)) days,
         greatest(1,least(coalesce(p_generations,4),12)) gens
), h as (
  select r.*
  from public.mt_planner_recommendation_history r,p
  where r.user_id=p.uid
    and r.created_at>=now()-(p.days||' days')::interval
), by_candidate as (
  select candidate_id,max(candidate_title) candidate_title,
         max(nullif(candidate_signature,'')) candidate_signature,
         max(created_at) last_seen,
         count(*) filter(where created_at>=now()-interval '7 days')::int times_7d,
         count(*) filter(where created_at>=now()-interval '28 days')::int times_28d,
         count(*)::int times_window
  from h where candidate_id is not null and not is_leftover
  group by candidate_id
), by_signature as (
  select candidate_signature,max(candidate_title) candidate_title,max(created_at) last_seen,
         count(*) filter(where created_at>=now()-interval '7 days')::int times_7d,
         count(*) filter(where created_at>=now()-interval '28 days')::int times_28d,
         count(*)::int times_window
  from h
  where nullif(candidate_signature,'') is not null and not is_leftover
  group by candidate_signature
), generation_base as (
  select generation_id,max(created_at) created_at,max(budget_eur) budget_eur,max(budget_mode) budget_mode
  from h group by generation_id
), generation_rows as (
  select g.*,
    coalesce((select array_remove(array_agg(hh.candidate_id order by hh.day_index),null) from h hh where hh.generation_id=g.generation_id and not hh.is_leftover),'{}'::uuid[]) candidate_ids,
    coalesce((select array_remove(array_agg(hh.candidate_title order by hh.day_index),null) from h hh where hh.generation_id=g.generation_id and not hh.is_leftover),'{}'::text[]) candidate_titles,
    coalesce((select array_remove(array_agg(hh.candidate_signature order by hh.day_index),null) from h hh where hh.generation_id=g.generation_id and not hh.is_leftover),'{}'::text[]) candidate_signatures,
    coalesce((select array_agg(distinct u.component_key order by u.component_key)
              from h hh cross join lateral unnest(coalesce(hh.component_keys,'{}'::text[])) u(component_key)
              where hh.generation_id=g.generation_id and not hh.is_leftover and nullif(u.component_key,'') is not null),'{}'::text[]) component_keys
  from generation_base g
), recent_generations as (
  select g.* from generation_rows g order by g.created_at desc limit (select gens from p)
), component_counts as (
  select u.component_key,max(h.created_at) last_seen,
         count(*) filter(where h.created_at>=now()-interval '7 days')::int times_7d,
         count(*) filter(where h.created_at>=now()-interval '28 days')::int times_28d,
         count(*)::int times_window
  from h cross join lateral unnest(coalesce(h.component_keys,'{}'::text[])) u(component_key)
  where not h.is_leftover and nullif(u.component_key,'') is not null
  group by u.component_key
), stats as (
  select count(distinct generation_id)::int generations_window,
         count(distinct generation_id) filter(where week_key=date_trunc('week',current_date)::date)::int generations_this_week
  from h
)
select jsonb_build_object(
  'version','V48931_RECO_HISTORY_V3',
  'generations_window',coalesce(s.generations_window,0),
  'generations_this_week',coalesce(s.generations_this_week,0),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
    'candidate_id',candidate_id,'candidate_title',candidate_title,'candidate_signature',candidate_signature,
    'last_seen',last_seen,'times_7d',times_7d,'times_28d',times_28d,'times_window',times_window
  ) order by last_seen desc) from by_candidate),'[]'::jsonb),
  'signature_counts',coalesce((select jsonb_agg(jsonb_build_object(
    'candidate_signature',candidate_signature,'candidate_title',candidate_title,'last_seen',last_seen,
    'times_7d',times_7d,'times_28d',times_28d,'times_window',times_window
  ) order by last_seen desc) from by_signature),'[]'::jsonb),
  'recent_generations',coalesce((select jsonb_agg(jsonb_build_object(
    'generation_id',generation_id,'created_at',created_at,'budget_eur',budget_eur,'budget_mode',budget_mode,
    'candidate_ids',candidate_ids,'candidate_titles',candidate_titles,
    'candidate_signatures',candidate_signatures,'component_keys',component_keys
  ) order by created_at desc) from recent_generations),'[]'::jsonb),
  'component_counts',coalesce((select jsonb_agg(jsonb_build_object(
    'component_key',component_key,'last_seen',last_seen,'times_7d',times_7d,'times_28d',times_28d,'times_window',times_window
  ) order by last_seen desc) from component_counts),'[]'::jsonb)
)
from stats s;
$fn$;

revoke all on function public.mt_planner_recent_recommendations_v3(integer,integer) from public,anon;
grant execute on function public.mt_planner_recent_recommendations_v3(integer,integer) to authenticated;

commit;

select jsonb_build_object(
  'status','v48931_assiettes_coherentes_rotation_semantique_durcie_pret',
  'guards',jsonb_build_object(
    'ciqual_macro_only_role_forbidden',true,
    'fruit_speciality_as_starch_forbidden',true,
    'fennel_seed_as_vegetable_forbidden',true,
    'semantic_rotation_persisted',true,
    'ciqual_dynamic_hard_quota',false,
    'ciqual_assembled_max_per_week',2,
    'processed_products_as_major_components',false,
    'plural_processed_terms_blocked',true,
    'ciqual_price_batch_preflight',true,
    'purchase_quote_preflight',true,
    'external_ai',false
  ),
  'unchanged',jsonb_build_object(
    'ciqual_rows',true,'recipes',true,'historical_meals',true,
    'payments',true,'protocols',true,'voice',true,'phyto_safety',true
  )
) as v48931_result;
