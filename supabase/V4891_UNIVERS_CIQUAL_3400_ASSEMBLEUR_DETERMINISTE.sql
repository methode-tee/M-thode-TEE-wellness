-- ============================================================================
-- MÉTHODE TEE — V489.1
-- UNIVERS CIQUAL COMPLET + ASSEMBLEUR DÉTERMINISTE · SANS IA EXTERNE
--
-- Principe fondamental :
--   * le cerveau TEE voit TOUTES les références CIQUAL disponibles ;
--   * une référence alimentaire n'est pas automatiquement un "repas" ;
--   * les aliments simples deviennent des briques de composition ;
--   * les plats composés plausibles peuvent devenir des candidats directs ;
--   * le frontend assemble des repas complets à partir des briques fiables ;
--   * aucun prix inconnu n'est transformé en zéro.
--
-- V489.1 ne modifie aucune ligne CIQUAL, recette, protocole, paiement ou mémoire.
-- ============================================================================

begin;

do $preflight$
begin
  if to_regclass('public.ciqual_foods') is null then
    raise exception 'V489.1 : ciqual_foods introuvable';
  end if;
  if to_regclass('public.food_dictionary') is null then
    raise exception 'V489.1 : food_dictionary introuvable';
  end if;
  if to_regprocedure('public.mt_food_price_resolve_legacy_v2(uuid,text,text,text,text)') is null then
    raise exception 'V489.1 : mt_food_price_resolve_legacy_v2 manquant';
  end if;
end
$preflight$;

-- UUID stable à partir d'un texte, pour pouvoir mémoriser aussi les repas
-- assemblés sans créer des lignes artificielles dans recipes.
create or replace function public.mt_uuid_from_text_v1(p_text text)
returns uuid
language sql
immutable
strict
as $fn$
  select (
    substr(md5(p_text),1,8)||'-'||
    substr(md5(p_text),9,4)||'-'||
    '4'||substr(md5(p_text),14,3)||'-'||
    '8'||substr(md5(p_text),18,3)||'-'||
    substr(md5(p_text),21,12)
  )::uuid;
$fn$;

-- Classification déterministe. Le but n'est pas de remplacer CIQUAL mais de
-- donner au planificateur un rôle culinaire exploitable pour CHAQUE référence.
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
  ca numeric:=coalesce(p_carbs,0);
  fi numeric:=coalesce(p_fiber,0);
  kc numeric:=coalesce(p_kcal,0);
begin
  if t ~ '(^| )(eau|boisson|soda|jus|nectar|cafe|the|biere|vin|cidre|alcool)( |$)' then return 'beverage'; end if;
  if t ~ '(^| )(huile|beurre|margarine|mayonnaise|sauce|vinaigrette|sel|epice|epices|sucre|sirop|miel|condiment)( |$)' then return 'condiment_fat'; end if;
  if t ~ '(^| )(gateau|biscuit|bonbon|chocolat|glace|creme dessert|dessert|viennoiserie|croissant|tarte sucree)( |$)' then return 'sweet'; end if;
  if t ~ '(^| )(pizza|lasagne|lasagnes|couscous|paella|cassoulet|hachis|moussaka|choucroute|pot au feu|potee|bourguignon|chili|curry|tajine|risotto|ravioli|quiche|gratin|sandwich|burger|wrap|salade composee|plat compose|plat cuisine|soupe complete)( |$)' then return 'composite'; end if;
  if t ~ '(^| )(lentille|lentilles|pois chiche|pois chiches|haricot|haricots|tofu|tempeh|seitan)( |$)' then return 'protein_plant'; end if;
  if t ~ '(^| )(boeuf|veau|agneau|mouton|porc|poulet|dinde|canard|lapin|saumon|truite|thon|cabillaud|colin|merlu|sardine|maquereau|crevette|crevettes|moule|moules|oeuf|oeufs)( |$)' and pr>=7 then return 'protein'; end if;
  if pr>=13 and ca<=18 then return 'protein'; end if;
  if t ~ '(^| )(riz|pate|pates|spaghetti|nouille|nouilles|semoule|couscous grain|boulgour|quinoa|pomme de terre|pommes de terre|patate douce|pain|avoine|orge|ble|mais|polenta|millet|sarrasin)( |$)' then return 'starch'; end if;
  if ca>=18 and pr<13 and kc>=90 and not (t ~ '(^| )(fruit|compote|confiture)( |$)') then return 'starch'; end if;
  if t ~ '(^| )(pomme|poire|banane|orange|mandarine|clementine|citron|fraise|framboise|myrtille|raisin|mangue|ananas|kiwi|peche|abricot|prune|melon|pasteque|figue|datte)( |$)' then return 'fruit'; end if;
  if t ~ '(^| )(lait|yaourt|fromage blanc|skyr|ricotta|mozzarella|feta|fromage)( |$)' then return 'dairy'; end if;
  if t ~ '(^| )(courgette|aubergine|tomate|concombre|carotte|poivron|brocoli|chou|epinard|salade|roquette|haricot vert|champignon|asperge|poireau|oignon|betterave|fenouil|celeri|navet|courge|potiron)( |$)' then return 'vegetable'; end if;
  if kc<=95 and ca<=16 and pr<=8 and fi>=1 then return 'vegetable'; end if;
  return 'other';
end;
$fn$;

-- Univers complet : aucune limite 32/60/500. Il reflète la table CIQUAL vivante.
create or replace function public.mt_planner_ciqual_universe_v1()
returns table(
  universe_id uuid,
  ciqual_code text,
  name text,
  role text,
  kcal_100g numeric,
  protein_100g numeric,
  fat_100g numeric,
  carbs_100g numeric,
  fiber_100g numeric,
  salt_100g numeric,
  food_dictionary_id uuid,
  display_name text,
  country text,
  categories text[],
  adapter_profile jsonb,
  source text
)
language sql
stable
security definer
set search_path=public
as $fn$
select
  public.mt_uuid_from_text_v1('CIQUAL:'||c.code) universe_id,
  c.code,
  c.name,
  public.mt_ciqual_role_v1(c.name,c.kcal_100g,c.protein_100g,c.fat_100g,c.carbs_100g,c.fiber_100g),
  c.kcal_100g,c.protein_100g,c.fat_100g,c.carbs_100g,c.fiber_100g,c.salt_100g,
  d.id,
  coalesce(d.display_name,c.name),
  d.country,
  coalesce(d.categories,'{}'::text[]),
  coalesce(d.adapter_profile,'{}'::jsonb),
  coalesce(c.source,'CIQUAL')
from public.ciqual_foods c
left join lateral (
  select fd.*
  from public.food_dictionary fd
  where fd.enabled=true and fd.ciqual_code=c.code
  order by fd.priority asc,fd.updated_at desc
  limit 1
) d on true
order by c.code;
$fn$;

revoke all on function public.mt_planner_ciqual_universe_v1() from public,anon;
grant execute on function public.mt_planner_ciqual_universe_v1() to authenticated;

-- Prix par lots uniquement pour la shortlist retenue par le cerveau.
-- On réutilise le resolver V488.3 : exact CIQUAL/dictionnaire en priorité, puis
-- compatibilité legacy pour les ingrédients simples. Aucun coût inconnu = 0.
create or replace function public.mt_planner_ciqual_price_batch_v1(
  p_ciqual_codes text[],
  p_country text default 'FR',
  p_region text default null
)
returns table(ciqual_code text,price jsonb)
language sql
stable
security definer
set search_path=public
as $fn$
with wanted as (
  select distinct x code
  from unnest(coalesce(p_ciqual_codes,'{}'::text[])) x
  where nullif(btrim(x),'') is not null
), b as (
  select
    c.code,
    c.name,
    d.id dictionary_id
  from wanted w
  join public.ciqual_foods c on c.code=w.code
  left join lateral (
    select fd.id
    from public.food_dictionary fd
    where fd.enabled=true and fd.ciqual_code=c.code
    order by fd.priority asc,fd.updated_at desc
    limit 1
  ) d on true
)
select
  b.code,
  public.mt_food_price_resolve_legacy_v2(
    b.dictionary_id,b.code,b.name,p_country,p_region
  ) price
from b;
$fn$;

revoke all on function public.mt_planner_ciqual_price_batch_v1(text[],text,text) from public,anon;
grant execute on function public.mt_planner_ciqual_price_batch_v1(text[],text,text) to authenticated;

commit;

select jsonb_build_object(
  'status','v4891_univers_ciqual_complet_pret',
  'counts',jsonb_build_object(
    'ciqual_universe_total',(select count(*) from public.ciqual_foods),
    'protein',(select count(*) from public.mt_planner_ciqual_universe_v1() where role in ('protein','protein_plant')),
    'starch',(select count(*) from public.mt_planner_ciqual_universe_v1() where role='starch'),
    'vegetable',(select count(*) from public.mt_planner_ciqual_universe_v1() where role='vegetable'),
    'composite',(select count(*) from public.mt_planner_ciqual_universe_v1() where role='composite')
  ),
  'architecture',jsonb_build_object(
    'full_ciqual_universe_rpc',to_regprocedure('public.mt_planner_ciqual_universe_v1()') is not null,
    'ciqual_price_batch_rpc',to_regprocedure('public.mt_planner_ciqual_price_batch_v1(text[],text,text)') is not null,
    'existing_32_candidates_preserved',true,
    'dynamic_meal_assembler_frontend_required',true
  ),
  'guards',jsonb_build_object(
    'all_ciqual_rows_visible_to_brain',true,
    'single_ingredient_is_not_forced_as_a_meal',true,
    'unknown_price_becomes_zero',false,
    'external_ai_required',false,
    'ciqual_rows_modified',false
  ),
  'safety',jsonb_build_object(
    'payments_changed',false,
    'protocols_changed',false,
    'voice_changed',false,
    'recipes_changed',false,
    'food_dictionary_rows_changed',false
  ),
  'next_step','Envoyer ce JSON. Puis uploader les 4 fichiers frontend V489.1 pour que le planificateur assemble des repas à partir de l’univers CIQUAL complet.'
) as v4891_result;
