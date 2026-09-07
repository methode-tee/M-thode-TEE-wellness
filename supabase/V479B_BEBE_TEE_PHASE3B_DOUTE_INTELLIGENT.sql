-- MÉTHODE TEE V479B — Bébé TEE · Phase 3B « Doute intelligent »
-- Dépendances : V477 + V478B + V479 déjà appliquées.
--
-- OBJECTIF
-- Empêcher la future saisie vocale de choisir arbitrairement une entrée CIQUAL
-- trop spécifique quand l'utilisatrice a prononcé un aliment générique.
--
-- Exemples :
--   « 150 g de riz »       -> RIZ (préparation à préciser), PAS « riz au lait »
--   « 120 g de poulet »    -> POULET (morceau/cuisson à préciser), PAS « aile »
--   « du boeuf »           -> BOEUF (type/cuisson à préciser), PAS « macreuse »
--   « deux plantains »     -> PLANTAIN (préparation à préciser), PAS « cru » arbitraire
--   « un café au lait »    -> CAFÉ AU LAIT reconnu comme expression unique,
--                             mais lait/quantité à préciser avant calcul nutritionnel.
--
-- IMPORTANT
-- - ADDITIF : les fonctions V478/V479 restent présentes et inchangées.
-- - La future app devra appeler resolve_food_speech_phrase_v3b(_json).
-- - Aucun repas n'est créé ou modifié.
-- - Aucun protocole / XP / déblocage / validation / achat n'est touché.
-- - Aucun appel IA, aucun stockage audio.

begin;

-- ---------------------------------------------------------------------------
-- 0. GARDE-FOU
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.resolve_food_speech_phrase_v3(text,integer)') is null then
    raise exception 'V479B nécessite V479 : public.resolve_food_speech_phrase_v3(text,integer) est introuvable';
  end if;
  if to_regprocedure('public.food_normalize(text)') is null then
    raise exception 'V479B nécessite public.food_normalize(text)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. CONCEPTS ALIMENTAIRES GÉNÉRIQUES / EXPRESSIONS COMPOSÉES
-- ---------------------------------------------------------------------------
-- Cette table ne remplace ni food_dictionary ni CIQUAL.
-- Elle sert uniquement à dire : « j'ai compris le CONCEPT, mais il me manque
-- un détail avant de pouvoir choisir une référence nutritionnelle exacte ».
create table if not exists public.food_speech_generic_concepts (
  concept_key text primary key,
  display_name text not null,
  aliases text[] not null default '{}'::text[],
  concept_kind text not null default 'preparation_needed'
    check (concept_kind in ('preparation_needed','piece_needed','composite_needs_detail')),
  detail_prompt text not null,
  options jsonb not null default '[]'::jsonb,
  locale text not null default 'fr-FR',
  priority integer not null default 100,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_speech_generic_concepts_priority_check check (priority between 0 and 1000),
  constraint food_speech_generic_concepts_options_array check (jsonb_typeof(options)='array')
);

create index if not exists food_speech_generic_concepts_lookup_idx
  on public.food_speech_generic_concepts(enabled,locale,priority);

alter table public.food_speech_generic_concepts enable row level security;
drop policy if exists "food speech generic authenticated read" on public.food_speech_generic_concepts;
drop policy if exists "food speech generic admin manage" on public.food_speech_generic_concepts;
create policy "food speech generic authenticated read" on public.food_speech_generic_concepts
  for select to authenticated using (enabled or public.is_admin());
create policy "food speech generic admin manage" on public.food_speech_generic_concepts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.food_speech_generic_concepts to authenticated;

-- Première vague volontairement petite : seulement les ambiguïtés réellement
-- observées pendant les tests V479. On enrichira après tests, pas au hasard.
insert into public.food_speech_generic_concepts
  (concept_key,display_name,aliases,concept_kind,detail_prompt,options,priority,enabled,updated_at)
values
  (
    'generic_riz','Riz',array['riz'],'preparation_needed',
    'Quel riz / quelle préparation correspond le mieux ?',
    jsonb_build_array(
      jsonb_build_object('option_key','riz_cuit_nature','display_name','Riz cuit / nature','hint','Pesé après cuisson'),
      jsonb_build_object('option_key','riz_cru','display_name','Riz cru','hint','Pesé avant cuisson'),
      jsonb_build_object('option_key','riz_complet','display_name','Riz complet','hint','Préciser cru ou cuit ensuite'),
      jsonb_build_object('option_key','autre','display_name','Autre préparation','hint','Rechercher dans Méthode TEE')
    ),
    10,true,now()
  ),
  (
    'generic_poulet','Poulet',array['poulet'],'piece_needed',
    'Quel morceau ou quelle préparation correspond le mieux ?',
    jsonb_build_array(
      jsonb_build_object('option_key','filet_blanc','display_name','Blanc / filet de poulet'),
      jsonb_build_object('option_key','cuisse','display_name','Cuisse de poulet'),
      jsonb_build_object('option_key','poulet_roti','display_name','Poulet rôti'),
      jsonb_build_object('option_key','autre','display_name','Autre','hint','Rechercher dans Méthode TEE')
    ),
    10,true,now()
  ),
  (
    'generic_boeuf','Bœuf',array['boeuf','bœuf'],'piece_needed',
    'Quel type ou quelle préparation de bœuf correspond le mieux ?',
    jsonb_build_array(
      jsonb_build_object('option_key','steak','display_name','Steak / morceau de bœuf'),
      jsonb_build_object('option_key','hache','display_name','Bœuf haché'),
      jsonb_build_object('option_key','mijote','display_name','Bœuf mijoté / en sauce'),
      jsonb_build_object('option_key','autre','display_name','Autre','hint','Rechercher dans Méthode TEE')
    ),
    10,true,now()
  ),
  (
    'generic_plantain','Banane plantain',array['plantain','plantains','banane plantain','bananes plantain'],'preparation_needed',
    'Comment le plantain était-il préparé ?',
    jsonb_build_array(
      jsonb_build_object('option_key','cuit','display_name','Cuit'),
      jsonb_build_object('option_key','frit_alloco','display_name','Frit / alloco'),
      jsonb_build_object('option_key','cru','display_name','Cru / pesé avant cuisson'),
      jsonb_build_object('option_key','autre','display_name','Autre préparation','hint','Rechercher dans Méthode TEE')
    ),
    10,true,now()
  ),
  (
    'generic_cafe_au_lait','Café au lait',array['cafe au lait','café au lait'],'composite_needs_detail',
    'Quel lait et quelle quantité as-tu utilisés ?',
    jsonb_build_array(
      jsonb_build_object('option_key','lait_vache','display_name','Café + lait de vache'),
      jsonb_build_object('option_key','boisson_vegetale','display_name','Café + boisson végétale'),
      jsonb_build_object('option_key','autre','display_name','Autre','hint','Préciser la boisson et la quantité')
    ),
    5,true,now()
  )
on conflict (concept_key) do update
set display_name=excluded.display_name,
    aliases=excluded.aliases,
    concept_kind=excluded.concept_kind,
    detail_prompt=excluded.detail_prompt,
    options=excluded.options,
    locale=excluded.locale,
    priority=excluded.priority,
    enabled=excluded.enabled,
    updated_at=now();

-- ---------------------------------------------------------------------------
-- 2. MATCH EXACT D'UN CONCEPT GÉNÉRIQUE
-- ---------------------------------------------------------------------------
-- IMPORTANT : match EXACT uniquement.
-- « poulet » déclenche le concept générique, mais « poulet DG » continue d'être
-- résolu par V478 comme plat culturel précis.
create or replace function public.food_speech_match_generic(p_food_text text)
returns table(
  concept_key text,
  display_name text,
  concept_kind text,
  detail_prompt text,
  options jsonb,
  matched_alias text
)
language sql
stable
security invoker
set search_path=public
as $$
  with q as (
    select public.food_normalize(coalesce(p_food_text,'')) v
  ), hits as (
    select
      c.concept_key,c.display_name,c.concept_kind,c.detail_prompt,c.options,
      a.alias_raw matched_alias,c.priority
    from public.food_speech_generic_concepts c
    cross join q
    cross join lateral (
      select x alias_raw
      from unnest(c.aliases) x
      where public.food_normalize(x)=q.v
      order by length(x) desc
      limit 1
    ) a
    where c.enabled and c.locale='fr-FR' and length(q.v)>=2
  )
  select concept_key,display_name,concept_kind,detail_prompt,options,matched_alias
  from hits
  order by priority,display_name
  limit 1;
$$;

grant execute on function public.food_speech_match_generic(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. RÉSOLVEUR DE PHRASE V3B — « JE SAIS QUAND JE NE SAIS PAS »
-- ---------------------------------------------------------------------------
-- V479 reste intacte. V3B la prend comme base puis remplace SEULEMENT les
-- segments qui correspondent exactement à un concept générique connu.
create or replace function public.resolve_food_speech_phrase_v3b(
  p_text text,
  p_limit_items integer default 12
)
returns table(
  item_index integer,
  raw_segment text,
  quantity_value numeric,
  quantity_text text,
  unit_code text,
  unit_label text,
  unit_kind text,
  base_quantity_value numeric,
  base_unit text,
  quantity_confidence text,
  quantity_requires_confirmation boolean,
  food_text text,
  food_ref text,
  source_kind text,
  dictionary_id uuid,
  multimodal_key text,
  ciqual_code text,
  canonical_name text,
  display_name text,
  country text,
  matched_term text,
  match_type text,
  food_confidence text,
  food_requires_confirmation boolean,
  overall_requires_confirmation boolean,
  resolution_status text,
  alternatives jsonb
)
language sql
stable
security invoker
set search_path=public
as $$
  with base as (
    select *
    from public.resolve_food_speech_phrase_v3(p_text,p_limit_items)
  ), enriched as (
    select b.*,g.concept_key g_concept_key,g.display_name g_display_name,
           g.concept_kind g_concept_kind,g.detail_prompt g_detail_prompt,
           g.options g_options,g.matched_alias g_matched_alias
    from base b
    left join lateral public.food_speech_match_generic(b.food_text) g on true
  )
  select
    e.item_index,
    e.raw_segment,
    e.quantity_value,
    e.quantity_text,
    e.unit_code,
    e.unit_label,
    e.unit_kind,
    e.base_quantity_value,
    e.base_unit,
    e.quantity_confidence,
    e.quantity_requires_confirmation,
    e.food_text,
    case when e.g_concept_key is not null then 'generic:'||e.g_concept_key else e.food_ref end as food_ref,
    case when e.g_concept_key is not null then 'generic' else e.source_kind end as source_kind,
    case when e.g_concept_key is not null then null::uuid else e.dictionary_id end as dictionary_id,
    case when e.g_concept_key is not null then e.g_concept_key else e.multimodal_key end as multimodal_key,
    case when e.g_concept_key is not null then null::text else e.ciqual_code end as ciqual_code,
    case when e.g_concept_key is not null then e.g_display_name else e.canonical_name end as canonical_name,
    case when e.g_concept_key is not null then e.g_display_name else e.display_name end as display_name,
    case when e.g_concept_key is not null then null::text else e.country end as country,
    case when e.g_concept_key is not null then e.g_matched_alias else e.matched_term end as matched_term,
    case when e.g_concept_key is not null then 'generic_concept' else e.match_type end as match_type,
    case when e.g_concept_key is not null then 'generic' else e.food_confidence end as food_confidence,
    true as food_requires_confirmation,
    true as overall_requires_confirmation,
    case
      when e.g_concept_key is not null then 'needs_detail'
      else e.resolution_status
    end as resolution_status,
    case
      when e.g_concept_key is not null then coalesce(e.g_options,'[]'::jsonb)
      else e.alternatives
    end as alternatives
  from enriched e
  order by e.item_index;
$$;

grant execute on function public.resolve_food_speech_phrase_v3b(text,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. JSON V3B POUR LA FUTURE INTERFACE « VÉRIFIE CE QUE J'AI COMPRIS »
-- ---------------------------------------------------------------------------
-- Ajoute explicitement le prompt et les options d'un concept générique.
-- ready_to_add = false tant qu'un segment « generic » ou non résolu subsiste.
create or replace function public.resolve_food_speech_phrase_v3b_json(
  p_text text,
  p_limit_items integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
  with items as (
    select * from public.resolve_food_speech_phrase_v3b(p_text,p_limit_items)
  ), decorated as (
    select
      i.*,
      g.detail_prompt,
      case when i.source_kind='generic' then g.options else null::jsonb end generic_options
    from items i
    left join public.food_speech_generic_concepts g
      on i.source_kind='generic' and g.concept_key=i.multimodal_key and g.enabled
  )
  select jsonb_build_object(
    'input',coalesce(p_text,''),
    'item_count',count(*),
    'all_foods_identified',coalesce(bool_and(food_ref is not null),false),
    'needs_detail_count',count(*) filter (where source_kind='generic' or resolution_status='needs_detail'),
    'ready_to_add',coalesce(bool_and(food_ref is not null and source_kind<>'generic' and resolution_status<>'needs_search'),false),
    'requires_confirmation',true,
    'items',coalesce(
      jsonb_agg(
        to_jsonb(decorated)
        order by item_index
      ),
      '[]'::jsonb
    )
  )
  from decorated;
$$;

grant execute on function public.resolve_food_speech_phrase_v3b_json(text,integer) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- TESTS CONSEILLÉS APRÈS APPLICATION — LECTURE SEULE
-- ---------------------------------------------------------------------------
-- 1. Les aliments génériques ne doivent PLUS choisir un CIQUAL arbitraire :
-- select * from public.resolve_food_speech_phrase_v3b(
--   'J''ai mangé 150 g de riz et 120 g de poulet',12
-- );
-- Attendu : Riz / Poulet, source_kind=generic, resolution_status=needs_detail.
--
-- 2. Plantain générique :
-- select * from public.resolve_food_speech_phrase_v3b(
--   'J''ai mangé du ndolé avec deux plantains et un peu de riz',12
-- );
-- Attendu : Ndolè précis + Plantain générique + Riz générique.
--
-- 3. Expression composée :
-- select * from public.resolve_food_speech_phrase_v3b(
--   'J''ai mangé deux œufs, deux tartines de pain complet, un demi avocat et un café au lait',12
-- );
-- Attendu : café au lait reconnu, needs_detail (type/quantité de lait à préciser).
--
-- 4. Le culturel précis NE DOIT PAS être dégradé en générique :
-- select * from public.resolve_food_speech_phrase_v3b(
--   'J''ai mangé du taro sauce jaune avec du boeuf',12
-- );
-- Attendu : Achu précis + Bœuf générique.
--
-- 5. JSON futur écran :
-- select public.resolve_food_speech_phrase_v3b_json(
--   'J''ai mangé 150 g de riz et 120 g de poulet',12
-- );
