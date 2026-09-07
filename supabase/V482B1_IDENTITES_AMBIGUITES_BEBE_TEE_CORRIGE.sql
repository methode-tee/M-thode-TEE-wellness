-- MÉTHODE TEE — V482B.1 · Identités uniques & ambiguïtés vocales — correctif signature RPC
-- Dépendances : V477 + V478B + V479 + V479B + V480 déjà appliqués.
--
-- But : traiter les collisions réellement observées dans la bibliothèque sans supprimer
-- une seule fiche alimentaire et sans toucher au Carnet, aux protocoles, aux XP,
-- aux déblocages ou aux repas historiques.
--
-- Règles :
--   1) vrai doublon d'identité -> un seul représentant vocal ; les lignes restent en base ;
--   2) variantes légitimes -> une seule card + choix de variante ;
--   3) conflit culturel -> TEE demande explicitement ;
--   4) produit restaurant explicitement choisi -> le nombre contenu dans le nom du produit
--      (ex. « 6 nuggets ») n'est jamais multiplié une deuxième fois comme 6 portions.
--
-- SQL idempotent. Aucun appel IA. Aucun upload. Aucun egress de masse.

begin;

-- -----------------------------------------------------------------------------
-- 0. GARDE-FOUS
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.resolve_food_speech_v2(text,integer)') is null then
    raise exception 'V482B nécessite V478B : resolve_food_speech_v2(text,integer) introuvable';
  end if;
  if to_regprocedure('public.resolve_food_speech_phrase_v3b(text,integer)') is null then
    raise exception 'V482B nécessite V479B : resolve_food_speech_phrase_v3b(text,integer) introuvable';
  end if;
  if to_regprocedure('public.resolve_food_speech_phrase_v4_json(text,jsonb,integer)') is null then
    raise exception 'V482B nécessite V480 : resolve_food_speech_phrase_v4_json(text,jsonb,integer) introuvable';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. VRAIS DOUBLONS D'IDENTITÉ : on ne supprime rien ; on n'écoute qu'une ligne.
-- -----------------------------------------------------------------------------
create table if not exists public.food_speech_identity_groups (
  group_key text primary key,
  preferred_label text not null,
  member_names text[] not null,
  note text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.food_speech_identity_groups enable row level security;
drop policy if exists "food speech identity authenticated read" on public.food_speech_identity_groups;
drop policy if exists "food speech identity admin manage" on public.food_speech_identity_groups;
create policy "food speech identity authenticated read" on public.food_speech_identity_groups
  for select to authenticated using (enabled or public.is_admin());
create policy "food speech identity admin manage" on public.food_speech_identity_groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.food_speech_identity_groups to authenticated;

insert into public.food_speech_identity_groups(group_key,preferred_label,member_names,note,enabled,updated_at)
values
  ('identity_achu','Achu / Taro sauce jaune',array['Achu','Achu / Taro sauce jaune'],
   'Même identité historique ; conserve la ligne la mieux reliée nutritionnellement.',true,now()),
  ('identity_karantika','Karantika / Garantita',array['Karantika','Karantika / Garantita'],
   'Même préparation sous deux libellés historiques.',true,now()),
  ('identity_jiaozi','Jiaozi / raviolis chinois',array['Jiaozi','Jiaozi / raviolis chinois'],
   'Même identité alimentaire ; libellé enrichi plus tard.',true,now()),
  ('identity_mhadjeb','Mhadjeb / Mahjouba',array['Mhadjeb','Mhadjeb / Mahjouba'],
   'Même identité alimentaire ; variantes de nom algériennes.',true,now())
on conflict (group_key) do update
set preferred_label=excluded.preferred_label,
    member_names=excluded.member_names,
    note=excluded.note,
    enabled=excluded.enabled,
    updated_at=now();

-- Applique les groupes sans jamais désactiver la fiche alimentaire elle-même.
-- Le gagnant est choisi d'abord selon la présence d'un lien nutritionnel, puis selon
-- la priorité du catalogue. Tous les alias des doublons sont recopiés sur le gagnant.
create or replace function public.food_speech_apply_identity_groups()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  g record;
  v_winner uuid;
  v_aliases text[];
  v_changed integer := 0;
  v_rows integer := 0;
begin
  for g in
    select * from public.food_speech_identity_groups where enabled
  loop
    select d.id into v_winner
    from public.food_dictionary d
    where d.enabled
      and d.canonical_name = any(g.member_names)
    order by
      (d.ciqual_code is not null) desc,
      (nullif(d.multimodal_key,'') is not null) desc,
      d.priority asc,
      length(coalesce(d.display_name,'')) desc,
      d.id
    limit 1;

    if v_winner is null then
      continue;
    end if;

    select coalesce(array_agg(distinct x.term order by x.term),'{}'::text[])
    into v_aliases
    from public.food_dictionary d
    cross join lateral unnest(
      coalesce(d.speech_aliases,'{}'::text[])
      || coalesce(d.aliases,'{}'::text[])
      || array[d.canonical_name,d.display_name]
    ) as x(term)
    where d.enabled
      and d.canonical_name = any(g.member_names)
      and nullif(trim(x.term),'') is not null;

    update public.food_dictionary d
    set speech_aliases = (
      select coalesce(array_agg(distinct a order by a),'{}'::text[])
      from unnest(coalesce(d.speech_aliases,'{}'::text[]) || coalesce(v_aliases,'{}'::text[])) a
      where nullif(trim(a),'') is not null
    ),
    speech_enabled = true
    where d.id=v_winner;

    update public.food_dictionary d
    set speech_enabled=false
    where d.enabled
      and d.canonical_name = any(g.member_names)
      and d.id<>v_winner
      and d.speech_enabled;

    get diagnostics v_rows = row_count;
    v_changed := v_changed + v_rows;
  end loop;

  return v_changed;
end;
$$;

revoke all on function public.food_speech_apply_identity_groups() from public, anon, authenticated;
select public.food_speech_apply_identity_groups();

-- -----------------------------------------------------------------------------
-- 2. AMBIGUÏTÉS LÉGITIMES : concepts exacts, jamais de fusion arbitraire.
-- -----------------------------------------------------------------------------
-- V479B possède déjà la table food_speech_generic_concepts et un match EXACT.
-- On l'enrichit seulement avec les collisions observées par l'audit réel.

insert into public.food_speech_generic_concepts
  (concept_key,display_name,aliases,concept_kind,detail_prompt,options,priority,enabled,updated_at)
values
  (
    'generic_eru','Eru / Okok',array['eru'],'composite_needs_detail',
    'Quand tu dis « eru », quel plat correspond à ce que tu as mangé ?',
    jsonb_build_array(
      jsonb_build_object('option_key','eru','display_name','Eru'),
      jsonb_build_object('option_key','okok','display_name','Okok')
    ),2,true,now()
  ),
  (
    'generic_foufou_manioc','Foufou de manioc',array['foufou de manioc','foufou manioc','fufu manioc'],'composite_needs_detail',
    'Quel repère correspond le mieux à ta préparation de manioc ?',
    jsonb_build_array(
      jsonb_build_object('option_key','foufou','display_name','Foufou de manioc'),
      jsonb_build_object('option_key','couscous_manioc','display_name','Couscous de manioc cuit — Cameroun')
    ),3,true,now()
  ),
  (
    'generic_frites','Frites',array['frite','frites','portion de frites'],'preparation_needed',
    'Tes frites venaient-elles de McDonald’s ?',
    jsonb_build_array(
      jsonb_build_object('option_key','mcdo','display_name','McDonald’s'),
      jsonb_build_object('option_key','autre','display_name','Autres / maison','hint','Recherche la préparation exacte')
    ),4,true,now()
  ),
  (
    'generic_mcdo_frites','Frites McDonald’s',
    array['frite mcdo','frites mcdo','frite mcdonalds','frites mcdonalds','frite mcdonald s','frites mcdonald s'],
    'preparation_needed','Quelle portion de frites McDonald’s as-tu prise ?',
    jsonb_build_array(
      jsonb_build_object('option_key','petite','display_name','Petite portion'),
      jsonb_build_object('option_key','moyenne','display_name','Moyenne portion'),
      jsonb_build_object('option_key','grande','display_name','Grande portion')
    ),1,true,now()
  ),
  (
    'generic_nuggets_6','6 nuggets',array['6 nuggets','nuggets x6'],'composite_needs_detail',
    'Pour tes 6 nuggets, lesquels étaient-ce ?',
    jsonb_build_array(
      jsonb_build_object('option_key','chicken','display_name','6 Chicken McNuggets — McDonald’s'),
      jsonb_build_object('option_key','veggie','display_name','6 Veggie McPlant Nuggets — McDonald’s'),
      jsonb_build_object('option_key','autre','display_name','Autres nuggets')
    ),4,true,now()
  ),
  (
    'generic_mcdo_nuggets_6','6 nuggets McDonald’s',array['6 nuggets mcdo'],'composite_needs_detail',
    'Tes 6 nuggets McDonald’s étaient-ils au poulet ou végétaux ?',
    jsonb_build_array(
      jsonb_build_object('option_key','chicken','display_name','Chicken McNuggets'),
      jsonb_build_object('option_key','veggie','display_name','Veggie McPlant Nuggets')
    ),1,true,now()
  ),
  (
    'generic_nuggets_9','9 nuggets',array['9 nuggets','nuggets x9'],'composite_needs_detail',
    'Pour tes 9 nuggets, lesquels étaient-ce ?',
    jsonb_build_array(
      jsonb_build_object('option_key','chicken','display_name','9 Chicken McNuggets — McDonald’s'),
      jsonb_build_object('option_key','veggie','display_name','9 Veggie McPlant Nuggets — McDonald’s'),
      jsonb_build_object('option_key','autre','display_name','Autres nuggets')
    ),4,true,now()
  ),
  (
    'generic_mcdo_nuggets_9','9 nuggets McDonald’s',array['9 nuggets mcdo'],'composite_needs_detail',
    'Tes 9 nuggets McDonald’s étaient-ils au poulet ou végétaux ?',
    jsonb_build_array(
      jsonb_build_object('option_key','chicken','display_name','Chicken McNuggets'),
      jsonb_build_object('option_key','veggie','display_name','Veggie McPlant Nuggets')
    ),1,true,now()
  ),
  (
    'generic_nuggets_20','20 nuggets',array['20 nuggets','nuggets x20'],'composite_needs_detail',
    'Pour tes 20 nuggets, lesquels étaient-ce ?',
    jsonb_build_array(
      jsonb_build_object('option_key','chicken','display_name','20 Chicken McNuggets — McDonald’s'),
      jsonb_build_object('option_key','veggie','display_name','20 Veggie McPlant Nuggets — McDonald’s'),
      jsonb_build_object('option_key','autre','display_name','Autres nuggets')
    ),4,true,now()
  ),
  (
    'generic_mcdo_nuggets_20','20 nuggets McDonald’s',array['20 nuggets mcdo'],'composite_needs_detail',
    'Tes 20 nuggets McDonald’s étaient-ils au poulet ou végétaux ?',
    jsonb_build_array(
      jsonb_build_object('option_key','chicken','display_name','Chicken McNuggets'),
      jsonb_build_object('option_key','veggie','display_name','Veggie McPlant Nuggets')
    ),1,true,now()
  ),
  (
    'generic_cheeseburger','Cheeseburger',array['cheeseburger'],'composite_needs_detail',
    'S’agit-il du Cheeseburger McDonald’s ou d’un autre cheeseburger ?',
    jsonb_build_array(
      jsonb_build_object('option_key','mcdo','display_name','Cheeseburger McDonald’s'),
      jsonb_build_object('option_key','autre','display_name','Autre cheeseburger')
    ),4,true,now()
  ),
  (
    'generic_hamburger','Hamburger',array['hamburger'],'composite_needs_detail',
    'S’agit-il du Hamburger McDonald’s ou d’un autre hamburger ?',
    jsonb_build_array(
      jsonb_build_object('option_key','mcdo','display_name','Hamburger McDonald’s'),
      jsonb_build_object('option_key','autre','display_name','Autre hamburger')
    ),4,true,now()
  )
on conflict (concept_key) do update
set display_name=excluded.display_name,
    aliases=excluded.aliases,
    concept_kind=excluded.concept_kind,
    detail_prompt=excluded.detail_prompt,
    options=excluded.options,
    priority=excluded.priority,
    enabled=excluded.enabled,
    updated_at=now();

-- -----------------------------------------------------------------------------
-- 2B. LE NOMBRE PEUT FAIRE PARTIE DU NOM DU PRODUIT : 6 / 9 / 20 nuggets
-- -----------------------------------------------------------------------------
-- V479 retire correctement la quantité du food_text. Pour les nuggets McDo, ce nombre
-- sert aussi à identifier la boîte. On reconstruit uniquement la clé de recherche
-- générique ; la quantité entendue reste conservée dans le payload.
create or replace function public.food_speech_generic_query_key(
  p_food_text text,
  p_quantity_value numeric,
  p_raw_segment text
)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  v_food text := public.food_normalize(coalesce(p_food_text,''));
  v_raw text := public.food_normalize(coalesce(p_raw_segment,''));
  v_count integer;
begin
  if p_quantity_value is not null
     and p_quantity_value = trunc(p_quantity_value)
     and p_quantity_value in (6,9,20)
     and v_food ~ '^nuggets?( |$)' then
    v_count := p_quantity_value::integer;
    if v_raw ~ '(^| )(mcdo|mcdonald|mcdonalds)( |$)' then
      return v_count::text || ' nuggets mcdo';
    end if;
    return v_count::text || ' nuggets';
  end if;
  return p_food_text;
end;
$$;

grant execute on function public.food_speech_generic_query_key(text,numeric,text) to authenticated;

-- Même contrat que V479B ; seul le texte envoyé au matcher générique est enrichi
-- pour les packs de nuggets. Tous les autres aliments suivent strictement V479B.
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
    left join lateral public.food_speech_match_generic(
      public.food_speech_generic_query_key(b.food_text,b.quantity_value,b.raw_segment)
    ) g on true
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
    case when e.g_concept_key is not null then 'needs_detail' else e.resolution_status end as resolution_status,
    case when e.g_concept_key is not null then coalesce(e.g_options,'[]'::jsonb) else e.alternatives end as alternatives
  from enriched e
  order by e.item_index;
$$;

grant execute on function public.resolve_food_speech_phrase_v3b(text,integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. SÉMANTIQUE DE QUANTITÉ : « 6 nuggets » identifie une boîte de 6, pas 6 boîtes.
-- -----------------------------------------------------------------------------
alter table public.food_speech_detail_targets
  add column if not exists quantity_mode text not null default 'spoken';

alter table public.food_speech_detail_targets
  drop constraint if exists food_speech_detail_targets_quantity_mode_check;
alter table public.food_speech_detail_targets
  add constraint food_speech_detail_targets_quantity_mode_check
  check (quantity_mode in ('spoken','product_identity'));

-- Choix qui demandent encore un sous-choix ou une recherche.
insert into public.food_speech_detail_targets
  (concept_key,option_key,option_display_name,resolution_mode,target_ciqual_code,target_names,followup_prompt,followup_options,priority,enabled,quantity_mode,updated_at)
values
  ('generic_frites','mcdo','McDonald’s','needs_subdetail',null,'{}'::text[],
    'Quelle portion de frites McDonald’s as-tu prise ?',
    jsonb_build_array(
      jsonb_build_object('option_key','mcdo_petite','display_name','Petite portion'),
      jsonb_build_object('option_key','mcdo_moyenne','display_name','Moyenne portion'),
      jsonb_build_object('option_key','mcdo_grande','display_name','Grande portion')
    ),5,true,'spoken',now()),
  ('generic_frites','autre','Autres / maison','search_required',null,'{}'::text[],
    'Recherche la préparation de frites exacte dans Méthode TEE.','[]'::jsonb,900,true,'spoken',now()),
  ('generic_nuggets_6','autre','Autres nuggets','search_required',null,'{}'::text[],
    'Recherche tes nuggets exacts dans Méthode TEE.','[]'::jsonb,900,true,'spoken',now()),
  ('generic_nuggets_9','autre','Autres nuggets','search_required',null,'{}'::text[],
    'Recherche tes nuggets exacts dans Méthode TEE.','[]'::jsonb,900,true,'spoken',now()),
  ('generic_nuggets_20','autre','Autres nuggets','search_required',null,'{}'::text[],
    'Recherche tes nuggets exacts dans Méthode TEE.','[]'::jsonb,900,true,'spoken',now()),
  ('generic_cheeseburger','autre','Autre cheeseburger','search_required',null,'{}'::text[],
    'Recherche ton cheeseburger exact dans Méthode TEE.','[]'::jsonb,900,true,'spoken',now()),
  ('generic_hamburger','autre','Autre hamburger','search_required',null,'{}'::text[],
    'Recherche ton hamburger exact dans Méthode TEE.','[]'::jsonb,900,true,'spoken',now())
on conflict (concept_key,option_key) do update
set option_display_name=excluded.option_display_name,
    resolution_mode=excluded.resolution_mode,
    target_ciqual_code=excluded.target_ciqual_code,
    target_names=excluded.target_names,
    followup_prompt=excluded.followup_prompt,
    followup_options=excluded.followup_options,
    priority=excluded.priority,
    enabled=excluded.enabled,
    quantity_mode=excluded.quantity_mode,
    updated_at=now();

-- Cibles « aliment » : récupère dynamiquement le code réellement présent dans TA base.
-- On n'invente aucun code CIQUAL/TEE dans ce patch.
with target_seed(concept_key,option_key,option_display_name,canonical_target,quantity_mode,priority) as (values
  ('generic_eru','eru','Eru','Eru','spoken',10),
  ('generic_eru','okok','Okok','Okok','spoken',10),
  ('generic_foufou_manioc','foufou','Foufou de manioc','Foufou de manioc','spoken',10),
  ('generic_foufou_manioc','couscous_manioc','Couscous de manioc cuit — Cameroun','Couscous de manioc cuit Cameroun','spoken',10),

  ('generic_mcdo_frites','petite','Petite portion','McDonald’s France · La petite Portion de Frites','product_identity',10),
  ('generic_mcdo_frites','moyenne','Moyenne portion','McDonald’s France · La moyenne Portion de Frites','product_identity',10),
  ('generic_mcdo_frites','grande','Grande portion','McDonald’s France · La grande Portion de Frites','product_identity',10),
  ('generic_frites','mcdo_petite','Petite portion','McDonald’s France · La petite Portion de Frites','product_identity',10),
  ('generic_frites','mcdo_moyenne','Moyenne portion','McDonald’s France · La moyenne Portion de Frites','product_identity',10),
  ('generic_frites','mcdo_grande','Grande portion','McDonald’s France · La grande Portion de Frites','product_identity',10),

  ('generic_nuggets_6','chicken','6 Chicken McNuggets — McDonald’s','McDonald’s France · 6 Chicken McNuggets™','product_identity',10),
  ('generic_nuggets_6','veggie','6 Veggie McPlant Nuggets — McDonald’s','McDonald’s France · 6 Veggie McPlant® Nuggets','product_identity',10),
  ('generic_mcdo_nuggets_6','chicken','Chicken McNuggets','McDonald’s France · 6 Chicken McNuggets™','product_identity',10),
  ('generic_mcdo_nuggets_6','veggie','Veggie McPlant Nuggets','McDonald’s France · 6 Veggie McPlant® Nuggets','product_identity',10),

  ('generic_nuggets_9','chicken','9 Chicken McNuggets — McDonald’s','McDonald’s France · 9 Chicken McNuggets™','product_identity',10),
  ('generic_nuggets_9','veggie','9 Veggie McPlant Nuggets — McDonald’s','McDonald’s France · 9 Veggie McPlant® Nuggets','product_identity',10),
  ('generic_mcdo_nuggets_9','chicken','Chicken McNuggets','McDonald’s France · 9 Chicken McNuggets™','product_identity',10),
  ('generic_mcdo_nuggets_9','veggie','Veggie McPlant Nuggets','McDonald’s France · 9 Veggie McPlant® Nuggets','product_identity',10),

  ('generic_nuggets_20','chicken','20 Chicken McNuggets — McDonald’s','McDonald’s France · La Boîte de 20 Chicken McNuggets™','product_identity',10),
  ('generic_nuggets_20','veggie','20 Veggie McPlant Nuggets — McDonald’s','McDonald’s France · 20 Veggie McPlant® Nuggets','product_identity',10),
  ('generic_mcdo_nuggets_20','chicken','Chicken McNuggets','McDonald’s France · La Boîte de 20 Chicken McNuggets™','product_identity',10),
  ('generic_mcdo_nuggets_20','veggie','Veggie McPlant Nuggets','McDonald’s France · 20 Veggie McPlant® Nuggets','product_identity',10),

  ('generic_cheeseburger','mcdo','Cheeseburger McDonald’s','McDonald’s France · Le Cheeseburger','product_identity',10),
  ('generic_hamburger','mcdo','Hamburger McDonald’s','McDonald’s France · Le Hamburger','product_identity',10)
), resolved as (
  select
    s.*,
    d.ciqual_code,
    d.display_name target_display_name,
    d.canonical_name target_canonical_name
  from target_seed s
  left join lateral (
    select d.*
    from public.food_dictionary d
    where d.enabled
      and public.food_normalize(d.canonical_name)=public.food_normalize(s.canonical_target)
    order by (d.ciqual_code is not null) desc,d.priority,d.id
    limit 1
  ) d on true
)
insert into public.food_speech_detail_targets
  (concept_key,option_key,option_display_name,resolution_mode,target_ciqual_code,target_names,followup_prompt,followup_options,priority,enabled,quantity_mode,updated_at)
select
  r.concept_key,r.option_key,r.option_display_name,'food',r.ciqual_code,
  array_remove(array[r.target_display_name,r.target_canonical_name,r.canonical_target],null),
  null,'[]'::jsonb,r.priority,true,r.quantity_mode,now()
from resolved r
on conflict (concept_key,option_key) do update
set option_display_name=excluded.option_display_name,
    resolution_mode=excluded.resolution_mode,
    target_ciqual_code=excluded.target_ciqual_code,
    target_names=excluded.target_names,
    followup_prompt=excluded.followup_prompt,
    followup_options=excluded.followup_options,
    priority=excluded.priority,
    enabled=excluded.enabled,
    quantity_mode=excluded.quantity_mode,
    updated_at=now();

-- -----------------------------------------------------------------------------
-- 4. PRIORITÉ DE MARQUE POUR LES CAS NON AMBIGUS « cheeseburger mcdo » etc.
-- -----------------------------------------------------------------------------
with brand_seed(canonical_target,alias,priority,note) as (values
  ('McDonald’s France · Le Cheeseburger','cheeseburger mcdo',0,'Marque explicitement prononcée'),
  ('McDonald’s France · Le Cheeseburger','cheeseburger mcdonalds',0,'Marque explicitement prononcée'),
  ('McDonald’s France · Le Cheeseburger','cheeseburger mcdonald s',0,'Marque explicitement prononcée'),
  ('McDonald’s France · Le Hamburger','hamburger mcdo',0,'Marque explicitement prononcée'),
  ('McDonald’s France · Le Hamburger','hamburger mcdonalds',0,'Marque explicitement prononcée'),
  ('McDonald’s France · Le Hamburger','hamburger mcdonald s',0,'Marque explicitement prononcée')
)
insert into public.food_speech_alias_overrides(alias,locale,dictionary_id,priority,note)
select s.alias,'fr-FR',d.id,s.priority,s.note
from brand_seed s
join lateral (
  select d.id
  from public.food_dictionary d
  where d.enabled
    and public.food_normalize(d.canonical_name)=public.food_normalize(s.canonical_target)
  order by (d.ciqual_code is not null) desc,d.priority,d.id
  limit 1
) d on true
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 5. V480B interne : respecte « product_identity » lors du calcul de portion.
-- -----------------------------------------------------------------------------
-- Même signature publique que V480 : l'app V482 continue donc d'appeler exactement
-- le même RPC. Seule la sémantique des choix de produits packagés/restaurant évolue.
create or replace function public.resolve_food_speech_phrase_v4_json(
  p_text text,
  p_choices jsonb default '[]'::jsonb,
  p_limit_items integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
  with base as (
    select * from public.resolve_food_speech_phrase_v3b(p_text,p_limit_items)
  ), with_choice as (
    select
      b.*,
      ch.choice,
      nullif(ch.choice->>'option_key','') selected_option_key,
      case when coalesce(ch.choice->>'grams_override','') ~ '^[0-9]+([.][0-9]+)?$'
           then (ch.choice->>'grams_override')::numeric else null::numeric end grams_override,
      coalesce(case when lower(coalesce(ch.choice->>'confirmed','')) in ('true','false')
                    then (ch.choice->>'confirmed')::boolean end,false) confirmed
    from base b
    left join lateral (
      select e choice
      from jsonb_array_elements(
        case when jsonb_typeof(coalesce(p_choices,'[]'::jsonb))='array' then coalesce(p_choices,'[]'::jsonb) else '[]'::jsonb end
      ) e
      where coalesce(e->>'item_index','') ~ '^[0-9]+$'
        and (e->>'item_index')::integer=b.item_index
      limit 1
    ) ch on true
  ), with_detail as (
    select
      w.*,
      d.option_display_name selected_option_display_name,
      d.resolution_mode detail_resolution_mode,
      d.resolution_status detail_resolution_status,
      d.food_ref detail_food_ref,
      d.source_kind detail_source_kind,
      d.dictionary_id detail_dictionary_id,
      d.multimodal_key detail_multimodal_key,
      d.ciqual_code detail_ciqual_code,
      d.canonical_name detail_canonical_name,
      d.display_name detail_display_name,
      d.followup_prompt detail_followup_prompt,
      d.followup_options detail_followup_options,
      coalesce(t.quantity_mode,'spoken') detail_quantity_mode
    from with_choice w
    left join lateral public.food_speech_resolve_detail_choice(w.multimodal_key,w.selected_option_key) d
      on w.source_kind='generic' and w.selected_option_key is not null
    left join public.food_speech_detail_targets t
      on w.source_kind='generic'
     and t.enabled
     and t.concept_key=w.multimodal_key
     and t.option_key=w.selected_option_key
  ), finalized_food as (
    select
      x.*,
      case
        when x.source_kind<>'generic' then x.food_ref
        when x.detail_resolution_status='resolved' then x.detail_food_ref
        else null::text
      end final_food_ref,
      case
        when x.source_kind<>'generic' then x.source_kind
        when x.detail_resolution_status='resolved' then x.detail_source_kind
        else null::text
      end final_source_kind,
      case
        when x.source_kind<>'generic' then x.dictionary_id
        when x.detail_resolution_status='resolved' then x.detail_dictionary_id
        else null::uuid
      end final_dictionary_id,
      case
        when x.source_kind<>'generic' then x.multimodal_key
        when x.detail_resolution_status='resolved' then x.detail_multimodal_key
        else null::text
      end final_multimodal_key,
      case
        when x.source_kind<>'generic' then x.ciqual_code
        when x.detail_resolution_status='resolved' then x.detail_ciqual_code
        else null::text
      end final_ciqual_code,
      case
        when x.source_kind<>'generic' then x.canonical_name
        when x.detail_resolution_status='resolved' then x.detail_canonical_name
        else x.canonical_name
      end final_canonical_name,
      case
        when x.source_kind<>'generic' then x.display_name
        when x.detail_resolution_status='resolved' then x.detail_display_name
        else x.display_name
      end final_display_name,
      case
        when x.source_kind<>'generic' then x.resolution_status
        when x.selected_option_key is null then 'needs_detail'
        else coalesce(x.detail_resolution_status,'needs_detail')
      end final_resolution_status
    from with_detail x
  ), with_portion as (
    select
      f.*,
      case
        when f.grams_override is not null and f.grams_override>0 then
          jsonb_build_object(
            'status','resolved_manual',
            'grams',f.grams_override,
            'requires_confirmation',true,
            'confidence','manual',
            'source','user_override',
            'estimated',false,
            'verified',false
          )
        when f.final_food_ref is not null and f.detail_quantity_mode='product_identity' then
          public.food_speech_resolve_portion(
            f.final_display_name,f.final_ciqual_code,f.final_dictionary_id,
            1::numeric,null::text,null::text,null::text,
            null::numeric,null::text,true
          )
        when f.final_food_ref is not null then
          public.food_speech_resolve_portion(
            f.final_display_name,f.final_ciqual_code,f.final_dictionary_id,
            f.quantity_value,f.unit_code,f.unit_label,f.unit_kind,
            f.base_quantity_value,f.base_unit,f.quantity_requires_confirmation
          )
        else null::jsonb
      end portion_resolution
    from finalized_food f
  ), decorated as (
    select
      p.*,
      case when p.portion_resolution is not null and coalesce(p.portion_resolution->>'grams','') ~ '^[0-9]+([.][0-9]+)?$'
           then (p.portion_resolution->>'grams')::numeric else null::numeric end final_grams,
      case when p.final_food_ref is not null
                 and p.final_resolution_status in ('resolved','resolved_candidate')
                 and p.portion_resolution is not null
                 and coalesce(p.portion_resolution->>'grams','') ~ '^[0-9]+([.][0-9]+)?$'
           then true else false end ready_for_confirmation
    from with_portion p
  ), payload as (
    select
      d.*,
      (d.ready_for_confirmation and d.confirmed) ready_to_add_item
    from decorated d
  )
  select jsonb_build_object(
    'input',coalesce(p_text,''),
    'item_count',count(*),
    'resolved_food_count',count(*) filter (where final_food_ref is not null),
    'needs_detail_count',count(*) filter (where final_food_ref is null or final_resolution_status in ('needs_detail','needs_subdetail','needs_search','target_not_found','unknown_option')),
    'needs_quantity_count',count(*) filter (where final_food_ref is not null and not ready_for_confirmation),
    'ready_for_confirmation',coalesce(bool_and(ready_for_confirmation),false),
    'ready_to_add',coalesce(bool_and(ready_to_add_item),false),
    'requires_confirmation',true,
    'items',coalesce(
      jsonb_agg(
        jsonb_build_object(
          'item_index',item_index,
          'raw_segment',raw_segment,
          'food_text',food_text,
          'heard_quantity',jsonb_build_object(
            'value',quantity_value,
            'text',quantity_text,
            'unit_code',unit_code,
            'unit_label',unit_label,
            'base_value',base_quantity_value,
            'base_unit',base_unit,
            'confidence',quantity_confidence
          ),
          'original_resolution',jsonb_build_object(
            'food_ref',food_ref,
            'source_kind',source_kind,
            'display_name',display_name,
            'status',resolution_status
          ),
          'selected_option',case when selected_option_key is null then null else jsonb_build_object(
            'option_key',selected_option_key,
            'display_name',selected_option_display_name,
            'status',detail_resolution_status,
            'followup_prompt',detail_followup_prompt,
            'followup_options',coalesce(detail_followup_options,'[]'::jsonb)
          ) end,
          'final_food',case when final_food_ref is null then null else jsonb_build_object(
            'food_ref',final_food_ref,
            'source_kind',final_source_kind,
            'dictionary_id',final_dictionary_id,
            'multimodal_key',final_multimodal_key,
            'ciqual_code',final_ciqual_code,
            'canonical_name',final_canonical_name,
            'display_name',final_display_name
          ) end,
          'portion',portion_resolution,
          'final_grams',final_grams,
          'quantity_mode',detail_quantity_mode,
          'ready_for_confirmation',ready_for_confirmation,
          'confirmed',confirmed,
          'ready_to_add',ready_to_add_item,
          'status',case
            when final_food_ref is null then final_resolution_status
            when not ready_for_confirmation then coalesce(portion_resolution->>'status','needs_quantity')
            when not confirmed then 'awaiting_confirmation'
            else 'ready_to_add'
          end
        ) order by item_index
      ),
      '[]'::jsonb
    )
  )
  from payload;
$$;

grant execute on function public.resolve_food_speech_phrase_v4_json(text,jsonb,integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. VUE D'AUDIT : les futures collisions sont visibles et classables.
-- -----------------------------------------------------------------------------
create or replace view public.food_speech_collision_audit_v2 as
with terms as (
  select
    d.id,
    d.canonical_name,
    d.display_name,
    x.term,
    public.food_normalize(x.term) normalized_term
  from public.food_dictionary d
  cross join lateral unnest(
    array_remove(
      array[d.canonical_name,d.display_name]
      || coalesce(d.aliases,'{}'::text[])
      || coalesce(d.speech_aliases,'{}'::text[]),
      null
    )
  ) x(term)
  where d.enabled and d.speech_enabled
), collisions as (
  select normalized_term,count(distinct id) foods_count,
         array_agg(distinct canonical_name order by canonical_name) foods
  from terms
  where length(normalized_term)>=3
  group by normalized_term
  having count(distinct id)>1
), handled as (
  select c.normalized_term,
         min(g.concept_key) concept_key
  from collisions c
  join public.food_speech_generic_concepts g
    on g.enabled and exists (
      select 1 from unnest(g.aliases) a
      where public.food_normalize(a)=c.normalized_term
    )
  group by c.normalized_term
)
select
  c.normalized_term,c.foods_count,c.foods,
  (h.concept_key is not null) handled_by_voice_rule,
  h.concept_key
from collisions c
left join handled h using(normalized_term)
order by handled_by_voice_rule,c.foods_count desc,c.normalized_term;

grant select on public.food_speech_collision_audit_v2 to authenticated;

commit;

-- =============================================================================
-- TESTS CONSEILLÉS APRÈS APPLICATION (LECTURE SEULE)
-- =============================================================================
-- 1) Les vrais doublons historiques ne doivent plus avoir deux lignes speech_enabled :
-- select canonical_name,display_name,ciqual_code,speech_enabled
-- from public.food_dictionary
-- where canonical_name in (
--   'Achu','Achu / Taro sauce jaune','Karantika','Karantika / Garantita',
--   'Jiaozi','Jiaozi / raviolis chinois','Mhadjeb','Mhadjeb / Mahjouba'
-- ) order by canonical_name;
--
-- 2) Eru doit demander un choix, pas décider entre Eru et Okok :
-- select public.resolve_food_speech_phrase_v4_json('J''ai mangé de l''eru','[]'::jsonb,12);
--
-- 3) Frites McDo doit demander la taille :
-- select public.resolve_food_speech_phrase_v4_json('J''ai mangé des frites mcdo','[]'::jsonb,12);
--
-- 4) Puis une petite portion doit devenir UNE portion produit (pas quantité x N) :
-- select public.resolve_food_speech_phrase_v4_json(
--   'J''ai mangé des frites mcdo',
--   '[{"item_index":1,"option_key":"petite","confirmed":true}]'::jsonb,12
-- );
-- Attendu : quantity_mode = product_identity ; ready_to_add=true si le profil portion McDo existe.
--
-- 5) « 6 nuggets mcdo » doit demander Chicken / Veggie :
-- select public.resolve_food_speech_phrase_v4_json('J''ai mangé 6 nuggets mcdo','[]'::jsonb,12);
--
-- 6) Après choix Chicken, la quantité 6 sert à identifier la boîte de 6 ; elle ne doit
--    jamais produire 6 portions de la boîte :
-- select public.resolve_food_speech_phrase_v4_json(
--   'J''ai mangé 6 nuggets mcdo',
--   '[{"item_index":1,"option_key":"chicken","confirmed":true}]'::jsonb,12
-- );
-- Attendu : quantity_mode = product_identity et portion.source = mt_portion_profile.
--
-- 7) Cheeseburger sans marque -> question ; avec marque -> résultat McDo prioritaire :
-- select public.resolve_food_speech_phrase_v4_json('J''ai mangé un cheeseburger','[]'::jsonb,12);
-- select * from public.resolve_food_speech_v2('cheeseburger mcdo',8);
--
-- 8) Audit restant : handled_by_voice_rule=false = prochaine collision réellement à examiner.
-- select * from public.food_speech_collision_audit_v2;
