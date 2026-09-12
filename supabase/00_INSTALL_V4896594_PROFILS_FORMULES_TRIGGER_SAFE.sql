-- MÉTHODE TEE — V4896594R2 / CONTINUATION APRÈS CP483B
-- Profils culinaires déterministes + formules préparées à l'avance + trigger-safe.
-- Dépend de V4896592 + CP483B R2 déjà installé avec succès.
-- But : l'Adapter ne devine plus les rôles à compléter.
--       1) chaque aliment reçoit un profile_code stable ;
--       2) la formule role(s) présents -> role(s) manquants est pré-écrite ;
--       3) une matrice profile -> profile classe les accompagnements ;
--       4) les fiches locked restent AUTORITAIRES : aucun recalcul pairing_* par trigger.
-- Aucun appel IA / Internet au runtime. Aucun paiement / déblocage modifié.

begin;

-- -----------------------------------------------------------------------------
-- 0) Préconditions explicites : on refuse une installation sur une base incomplète.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.mt_food_culinary_profiles_v1') is null then
    raise exception 'V4896594: mt_food_culinary_profiles_v1 absent';
  end if;
  if to_regprocedure('public.mt_food_pairing_sheet_v1(text,text[],text[],text[],text,text,jsonb,jsonb)') is null then
    raise exception 'V4896594: V4896592 requis (mt_food_pairing_sheet_v1 absent)';
  end if;
  if to_regprocedure('public.mt_food_profile_roles_canonical_v2(text,text[],jsonb)') is null then
    raise exception 'V4896594: canonisation V4896592 absente';
  end if;
  if to_regprocedure('public.search_foods_v4(text,integer)') is null then
    raise exception 'V4896594: search_foods_v4 absent';
  end if;
  if to_regclass('public.mt_cp483b_overrides') is null
     or to_regclass('public.mt_cp483b_profile_backup') is null then
    raise exception 'V4896594R2: CP483B R2 doit être installé avant cette continuation';
  end if;
  if (select count(*) from public.mt_cp483b_profile_backup) <> 19 then
    raise exception 'V4896594R2: CP483B incomplet, 19 sauvegardes attendues';
  end if;
  if (select count(*) from public.mt_cp483b_overrides where enabled) <> 19 then
    raise exception 'V4896594R2: CP483B incomplet, 19 exceptions actives attendues';
  end if;
  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid='public.mt_food_culinary_profiles_v1'::regclass
      and t.tgname='zz_mt_cp483b_override' and not t.tgisinternal
      and t.tgenabled in ('O','A')
  ) then
    raise exception 'V4896594R2: trigger CP483B zz_mt_cp483b_override absent/inactif';
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 1) Catalogue des profils déterministes.
--    Les numéros sont des identifiants de familles culinaires, pas une version logicielle.
-- -----------------------------------------------------------------------------
create table if not exists public.mt_food_deterministic_profile_catalog_v1 (
  profile_code text primary key,
  structural_role text not null,
  label text not null,
  base_priority integer not null default 50,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

truncate table public.mt_food_deterministic_profile_catalog_v1;

insert into public.mt_food_deterministic_profile_catalog_v1(profile_code,structural_role,label,base_priority) values
  ('starch_v10_pasta','starch','Pâtes nature',10),
  ('starch_v11_rice','starch','Riz',11),
  ('starch_v12_bread','starch','Pain',12),
  ('starch_v13_potato','starch','Pomme de terre',13),
  ('starch_v14_cultural_tuber','starch','Tubercule / base culturelle',14),
  ('starch_v15_couscous_semolina','starch','Semoule / couscous',15),
  ('starch_v16_grain','starch','Céréale / grain',16),
  ('starch_v17_noodle','starch','Nouilles',17),
  ('starch_v19_other','starch','Autre féculent',30),

  ('protein_v23_tuna','protein','Thon',10),
  ('protein_v24_salmon','protein','Saumon',11),
  ('protein_v25_fish','protein','Poisson',12),
  ('protein_v26_seafood','protein','Fruits de mer',13),
  ('protein_v27_poultry','protein','Volaille',14),
  ('protein_v28_red_meat','protein','Viande rouge',15),
  ('protein_v29_pork_cured','protein','Porc / charcuterie',20),
  ('protein_v30_egg','protein','Œufs',16),
  ('protein_v31_plant','protein','Protéine végétale',17),
  ('protein_v32_dairy','protein','Protéine laitière',22),
  ('protein_v39_other','protein','Autre protéine',30),

  ('vegetable_v40_leafy','vegetable','Légume feuille',10),
  ('vegetable_v41_green','vegetable','Légume vert',11),
  ('vegetable_v42_mediterranean','vegetable','Légume méditerranéen',12),
  ('vegetable_v43_root','vegetable','Légume racine',13),
  ('vegetable_v44_umami','vegetable','Champignon / umami',14),
  ('vegetable_v45_raw_fresh','vegetable','Crudité / frais',15),
  ('vegetable_v46_crucifer','vegetable','Crucifère',16),
  ('vegetable_v47_squash','vegetable','Courge',17),
  ('vegetable_v48_allium','vegetable','Alliacé',24),
  ('vegetable_v49_stew','vegetable','Légume de mijoté',18),
  ('vegetable_v50_other','vegetable','Autre légume',30),

  ('composite_v60_prepared_pasta','composite','Plat de pâtes préparé',10),
  ('composite_v61_complete','composite','Plat composé complet',11),
  ('composite_v62_variable','composite','Plat composé variable',20),
  ('fruit_v70','fruit','Fruit',20),
  ('fat_v80','fat','Matière grasse',20),
  ('dairy_v81','dairy','Produit laitier',20),
  ('beverage_v90','beverage','Boisson',20),
  ('sweet_v91','sweet','Produit sucré',20),
  ('condiment_v92','condiment','Condiment',20),
  ('aromatic_v93','aromatic','Aromatique',20),
  ('other_v99','other','Autre',99);

-- Petit helper local au patch : déduplique proprement les listes de profils/rôles.
create or replace function public.mt_text_array_distinct_v6594(p_values text[])
returns text[]
language sql
immutable
set search_path=public
as $$
  select coalesce(array_agg(v order by v),'{}'::text[])
  from (
    select distinct x as v
    from unnest(coalesce($1,'{}'::text[])) x
    where nullif(btrim(x),'') is not null
  ) q;
$$;

-- -----------------------------------------------------------------------------
-- 2) Profil déterministe d'une fiche.
--    IMPORTANT : il est calculé à partir de l'identité déjà validée (roles/families).
--    Les fiches locked ne sont jamais reclassées par le trigger : leurs données
--    manuelles restent la source de vérité.
-- -----------------------------------------------------------------------------
create or replace function public.mt_food_deterministic_profile_code_v1(
  p_name text,
  p_roles text[],
  p_fill_roles text[],
  p_families text[],
  p_pairing_mode text default null,
  p_pairing_complete boolean default false
)
returns text
language plpgsql
immutable
set search_path=public
as $$
declare
  t text:=public.food_normalize(coalesce(p_name,''));
  r text[]:=coalesce(p_roles,'{}'::text[]);
  fr text[]:=coalesce(p_fill_roles,'{}'::text[]);
  f text[]:=coalesce(p_families,'{}'::text[]);
  mode text:=lower(coalesce(p_pairing_mode,''));
begin
  if 'composite'=any(r) or mode in ('prepared_composite','variable_composite') then
    if 'dish_family:prepared_pasta'=any(f) or public.mt_food_is_prepared_pasta_dish_v1(p_name) then return 'composite_v60_prepared_pasta'; end if;
    if coalesce(p_pairing_complete,false) or mode='complete' then return 'composite_v61_complete'; end if;
    return 'composite_v62_variable';
  end if;

  if 'starch'=any(r) or 'starch'=any(fr) then
    if 'base:pasta'=any(f) or public.mt_food_is_plain_pasta_v1(p_name) then return 'starch_v10_pasta'; end if;
    if 'base:rice'=any(f) or t ~ '(^| )(riz)( |$)' then return 'starch_v11_rice'; end if;
    if 'base:bread'=any(f) or t ~ '(^| )(pain|baguette|pita|tortilla|wrap)( |$)' then return 'starch_v12_bread'; end if;
    if t ~ '(^| )(pomme de terre|patate douce)( |$)' then return 'starch_v13_potato'; end if;
    if t ~ '(^| )(manioc|cassave|igname|taro|plantain|placali|foufou|foutou|eba|amala|banku|kenkey|chikwangue|kwanga|achu)( |$)' then return 'starch_v14_cultural_tuber'; end if;
    if 'base:couscous_semolina'=any(f) or t ~ '(^| )(semoule|couscous)( |$)' then return 'starch_v15_couscous_semolina'; end if;
    if 'base:noodle'=any(f) or t ~ '(^| )(nouille|nouilles|vermicelle|vermicelles)( |$)' then return 'starch_v17_noodle'; end if;
    if 'base:grain'=any(f) or t ~ '(^| )(quinoa|boulgour|avoine|orge|millet|sorgho|seigle|sarrasin|polenta|fonio|ble)( |$)' then return 'starch_v16_grain'; end if;
    return 'starch_v19_other';
  end if;

  if 'protein'=any(r) or 'protein'=any(fr) then
    if t ~ '(^| )thon( |$)' then return 'protein_v23_tuna'; end if;
    if t ~ '(^| )saumon( |$)' then return 'protein_v24_salmon'; end if;
    if 'protein:seafood'=any(f) or t ~ '(^| )(crevette|crevettes|gamba|gambas|crabe|homard|moule|moules|calamar|calamars|seiche|poulpe)( |$)' then return 'protein_v26_seafood'; end if;
    if 'protein:fish'=any(f) or t ~ '(^| )(poisson|tilapia|dorade|maquereau|sardine|sardines|cabillaud|colin|merlu|truite)( |$)' then return 'protein_v25_fish'; end if;
    if 'protein:poultry'=any(f) or t ~ '(^| )(poulet|dinde|canard|pintade)( |$)' then return 'protein_v27_poultry'; end if;
    if 'protein:pork_cured'=any(f) or t ~ '(^| )(jambon|lardon|lardons|bacon|porc|saucisson|charcuterie)( |$)' then return 'protein_v29_pork_cured'; end if;
    if 'protein:red_meat'=any(f) or t ~ '(^| )(boeuf|veau|agneau|mouton|chevre|cabri)( |$)' then return 'protein_v28_red_meat'; end if;
    if 'protein:egg'=any(f) or t ~ '(^| )(oeuf|oeufs)( |$)' then return 'protein_v30_egg'; end if;
    if 'protein:plant'=any(f) or t ~ '(^| )(tofu|tempeh|lentille|lentilles|pois chiche|pois chiches|haricot rouge|haricots rouges|seitan)( |$)' then return 'protein_v31_plant'; end if;
    if 'protein:dairy'=any(f) or t ~ '(^| )(skyr|fromage blanc|yaourt grec|petit suisse)( |$)' then return 'protein_v32_dairy'; end if;
    return 'protein_v39_other';
  end if;

  if 'vegetable'=any(r) or 'vegetable'=any(fr) then
    if 'veg:umami'=any(f) or t ~ '(^| )(champignon|champignons)( |$)' then return 'vegetable_v44_umami'; end if;
    if 'veg:leafy'=any(f) or t ~ '(^| )(epinard|epinards|salade verte|roquette|mache|blette|blettes)( |$)' then return 'vegetable_v40_leafy'; end if;
    if 'veg:crucifer'=any(f) or t ~ '(^| )(brocoli|brocolis|chou fleur|chou-fleur|choux)( |$)' then return 'vegetable_v46_crucifer'; end if;
    if 'veg:squash'=any(f) or t ~ '(^| )(courge|courges|courgette|courgettes|potiron|butternut)( |$)' then return 'vegetable_v47_squash'; end if;
    if 'veg:allium'=any(f) or t ~ '(^| )(oignon|oignons|poireau|poireaux|ail)( |$)' then return 'vegetable_v48_allium'; end if;
    if 'veg:raw_fresh'=any(f) or t ~ '(^| )(concombre|crudite|crudites|radis)( |$)' then return 'vegetable_v45_raw_fresh'; end if;
    if 'veg:mediterranean'=any(f) or t ~ '(^| )(tomate|tomates|aubergine|aubergines|poivron|poivrons)( |$)' then return 'vegetable_v42_mediterranean'; end if;
    if 'veg:root'=any(f) or t ~ '(^| )(carotte|carottes|betterave|betteraves|navet|navets)( |$)' then return 'vegetable_v43_root'; end if;
    if 'veg:stew'=any(f) or t ~ '(^| )(gombo|okra)( |$)' then return 'vegetable_v49_stew'; end if;
    if 'veg:green'=any(f) or t ~ '(^| )(haricot vert|haricots verts|asperge|asperges|petit pois|petits pois)( |$)' then return 'vegetable_v41_green'; end if;
    return 'vegetable_v50_other';
  end if;

  if 'fruit'=any(r) then return 'fruit_v70'; end if;
  if 'fat'=any(r) then return 'fat_v80'; end if;
  if 'dairy'=any(r) then return 'dairy_v81'; end if;
  if 'beverage'=any(r) then return 'beverage_v90'; end if;
  if 'sweet'=any(r) then return 'sweet_v91'; end if;
  if 'condiment'=any(r) then return 'condiment_v92'; end if;
  if 'aromatic'=any(r) then return 'aromatic_v93'; end if;
  return 'other_v99';
end;
$$;

create or replace function public.mt_food_structural_roles_v1(p_roles text[],p_fill_roles text[])
returns text[]
language sql
immutable
set search_path=public
as $$
  select array_remove(array[
    case when 'protein'=any(coalesce($1,'{}'::text[])) or 'protein'=any(coalesce($2,'{}'::text[])) then 'protein' end,
    case when 'starch'=any(coalesce($1,'{}'::text[])) or 'starch'=any(coalesce($2,'{}'::text[])) then 'starch' end,
    case when 'vegetable'=any(coalesce($1,'{}'::text[])) or 'vegetable'=any(coalesce($2,'{}'::text[])) then 'vegetable' end
  ]::text[],null);
$$;

create or replace function public.mt_food_role_signature_v1(p_roles text[])
returns text
language sql
immutable
set search_path=public
as $$
  select case
    when 'protein'=any(coalesce($1,'{}'::text[])) and 'starch'=any(coalesce($1,'{}'::text[])) and 'vegetable'=any(coalesce($1,'{}'::text[])) then 'protein+starch+vegetable'
    when 'protein'=any(coalesce($1,'{}'::text[])) and 'starch'=any(coalesce($1,'{}'::text[])) then 'protein+starch'
    when 'protein'=any(coalesce($1,'{}'::text[])) and 'vegetable'=any(coalesce($1,'{}'::text[])) then 'protein+vegetable'
    when 'starch'=any(coalesce($1,'{}'::text[])) and 'vegetable'=any(coalesce($1,'{}'::text[])) then 'starch+vegetable'
    when 'protein'=any(coalesce($1,'{}'::text[])) then 'protein'
    when 'starch'=any(coalesce($1,'{}'::text[])) then 'starch'
    when 'vegetable'=any(coalesce($1,'{}'::text[])) then 'vegetable'
    else 'none' end;
$$;

create table if not exists public.mt_food_structure_formulas_v1 (
  role_signature text primary key,
  present_roles text[] not null,
  missing_roles text[] not null,
  formula_label text not null,
  version text not null default 'V4896594',
  updated_at timestamptz not null default now()
);

truncate table public.mt_food_structure_formulas_v1;
insert into public.mt_food_structure_formulas_v1(role_signature,present_roles,missing_roles,formula_label) values
  ('none','{}'::text[],array['protein','starch','vegetable'],'Aucune brique structurelle confirmée'),
  ('protein',array['protein'],array['starch','vegetable'],'Protéine + féculent + végétal'),
  ('starch',array['starch'],array['protein','vegetable'],'Féculent + protéine + végétal'),
  ('vegetable',array['vegetable'],array['protein','starch'],'Végétal + protéine + féculent'),
  ('protein+starch',array['protein','starch'],array['vegetable'],'Protéine + féculent + végétal'),
  ('protein+vegetable',array['protein','vegetable'],array['starch'],'Protéine + végétal + féculent'),
  ('starch+vegetable',array['starch','vegetable'],array['protein'],'Féculent + végétal + protéine'),
  ('protein+starch+vegetable',array['protein','starch','vegetable'],'{}'::text[],'Structure principale complète');

create or replace function public.mt_food_deterministic_sheet_v1(
  p_name text,
  p_roles text[],
  p_fill_roles text[],
  p_families text[],
  p_pairing_mode text default null,
  p_pairing_complete boolean default false
)
returns jsonb
language plpgsql
stable
set search_path=public
as $$
declare
  sr text[]:=public.mt_food_structural_roles_v1(p_roles,p_fill_roles);
  sig text:=public.mt_food_role_signature_v1(sr);
  pc text:=public.mt_food_deterministic_profile_code_v1(p_name,p_roles,p_fill_roles,p_families,p_pairing_mode,p_pairing_complete);
  miss text[];
begin
  select missing_roles into miss from public.mt_food_structure_formulas_v1 where role_signature=sig;
  return jsonb_build_object(
    'profile_code',pc,
    'structural_roles',to_jsonb(sr),
    'role_signature',sig,
    'missing_roles',to_jsonb(coalesce(miss,'{}'::text[])),
    'formula_version','V4896594',
    'engine','deterministic_profile_matrix'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Matrice de compatibilité profil -> profil.
--    rank bas = priorité haute. Les lignes '*' garantissent une couverture générale,
--    les lignes spécifiques passent devant et évitent les assemblages aléatoires.
-- -----------------------------------------------------------------------------
create table if not exists public.mt_food_profile_compatibility_v1 (
  source_profile_code text not null,
  target_role text not null,
  target_profile_code text not null,
  rank integer not null,
  reason text not null default 'matrice TEE',
  version text not null default 'V4896594',
  updated_at timestamptz not null default now(),
  primary key(source_profile_code,target_role,target_profile_code)
);

truncate table public.mt_food_profile_compatibility_v1;

-- Couverture générale déterministe.
insert into public.mt_food_profile_compatibility_v1(source_profile_code,target_role,target_profile_code,rank,reason)
select '*',structural_role,profile_code,50+base_priority,'fallback structurel TEE'
from public.mt_food_deterministic_profile_catalog_v1
where structural_role in ('protein','starch','vegetable');

-- Pâtes.
insert into public.mt_food_profile_compatibility_v1 values
('starch_v10_pasta','protein','protein_v27_poultry',10,'pâtes + volaille','V4896594',now()),
('starch_v10_pasta','protein','protein_v28_red_meat',15,'pâtes + viande','V4896594',now()),
('starch_v10_pasta','protein','protein_v23_tuna',18,'pâtes + thon','V4896594',now()),
('starch_v10_pasta','protein','protein_v24_salmon',20,'pâtes + saumon','V4896594',now()),
('starch_v10_pasta','protein','protein_v26_seafood',22,'pâtes + fruits de mer','V4896594',now()),
('starch_v10_pasta','protein','protein_v30_egg',28,'pâtes + œuf','V4896594',now()),
('starch_v10_pasta','protein','protein_v31_plant',30,'pâtes + protéine végétale','V4896594',now()),
('starch_v10_pasta','vegetable','vegetable_v42_mediterranean',10,'pâtes + légumes méditerranéens','V4896594',now()),
('starch_v10_pasta','vegetable','vegetable_v44_umami',12,'pâtes + champignons','V4896594',now()),
('starch_v10_pasta','vegetable','vegetable_v41_green',15,'pâtes + légume vert','V4896594',now()),
('starch_v10_pasta','vegetable','vegetable_v40_leafy',18,'pâtes + feuille','V4896594',now()),
('starch_v10_pasta','vegetable','vegetable_v47_squash',25,'pâtes + courge','V4896594',now());

-- Riz.
insert into public.mt_food_profile_compatibility_v1 values
('starch_v11_rice','protein','protein_v27_poultry',10,'riz + volaille','V4896594',now()),
('starch_v11_rice','protein','protein_v23_tuna',12,'riz + thon','V4896594',now()),
('starch_v11_rice','protein','protein_v24_salmon',14,'riz + saumon','V4896594',now()),
('starch_v11_rice','protein','protein_v26_seafood',15,'riz + fruits de mer','V4896594',now()),
('starch_v11_rice','protein','protein_v25_fish',16,'riz + poisson','V4896594',now()),
('starch_v11_rice','protein','protein_v30_egg',20,'riz + œuf','V4896594',now()),
('starch_v11_rice','protein','protein_v31_plant',22,'riz + protéine végétale','V4896594',now()),
('starch_v11_rice','vegetable','vegetable_v41_green',10,'riz + vert','V4896594',now()),
('starch_v11_rice','vegetable','vegetable_v42_mediterranean',12,'riz + méditerranéen','V4896594',now()),
('starch_v11_rice','vegetable','vegetable_v45_raw_fresh',15,'riz + frais','V4896594',now()),
('starch_v11_rice','vegetable','vegetable_v46_crucifer',18,'riz + crucifère','V4896594',now()),
('starch_v11_rice','vegetable','vegetable_v43_root',20,'riz + racine','V4896594',now());

-- Pain.
insert into public.mt_food_profile_compatibility_v1 values
('starch_v12_bread','protein','protein_v23_tuna',10,'pain + thon','V4896594',now()),
('starch_v12_bread','protein','protein_v30_egg',11,'pain + œuf','V4896594',now()),
('starch_v12_bread','protein','protein_v27_poultry',13,'pain + volaille','V4896594',now()),
('starch_v12_bread','protein','protein_v29_pork_cured',15,'pain + jambon','V4896594',now()),
('starch_v12_bread','protein','protein_v24_salmon',18,'pain + saumon','V4896594',now()),
('starch_v12_bread','protein','protein_v31_plant',22,'pain + végétal','V4896594',now()),
('starch_v12_bread','vegetable','vegetable_v45_raw_fresh',10,'pain + crudité','V4896594',now()),
('starch_v12_bread','vegetable','vegetable_v42_mediterranean',11,'pain + tomate/poivron','V4896594',now()),
('starch_v12_bread','vegetable','vegetable_v40_leafy',13,'pain + feuille','V4896594',now()),
('starch_v12_bread','vegetable','vegetable_v44_umami',16,'pain + champignon','V4896594',now());

-- Pomme de terre / tubercules / semoule / grains / nouilles.
insert into public.mt_food_profile_compatibility_v1 values
('starch_v13_potato','protein','protein_v25_fish',10,'pomme de terre + poisson','V4896594',now()),
('starch_v13_potato','protein','protein_v24_salmon',11,'pomme de terre + saumon','V4896594',now()),
('starch_v13_potato','protein','protein_v27_poultry',13,'pomme de terre + volaille','V4896594',now()),
('starch_v13_potato','protein','protein_v30_egg',16,'pomme de terre + œuf','V4896594',now()),
('starch_v13_potato','protein','protein_v28_red_meat',18,'pomme de terre + viande','V4896594',now()),
('starch_v13_potato','vegetable','vegetable_v41_green',10,'pomme de terre + vert','V4896594',now()),
('starch_v13_potato','vegetable','vegetable_v46_crucifer',11,'pomme de terre + crucifère','V4896594',now()),
('starch_v13_potato','vegetable','vegetable_v44_umami',13,'pomme de terre + champignon','V4896594',now()),
('starch_v13_potato','vegetable','vegetable_v42_mediterranean',16,'pomme de terre + méditerranéen','V4896594',now()),
('starch_v14_cultural_tuber','protein','protein_v25_fish',10,'tubercule + poisson','V4896594',now()),
('starch_v14_cultural_tuber','protein','protein_v28_red_meat',12,'tubercule + viande','V4896594',now()),
('starch_v14_cultural_tuber','protein','protein_v27_poultry',15,'tubercule + volaille','V4896594',now()),
('starch_v14_cultural_tuber','protein','protein_v31_plant',18,'tubercule + végétal','V4896594',now()),
('starch_v14_cultural_tuber','vegetable','vegetable_v49_stew',10,'base culturelle + mijoté','V4896594',now()),
('starch_v14_cultural_tuber','vegetable','vegetable_v40_leafy',12,'base culturelle + feuille','V4896594',now()),
('starch_v14_cultural_tuber','vegetable','vegetable_v41_green',15,'base culturelle + vert','V4896594',now()),
('starch_v15_couscous_semolina','protein','protein_v27_poultry',10,'semoule + volaille','V4896594',now()),
('starch_v15_couscous_semolina','protein','protein_v28_red_meat',11,'semoule + viande','V4896594',now()),
('starch_v15_couscous_semolina','protein','protein_v31_plant',14,'semoule + végétal','V4896594',now()),
('starch_v15_couscous_semolina','vegetable','vegetable_v49_stew',10,'semoule + mijoté','V4896594',now()),
('starch_v15_couscous_semolina','vegetable','vegetable_v43_root',11,'semoule + racines','V4896594',now()),
('starch_v15_couscous_semolina','vegetable','vegetable_v42_mediterranean',14,'semoule + méditerranéen','V4896594',now()),
('starch_v16_grain','protein','protein_v27_poultry',10,'grain + volaille','V4896594',now()),
('starch_v16_grain','protein','protein_v30_egg',13,'grain + œuf','V4896594',now()),
('starch_v16_grain','protein','protein_v31_plant',15,'grain + végétal','V4896594',now()),
('starch_v16_grain','protein','protein_v25_fish',17,'grain + poisson','V4896594',now()),
('starch_v16_grain','vegetable','vegetable_v41_green',10,'grain + vert','V4896594',now()),
('starch_v16_grain','vegetable','vegetable_v42_mediterranean',12,'grain + méditerranéen','V4896594',now()),
('starch_v16_grain','vegetable','vegetable_v43_root',15,'grain + racine','V4896594',now()),
('starch_v17_noodle','protein','protein_v27_poultry',10,'nouilles + volaille','V4896594',now()),
('starch_v17_noodle','protein','protein_v26_seafood',11,'nouilles + fruits de mer','V4896594',now()),
('starch_v17_noodle','protein','protein_v30_egg',13,'nouilles + œuf','V4896594',now()),
('starch_v17_noodle','protein','protein_v31_plant',16,'nouilles + végétal','V4896594',now()),
('starch_v17_noodle','vegetable','vegetable_v41_green',10,'nouilles + vert','V4896594',now()),
('starch_v17_noodle','vegetable','vegetable_v46_crucifer',11,'nouilles + crucifère','V4896594',now()),
('starch_v17_noodle','vegetable','vegetable_v44_umami',13,'nouilles + champignon','V4896594',now());

-- Protéines -> féculents + végétaux.
insert into public.mt_food_profile_compatibility_v1 values
('protein_v23_tuna','starch','starch_v12_bread',10,'thon + pain','V4896594',now()),
('protein_v23_tuna','starch','starch_v11_rice',11,'thon + riz','V4896594',now()),
('protein_v23_tuna','starch','starch_v10_pasta',13,'thon + pâtes','V4896594',now()),
('protein_v23_tuna','starch','starch_v13_potato',15,'thon + pomme de terre','V4896594',now()),
('protein_v23_tuna','vegetable','vegetable_v45_raw_fresh',10,'thon + crudité','V4896594',now()),
('protein_v23_tuna','vegetable','vegetable_v42_mediterranean',11,'thon + tomate/poivron','V4896594',now()),
('protein_v23_tuna','vegetable','vegetable_v41_green',13,'thon + vert','V4896594',now()),
('protein_v23_tuna','vegetable','vegetable_v40_leafy',15,'thon + feuille','V4896594',now()),
('protein_v24_salmon','starch','starch_v13_potato',10,'saumon + pomme de terre','V4896594',now()),
('protein_v24_salmon','starch','starch_v11_rice',11,'saumon + riz','V4896594',now()),
('protein_v24_salmon','starch','starch_v16_grain',13,'saumon + grain','V4896594',now()),
('protein_v24_salmon','starch','starch_v10_pasta',16,'saumon + pâtes','V4896594',now()),
('protein_v24_salmon','vegetable','vegetable_v41_green',10,'saumon + vert','V4896594',now()),
('protein_v24_salmon','vegetable','vegetable_v42_mediterranean',11,'saumon + méditerranéen','V4896594',now()),
('protein_v24_salmon','vegetable','vegetable_v40_leafy',13,'saumon + feuille','V4896594',now()),
('protein_v24_salmon','vegetable','vegetable_v46_crucifer',15,'saumon + crucifère','V4896594',now()),
('protein_v25_fish','starch','starch_v13_potato',10,'poisson + pomme de terre','V4896594',now()),
('protein_v25_fish','starch','starch_v11_rice',11,'poisson + riz','V4896594',now()),
('protein_v25_fish','starch','starch_v15_couscous_semolina',14,'poisson + semoule','V4896594',now()),
('protein_v25_fish','vegetable','vegetable_v41_green',10,'poisson + vert','V4896594',now()),
('protein_v25_fish','vegetable','vegetable_v42_mediterranean',12,'poisson + méditerranéen','V4896594',now()),
('protein_v25_fish','vegetable','vegetable_v43_root',15,'poisson + racine','V4896594',now()),
('protein_v26_seafood','starch','starch_v11_rice',10,'fruits de mer + riz','V4896594',now()),
('protein_v26_seafood','starch','starch_v10_pasta',11,'fruits de mer + pâtes','V4896594',now()),
('protein_v26_seafood','starch','starch_v17_noodle',13,'fruits de mer + nouilles','V4896594',now()),
('protein_v26_seafood','vegetable','vegetable_v42_mediterranean',10,'fruits de mer + méditerranéen','V4896594',now()),
('protein_v26_seafood','vegetable','vegetable_v41_green',12,'fruits de mer + vert','V4896594',now()),
('protein_v27_poultry','starch','starch_v11_rice',10,'volaille + riz','V4896594',now()),
('protein_v27_poultry','starch','starch_v13_potato',11,'volaille + pomme de terre','V4896594',now()),
('protein_v27_poultry','starch','starch_v10_pasta',13,'volaille + pâtes','V4896594',now()),
('protein_v27_poultry','starch','starch_v15_couscous_semolina',15,'volaille + semoule','V4896594',now()),
('protein_v27_poultry','starch','starch_v12_bread',18,'volaille + pain','V4896594',now()),
('protein_v27_poultry','vegetable','vegetable_v41_green',10,'volaille + vert','V4896594',now()),
('protein_v27_poultry','vegetable','vegetable_v42_mediterranean',11,'volaille + méditerranéen','V4896594',now()),
('protein_v27_poultry','vegetable','vegetable_v43_root',13,'volaille + racine','V4896594',now()),
('protein_v27_poultry','vegetable','vegetable_v46_crucifer',15,'volaille + crucifère','V4896594',now()),
('protein_v27_poultry','vegetable','vegetable_v44_umami',17,'volaille + champignon','V4896594',now()),
('protein_v28_red_meat','starch','starch_v13_potato',10,'viande + pomme de terre','V4896594',now()),
('protein_v28_red_meat','starch','starch_v11_rice',13,'viande + riz','V4896594',now()),
('protein_v28_red_meat','starch','starch_v10_pasta',15,'viande + pâtes','V4896594',now()),
('protein_v28_red_meat','starch','starch_v12_bread',17,'viande + pain','V4896594',now()),
('protein_v28_red_meat','vegetable','vegetable_v41_green',10,'viande + vert','V4896594',now()),
('protein_v28_red_meat','vegetable','vegetable_v43_root',11,'viande + racine','V4896594',now()),
('protein_v28_red_meat','vegetable','vegetable_v44_umami',13,'viande + champignon','V4896594',now()),
('protein_v28_red_meat','vegetable','vegetable_v49_stew',15,'viande + mijoté','V4896594',now()),
('protein_v29_pork_cured','starch','starch_v12_bread',10,'jambon + pain','V4896594',now()),
('protein_v29_pork_cured','starch','starch_v13_potato',11,'jambon + pomme de terre','V4896594',now()),
('protein_v29_pork_cured','starch','starch_v10_pasta',13,'jambon + pâtes','V4896594',now()),
('protein_v29_pork_cured','vegetable','vegetable_v44_umami',10,'jambon + champignon','V4896594',now()),
('protein_v29_pork_cured','vegetable','vegetable_v41_green',13,'jambon + vert','V4896594',now()),
('protein_v29_pork_cured','vegetable','vegetable_v42_mediterranean',15,'jambon + méditerranéen','V4896594',now()),
('protein_v30_egg','starch','starch_v12_bread',10,'œufs + pain','V4896594',now()),
('protein_v30_egg','starch','starch_v13_potato',11,'œufs + pomme de terre','V4896594',now()),
('protein_v30_egg','starch','starch_v16_grain',14,'œufs + céréale','V4896594',now()),
('protein_v30_egg','starch','starch_v11_rice',16,'œufs + riz','V4896594',now()),
('protein_v30_egg','vegetable','vegetable_v44_umami',10,'œufs + champignon','V4896594',now()),
('protein_v30_egg','vegetable','vegetable_v42_mediterranean',11,'œufs + tomate','V4896594',now()),
('protein_v30_egg','vegetable','vegetable_v41_green',13,'œufs + vert','V4896594',now()),
('protein_v30_egg','vegetable','vegetable_v40_leafy',15,'œufs + feuille','V4896594',now()),
('protein_v31_plant','starch','starch_v11_rice',10,'protéine végétale + riz','V4896594',now()),
('protein_v31_plant','starch','starch_v16_grain',11,'protéine végétale + grain','V4896594',now()),
('protein_v31_plant','starch','starch_v12_bread',13,'protéine végétale + pain','V4896594',now()),
('protein_v31_plant','starch','starch_v15_couscous_semolina',15,'protéine végétale + semoule','V4896594',now()),
('protein_v31_plant','vegetable','vegetable_v42_mediterranean',10,'protéine végétale + méditerranéen','V4896594',now()),
('protein_v31_plant','vegetable','vegetable_v41_green',11,'protéine végétale + vert','V4896594',now()),
('protein_v31_plant','vegetable','vegetable_v43_root',13,'protéine végétale + racine','V4896594',now());

-- Végétaux -> protéine + féculent.
insert into public.mt_food_profile_compatibility_v1 values
('vegetable_v42_mediterranean','protein','protein_v27_poultry',10,'méditerranéen + volaille','V4896594',now()),
('vegetable_v42_mediterranean','protein','protein_v23_tuna',11,'méditerranéen + thon','V4896594',now()),
('vegetable_v42_mediterranean','protein','protein_v25_fish',13,'méditerranéen + poisson','V4896594',now()),
('vegetable_v42_mediterranean','protein','protein_v30_egg',15,'méditerranéen + œuf','V4896594',now()),
('vegetable_v42_mediterranean','starch','starch_v10_pasta',10,'tomate/poivron + pâtes','V4896594',now()),
('vegetable_v42_mediterranean','starch','starch_v11_rice',11,'méditerranéen + riz','V4896594',now()),
('vegetable_v42_mediterranean','starch','starch_v12_bread',13,'méditerranéen + pain','V4896594',now()),
('vegetable_v42_mediterranean','starch','starch_v13_potato',15,'méditerranéen + pomme de terre','V4896594',now()),
('vegetable_v44_umami','protein','protein_v30_egg',10,'champignon + œuf','V4896594',now()),
('vegetable_v44_umami','protein','protein_v27_poultry',11,'champignon + volaille','V4896594',now()),
('vegetable_v44_umami','protein','protein_v28_red_meat',13,'champignon + viande','V4896594',now()),
('vegetable_v44_umami','protein','protein_v29_pork_cured',15,'champignon + jambon','V4896594',now()),
('vegetable_v44_umami','starch','starch_v10_pasta',10,'champignon + pâtes','V4896594',now()),
('vegetable_v44_umami','starch','starch_v13_potato',11,'champignon + pomme de terre','V4896594',now()),
('vegetable_v44_umami','starch','starch_v11_rice',13,'champignon + riz','V4896594',now()),
('vegetable_v40_leafy','protein','protein_v30_egg',10,'feuille + œuf','V4896594',now()),
('vegetable_v40_leafy','protein','protein_v27_poultry',11,'feuille + volaille','V4896594',now()),
('vegetable_v40_leafy','protein','protein_v25_fish',13,'feuille + poisson','V4896594',now()),
('vegetable_v40_leafy','starch','starch_v13_potato',10,'feuille + pomme de terre','V4896594',now()),
('vegetable_v40_leafy','starch','starch_v11_rice',11,'feuille + riz','V4896594',now()),
('vegetable_v40_leafy','starch','starch_v12_bread',13,'feuille + pain','V4896594',now()),
('vegetable_v41_green','protein','protein_v27_poultry',10,'vert + volaille','V4896594',now()),
('vegetable_v41_green','protein','protein_v25_fish',11,'vert + poisson','V4896594',now()),
('vegetable_v41_green','protein','protein_v30_egg',13,'vert + œuf','V4896594',now()),
('vegetable_v41_green','starch','starch_v13_potato',10,'vert + pomme de terre','V4896594',now()),
('vegetable_v41_green','starch','starch_v11_rice',11,'vert + riz','V4896594',now()),
('vegetable_v41_green','starch','starch_v10_pasta',13,'vert + pâtes','V4896594',now()),
('vegetable_v43_root','protein','protein_v27_poultry',10,'racine + volaille','V4896594',now()),
('vegetable_v43_root','protein','protein_v28_red_meat',11,'racine + viande','V4896594',now()),
('vegetable_v43_root','protein','protein_v25_fish',13,'racine + poisson','V4896594',now()),
('vegetable_v43_root','starch','starch_v13_potato',10,'racine + pomme de terre','V4896594',now()),
('vegetable_v43_root','starch','starch_v11_rice',11,'racine + riz','V4896594',now()),
('vegetable_v43_root','starch','starch_v16_grain',13,'racine + grain','V4896594',now()),
('vegetable_v45_raw_fresh','protein','protein_v23_tuna',10,'crudité + thon','V4896594',now()),
('vegetable_v45_raw_fresh','protein','protein_v30_egg',11,'crudité + œuf','V4896594',now()),
('vegetable_v45_raw_fresh','protein','protein_v27_poultry',13,'crudité + volaille','V4896594',now()),
('vegetable_v45_raw_fresh','protein','protein_v31_plant',15,'crudité + végétal','V4896594',now()),
('vegetable_v45_raw_fresh','starch','starch_v12_bread',10,'crudité + pain','V4896594',now()),
('vegetable_v45_raw_fresh','starch','starch_v11_rice',11,'crudité + riz','V4896594',now()),
('vegetable_v45_raw_fresh','starch','starch_v13_potato',13,'crudité + pomme de terre','V4896594',now()),
('vegetable_v46_crucifer','protein','protein_v25_fish',10,'crucifère + poisson','V4896594',now()),
('vegetable_v46_crucifer','protein','protein_v27_poultry',11,'crucifère + volaille','V4896594',now()),
('vegetable_v46_crucifer','protein','protein_v30_egg',13,'crucifère + œuf','V4896594',now()),
('vegetable_v46_crucifer','starch','starch_v13_potato',10,'crucifère + pomme de terre','V4896594',now()),
('vegetable_v46_crucifer','starch','starch_v11_rice',11,'crucifère + riz','V4896594',now()),
('vegetable_v47_squash','protein','protein_v27_poultry',10,'courge + volaille','V4896594',now()),
('vegetable_v47_squash','protein','protein_v25_fish',11,'courge + poisson','V4896594',now()),
('vegetable_v47_squash','protein','protein_v30_egg',13,'courge + œuf','V4896594',now()),
('vegetable_v47_squash','starch','starch_v11_rice',10,'courge + riz','V4896594',now()),
('vegetable_v47_squash','starch','starch_v13_potato',11,'courge + pomme de terre','V4896594',now()),
('vegetable_v49_stew','protein','protein_v28_red_meat',10,'mijoté + viande','V4896594',now()),
('vegetable_v49_stew','protein','protein_v27_poultry',11,'mijoté + volaille','V4896594',now()),
('vegetable_v49_stew','protein','protein_v25_fish',13,'mijoté + poisson','V4896594',now()),
('vegetable_v49_stew','starch','starch_v11_rice',10,'mijoté + riz','V4896594',now()),
('vegetable_v49_stew','starch','starch_v15_couscous_semolina',11,'mijoté + semoule','V4896594',now()),
('vegetable_v49_stew','starch','starch_v14_cultural_tuber',13,'mijoté + base culturelle','V4896594',now());

-- -----------------------------------------------------------------------------
-- 4) Qualité de candidat + priorité de recherche (lait/thon notamment).
-- -----------------------------------------------------------------------------
create or replace function public.mt_food_deterministic_candidate_penalty_v1(p_name text,p_role text)
returns integer
language plpgsql
immutable
set search_path=public
as $$
declare t text:=public.food_normalize(coalesce(p_name,'')); v integer:=0;
begin
  if t ~ '(^| )(nourrisson|1er age|premier age|2e age|deuxieme age|preparation de suite|lait de croissance|infantile)( |$)' then v:=v+1000; end if;
  if t ~ '(^| )(preemballe|preemballee|preemballees|plat prepare|sandwich|pizza|burger|quiche)( |$)' then v:=v+180; end if;
  if t ~ '(^| )(poudre soluble|deshydrate|deshydratee|vapeur sous pression)( |$)' then v:=v+35; end if;
  if p_role='vegetable' and t ~ '(^| )(seche|sechee|sechees|deshydrate|conserve)( |$)' then v:=v+90; end if;
  if p_role='starch' and t ~ '(^| )(biscotte|cracker|chips|galette de riz)( |$)' then v:=v+120; end if;
  if p_role='protein' and t ~ '(^| )(nugget|nuggets|pane|panee)( |$)' then v:=v+90; end if;

  -- À compatibilité égale, les repères quotidiens simples passent avant les libellés techniques.
  if p_role='vegetable' then
    if t ~ '(^| )(tomate|tomates|concombre|concombres|champignon|champignons)( |,|$)' then v:=v-22;
    elsif t ~ '(^| )(courgette|courgettes|brocoli|brocolis|epinard|epinards|haricot vert|haricots verts)( |,|$)' then v:=v-18;
    elsif t ~ '(^| )(carotte|carottes|aubergine|aubergines|poivron|poivrons)( |,|$)' then v:=v-12; end if;
  elsif p_role='starch' then
    if t ~ '(^| )(riz|pomme de terre|pain)( |,|$)' then v:=v-22;
    elsif t ~ '(^| )(pates|pasta|macaroni|maccheroni|spaghetti|semoule|quinoa|boulgour)( |,|$)' then v:=v-16; end if;
  elsif p_role='protein' then
    if t ~ '(^| )(poulet|oeuf|oeufs|thon|saumon)( |,|$)' then v:=v-22;
    elsif t ~ '(^| )(dinde|poisson|tofu|lentille|lentilles|pois chiche|pois chiches)( |,|$)' then v:=v-16;
    elsif t ~ '(^| )jambon( |,|$)' then v:=v-14; end if;
  end if;
  return v;
end;
$$;

create or replace function public.mt_food_reference_priority_v1(p_input text,p_name text)
returns integer
language plpgsql
immutable
set search_path=public
as $$
declare q text:=public.food_normalize(coalesce(p_input,'')); t text:=public.food_normalize(coalesce(p_name,'')); s integer:=100;
begin
  if q in ('lait','laits') then
    if t ~ '(^| )(nourrisson|1er age|premier age|2e age|deuxieme age|preparation de suite|lait de croissance|infantile)( |$)' then return 10000; end if;
    if t ~ 'lait demi ecreme' then return 1; end if;
    if t ~ 'lait entier' then return 2; end if;
    if t ~ 'lait ecreme' then return 3; end if;
    if t ~ 'lait de vache' then return 4; end if;
    if t ~ '(^| )lait( |$)' then return 10; end if;
  end if;
  if q='thon' then
    if t ~ 'thon.*(au naturel|naturel)' then return 1; end if;
    if t ~ 'thon.*huile' then return 10; end if;
    if t ~ 'thon.*tomate' then return 20; end if;
    if t ~ '(^| )thon( |$)' then return 5; end if;
  end if;
  if q in ('oeuf','oeufs') and t ~ '(^| )oeufs?( |,|$)' then return 5; end if;
  if q in ('pain','pains') and t ~ '(^| )pain( |,|$)' then return 5; end if;
  return s;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) Trigger corrigé.
--    La cause fournie par le diagnostic est corrigée ici : LOCKED sort AVANT tout
--    recalcul. Les colonnes pairing_* et profile.pairing viennent du MÊME sh pour
--    les fiches non verrouillées.
-- -----------------------------------------------------------------------------
create or replace function public.mt_food_profile_semantic_xy_before_write_v6594()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  a jsonb:='{}'::jsonb;
  o jsonb:='[]'::jsonb;
  sh jsonb;
  det jsonb;
  new_roles text[];
  new_families text[];
  new_fill text[];
  new_accepts text[];
  identity_kind text;
begin
  -- Une fiche verrouillée est une exception culinaire validée.
  -- AUCUN rôle, famille, accepts, pairing_* ni profile.pairing n'est recalculé.
  -- On ajoute seulement l'identifiant déterministe dérivé des champs MANUELS déjà validés.
  if coalesce(new.locked,false) then
    det:=public.mt_food_deterministic_sheet_v1(
      new.display_name,new.roles,new.fill_roles,new.families,new.pairing_mode,new.pairing_complete
    );
    new.profile:=jsonb_set(coalesce(new.profile,'{}'::jsonb),'{deterministic}',det,true);
    return new;
  end if;

  if new.dictionary_id is not null then
    select coalesce(adapter_profile,'{}'::jsonb),coalesce(optional_components,'[]'::jsonb)
      into a,o from public.food_dictionary where id=new.dictionary_id;
  end if;

  new_roles:=public.mt_food_profile_roles_canonical_v2(new.display_name,new.roles,a);
  new_families:=public.mt_food_profile_families_canonical_v3(new.display_name,new_roles,new.families,a);
  new_fill:=public.mt_food_profile_fill_roles_v1(new_roles,a,new_families);
  if public.mt_food_is_plain_pasta_v1(new.display_name) then new_fill:=array['starch']::text[]; end if;
  if public.mt_food_is_prepared_pasta_dish_v1(new.display_name) then new_fill:='{}'::text[]; end if;

  new_accepts:=case when cardinality(new_fill)=0 then '{}'::text[]
                    else public.mt_food_profile_accepts_v1(new_families,new_roles) end;
  new.roles:=new_roles;
  new.families:=new_families;
  new.fill_roles:=new_fill;
  new.accepts:=new_accepts;

  if public.mt_food_is_prepared_pasta_dish_v1(new.display_name) or 'composite'=any(new.roles) then
    identity_kind:='composite';
  else
    identity_kind:=public.mt_food_profile_identity_kind_v2(new.display_name,new.roles,a);
    if public.mt_food_is_plain_pasta_v1(new.display_name) then identity_kind:='simple'; end if;
  end if;

  new.service_modes:=case
    when 'service:cold'=any(new.families)
         and not ('service:any'=any(new.families))
         and not ('service:hot_or_any'=any(new.families)) then array['cold']::text[]
    when 'service:any'=any(new.families) or 'service:hot_or_any'=any(new.families) then array['hot','cold']::text[]
    else coalesce(new.service_modes,array['hot','cold']::text[])
  end;

  new.profile:=coalesce(new.profile,'{}'::jsonb)||jsonb_build_object(
    'roles',to_jsonb(new.roles),'families',to_jsonb(new.families),
    'fill_roles',to_jsonb(new.fill_roles),'accepts',to_jsonb(new.accepts),
    'identity_kind',identity_kind,
    'dish_kind',case when 'composite'=any(new.roles) then 'composite' else 'ingredient' end,
    'candidate_eligible',public.mt_food_profile_candidate_eligible_v1(new.display_name,new.roles,new.fill_roles,new.families)
  );

  sh:=public.mt_food_pairing_sheet_v1(new.display_name,new.roles,new.families,new.accepts,new.country,new.culture,a,o);
  sh:=jsonb_set(sh,'{version}',to_jsonb('V4896594'::text),true);

  -- Une seule feuille sh alimente les colonnes ET le JSON : impossible de diverger.
  new.pairing_mode:=sh->>'mode';
  new.pairing_culture:=coalesce(sh->>'culture','');
  new.pairing_strong_families:=public.mt_jsonb_text_array_v1(sh->'strong_families');
  new.pairing_possible_families:=public.mt_jsonb_text_array_v1(sh->'possible_families');
  new.pairing_avoid_families:=public.mt_jsonb_text_array_v1(sh->'avoid_families');
  new.pairing_strong_terms:=public.mt_jsonb_text_array_v1(sh->'strong_terms');
  new.pairing_requires_accompaniment:=coalesce((sh->>'requires_accompaniment')::boolean,false);
  new.pairing_complete:=coalesce((sh->>'complete')::boolean,false);
  new.pairing_version:='V4896594';
  new.profile:=jsonb_set(coalesce(new.profile,'{}'::jsonb),'{pairing}',sh,true);

  det:=public.mt_food_deterministic_sheet_v1(
    new.display_name,new.roles,new.fill_roles,new.families,new.pairing_mode,new.pairing_complete
  );
  new.profile:=jsonb_set(coalesce(new.profile,'{}'::jsonb),'{deterministic}',det,true);
  return new;
end;
$$;

drop trigger if exists aa_mt_food_profile_semantic_xy_before_write_v6589 on public.mt_food_culinary_profiles_v1;
drop trigger if exists aa_mt_food_profile_semantic_xy_before_write_v6590 on public.mt_food_culinary_profiles_v1;
drop trigger if exists aa_mt_food_profile_semantic_xy_before_write_v6591 on public.mt_food_culinary_profiles_v1;
drop trigger if exists aa_mt_food_profile_semantic_xy_before_write_v6592 on public.mt_food_culinary_profiles_v1;
drop trigger if exists aa_mt_food_profile_semantic_xy_before_write_v6594 on public.mt_food_culinary_profiles_v1;

create trigger aa_mt_food_profile_semantic_xy_before_write_v6594
before insert or update of display_name,country,culture,roles,fill_roles,families,accepts,profile,dictionary_id,ciqual_code,locked
on public.mt_food_culinary_profiles_v1
for each row execute function public.mt_food_profile_semantic_xy_before_write_v6594();


create or replace function public.mt_food_deterministic_finalize_v6594()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare det jsonb;
begin
  det:=public.mt_food_deterministic_sheet_v1(
    new.display_name,new.roles,new.fill_roles,new.families,new.pairing_mode,new.pairing_complete
  );
  new.profile:=jsonb_set(coalesce(new.profile,'{}'::jsonb),'{deterministic}',det,true);
  return new;
end;
$$;

drop trigger if exists zzz_mt_food_deterministic_finalize_v6594 on public.mt_food_culinary_profiles_v1;
create trigger zzz_mt_food_deterministic_finalize_v6594
before insert or update of display_name,roles,fill_roles,families,profile,pairing_mode,pairing_complete,locked
on public.mt_food_culinary_profiles_v1
for each row execute function public.mt_food_deterministic_finalize_v6594();

-- -----------------------------------------------------------------------------
-- 6) Resolver de précision : même bibliothèque, mais on demande plus de candidats
--    AVANT filtrage. C'est ce qui empêche « lait » d'afficher uniquement du lait bébé.
-- -----------------------------------------------------------------------------
create or replace function public.mt_adapter_reference_candidates_v1(p_input_text text default '')
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid:=auth.uid(); outj jsonb:='[]'::jsonb;
begin
  if uid is null then raise exception 'auth required'; end if;

  with segs as (
    select row_number() over() ord,btrim(x) input,
      btrim(regexp_replace(btrim(x),'[0-9]+([.,][0-9]+)?[[:space:]]*(g|gr|grammes?|ml)',' ','gi')) query_input
    from regexp_split_to_table(left(coalesce(p_input_text,''),1000),'\s*(?:\+|,|;|/|&)\s*|\s+et\s+|\s+avec\s+','i') x
    where length(public.food_normalize(x))>=2
    limit 10
  ), hits as (
    select s.ord,s.input,f.*,p.roles,p.fill_roles,p.families,p.accepts,p.profile,
      p.pairing_mode,p.pairing_strong_families,p.pairing_possible_families,p.pairing_avoid_families,
      p.pairing_strong_terms,p.pairing_requires_accompaniment,p.pairing_complete,
      coalesce(p.profile #>> '{deterministic,profile_code}',
        public.mt_food_deterministic_profile_code_v1(
          coalesce(p.display_name,f.display_name,f.name),p.roles,p.fill_roles,p.families,p.pairing_mode,p.pairing_complete
        )) deterministic_profile_code,
      public.mt_food_reference_priority_v1(s.input,coalesce(f.display_name,f.name)) ref_priority
    from segs s
    cross join lateral public.search_foods_v4(
      case when length(public.food_normalize(s.query_input))>=2 then s.query_input else s.input end,
      20
    ) f
    left join lateral (
      select pp.* from public.mt_food_culinary_profiles_v1 pp
      where (f.dictionary_id is not null and pp.dictionary_id=f.dictionary_id)
         or (f.code is not null and pp.ciqual_code::text=f.code::text)
      order by (case when f.dictionary_id is not null and pp.dictionary_id=f.dictionary_id then 0 else 1 end),
               coalesce(pp.locked,false) desc,pp.profile_key
      limit 1
    ) p on true
    where f.code is not null or f.dictionary_id is not null
  ), ranked as (
    select h.*,
      row_number() over(partition by h.ord order by h.ref_priority,coalesce(h.match_rank,999),public.food_normalize(coalesce(h.display_name,h.name))) rn
    from hits h
    where not (
      public.food_normalize(h.input) in ('lait','laits')
      and public.mt_food_reference_priority_v1(h.input,coalesce(h.display_name,h.name))>=10000
    )
  ), grouped as (
    select s.ord,s.input,coalesce((
      select jsonb_agg(jsonb_build_object(
        'code',r.code,'name',r.name,'dictionary_id',r.dictionary_id,'display_name',r.display_name,
        'country',r.country,'categories',coalesce(r.categories,'{}'::text[]),'adapter_profile',coalesce(r.adapter_profile,'{}'::jsonb),
        'match_rank',r.ref_priority,'kcal_100g',r.kcal_100g,'protein_100g',r.protein_100g,'fat_100g',r.fat_100g,
        'carbs_100g',r.carbs_100g,'fiber_100g',r.fiber_100g,'salt_100g',r.salt_100g,
        'micronutrients_100g',coalesce(r.micronutrients_100g,'{}'::jsonb),'nutrition_extra_100g',coalesce(r.nutrition_extra_100g,'{}'::jsonb),
        'roles',coalesce(r.roles,'{}'::text[]),'fill_roles',coalesce(r.fill_roles,'{}'::text[]),
        'families',coalesce(r.families,'{}'::text[]),'accepts',coalesce(r.accepts,'{}'::text[]),
        'profile',coalesce(r.profile,'{}'::jsonb),'pairing_mode',r.pairing_mode,
        'pairing_strong_families',coalesce(r.pairing_strong_families,'{}'::text[]),
        'pairing_possible_families',coalesce(r.pairing_possible_families,'{}'::text[]),
        'pairing_avoid_families',coalesce(r.pairing_avoid_families,'{}'::text[]),
        'pairing_strong_terms',coalesce(r.pairing_strong_terms,'{}'::text[]),
        'pairing_requires_accompaniment',coalesce(r.pairing_requires_accompaniment,false),
        'pairing_complete',coalesce(r.pairing_complete,false),'deterministic_profile_code',r.deterministic_profile_code,
        'source','V4896594_reference_resolver'
      ) order by r.rn)
      from ranked r where r.ord=s.ord and r.rn<=8
    ),'[]'::jsonb) candidates
    from segs s
  )
  select coalesce(jsonb_agg(jsonb_build_object('input',input,'candidates',candidates) order by ord),'[]'::jsonb)
    into outj from grouped;
  return outj;
end;
$$;

revoke all on function public.mt_adapter_reference_candidates_v1(text) from public,anon;
grant execute on function public.mt_adapter_reference_candidates_v1(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 7) Pool déterministe par rôle.
-- -----------------------------------------------------------------------------
create or replace function public.mt_food_deterministic_pool_v1(
  p_source_profiles text[],
  p_target_role text,
  p_exclude_dictionary_ids uuid[] default '{}'::uuid[],
  p_exclude_ciqual_codes text[] default '{}'::text[],
  p_limit integer default 12
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
with candidates as (
  select p.*,
    coalesce(p.profile #>> '{deterministic,profile_code}',
      public.mt_food_deterministic_profile_code_v1(p.display_name,p.roles,p.fill_roles,p.families,p.pairing_mode,p.pairing_complete)
    ) profile_code,
    public.mt_food_deterministic_candidate_penalty_v1(p.display_name,$2) quality_penalty
  from public.mt_food_culinary_profiles_v1 p
  where ($2=any(coalesce(p.roles,'{}'::text[])) or $2=any(coalesce(p.fill_roles,'{}'::text[])))
    and not ('composite'=any(coalesce(p.roles,'{}'::text[])))
    and coalesce(p.pairing_complete,false)=false
    and lower(coalesce(p.profile->>'candidate_eligible','true')) <> 'false'
    and (p.dictionary_id is null or not (p.dictionary_id=any(coalesce($3,'{}'::uuid[]))))
    and (p.ciqual_code is null or not (p.ciqual_code::text=any(coalesce($4,'{}'::text[]))))
), src as (
  select distinct x source_profile from unnest(coalesce($1,'{}'::text[])) x
), compat as (
  select c.profile_key,c.profile_code,
    sum(coalesce(spec.rank,generic.rank,999))::numeric / greatest(1,(select count(*) from src)) avg_rank,
    max(case when coalesce(spec.rank,generic.rank) is null then 1 else 0 end) missing_matrix
  from candidates c
  cross join src s
  left join public.mt_food_profile_compatibility_v1 spec
    on spec.source_profile_code=s.source_profile and spec.target_role=$2 and spec.target_profile_code=c.profile_code
  left join public.mt_food_profile_compatibility_v1 generic
    on generic.source_profile_code='*' and generic.target_role=$2 and generic.target_profile_code=c.profile_code
  group by c.profile_key,c.profile_code
), scored as (
  select c.*,coalesce(cp.avg_rank,80)+c.quality_penalty total_rank
  from candidates c
  join compat cp on cp.profile_key=c.profile_key and cp.missing_matrix=0
  where c.quality_penalty<900
), dedup as (
  select s.*,row_number() over(
    partition by coalesce(s.dictionary_id::text,nullif(s.ciqual_code::text,''),public.food_normalize(s.display_name))
    order by s.total_rank,coalesce(s.locked,false) desc,public.food_normalize(s.display_name)
  ) dup_rank
  from scored s
), ranked as (
  select d.*,row_number() over(order by d.total_rank,public.food_normalize(d.display_name)) rn
  from dedup d where d.dup_rank=1
)
select coalesce(jsonb_agg(jsonb_build_object(
  'dictionary_id',r.dictionary_id,'code',r.ciqual_code,'ciqual_code',r.ciqual_code,
  'name',r.display_name,'display_name',r.display_name,
  'roles',coalesce(r.roles,'{}'::text[]),'fill_roles',coalesce(r.fill_roles,'{}'::text[]),
  'families',coalesce(r.families,'{}'::text[]),'accepts',coalesce(r.accepts,'{}'::text[]),
  'profile',coalesce(r.profile,'{}'::jsonb),'pairing_mode',r.pairing_mode,
  'pairing_strong_families',coalesce(r.pairing_strong_families,'{}'::text[]),
  'pairing_possible_families',coalesce(r.pairing_possible_families,'{}'::text[]),
  'pairing_avoid_families',coalesce(r.pairing_avoid_families,'{}'::text[]),
  'pairing_strong_terms',coalesce(r.pairing_strong_terms,'{}'::text[]),
  'pairing_requires_accompaniment',coalesce(r.pairing_requires_accompaniment,false),
  'pairing_complete',coalesce(r.pairing_complete,false),'deterministic_profile_code',r.profile_code,
  'compatibility_score',greatest(60,100-least(40,round(r.total_rank)::int)),
  'culinary_affinity',greatest(60,100-least(40,round(r.total_rank)::int)),
  'match_rank',round(r.total_rank)::int,'familiar',false,'deterministic_compatible',true,'source','V4896594_profile_matrix'
) order by r.rn),'[]'::jsonb)
from ranked r where r.rn<=greatest(1,least(coalesce($5,12),30));
$$;

-- -----------------------------------------------------------------------------
-- 8) RPC principal : refs choisies -> profils -> formule -> pools.
-- -----------------------------------------------------------------------------
create or replace function public.mt_adapter_deterministic_candidates_v1(
  p_selected_refs jsonb default '[]'::jsonb,
  p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  j jsonb;
  rec record;
  selected jsonb:='[]'::jsonb;
  source_profiles text[]:='{}'::text[];
  present text[]:='{}'::text[];
  missing text[]:='{}'::text[];
  exclude_dict uuid[]:='{}'::uuid[];
  exclude_ciqual text[]:='{}'::text[];
  sig text:='none';
  pools jsonb:='{}'::jsonb;
  role_key text;
  code text;
  sr text[];
  any_composite boolean:=false;
  any_complete boolean:=false;
begin
  if uid is null then raise exception 'auth required'; end if;

  for j in select value from jsonb_array_elements(coalesce(p_selected_refs,'[]'::jsonb))
  loop
    if coalesce((j->>'unknown')::boolean,false) then continue; end if;

    select p.* into rec
    from public.mt_food_culinary_profiles_v1 p
    where (p.dictionary_id=nullif(j->>'dictionary_id','')::uuid
       or p.ciqual_code::text=nullif(j->>'code',''))
    order by (case when p.dictionary_id=nullif(j->>'dictionary_id','')::uuid then 0 else 1 end),
             coalesce(p.locked,false) desc,p.profile_key
    limit 1;

    if not found then continue; end if;

    code:=coalesce(rec.profile #>> '{deterministic,profile_code}',
      public.mt_food_deterministic_profile_code_v1(rec.display_name,rec.roles,rec.fill_roles,rec.families,rec.pairing_mode,rec.pairing_complete));
    sr:=public.mt_food_structural_roles_v1(rec.roles,rec.fill_roles);
    source_profiles:=public.mt_text_array_distinct_v6594(array_append(source_profiles,code));
    present:=public.mt_text_array_distinct_v6594(present||sr);
    if rec.dictionary_id is not null then exclude_dict:=array_append(exclude_dict,rec.dictionary_id); end if;
    if rec.ciqual_code is not null then exclude_ciqual:=array_append(exclude_ciqual,rec.ciqual_code::text); end if;
    any_composite:=any_composite or ('composite'=any(coalesce(rec.roles,'{}'::text[]))) or coalesce(rec.pairing_mode,'') in ('prepared_composite','variable_composite');
    any_complete:=any_complete or coalesce(rec.pairing_complete,false) or coalesce(rec.pairing_mode,'')='complete';

    selected:=selected||jsonb_build_array(jsonb_build_object(
      'dictionary_id',rec.dictionary_id,'ciqual_code',rec.ciqual_code,'code',rec.ciqual_code,
      'name',rec.display_name,'display_name',rec.display_name,
      'roles',coalesce(rec.roles,'{}'::text[]),'fill_roles',coalesce(rec.fill_roles,'{}'::text[]),
      'families',coalesce(rec.families,'{}'::text[]),'accepts',coalesce(rec.accepts,'{}'::text[]),
      'profile',coalesce(rec.profile,'{}'::jsonb),'pairing_mode',rec.pairing_mode,
      'pairing_strong_families',coalesce(rec.pairing_strong_families,'{}'::text[]),
      'pairing_possible_families',coalesce(rec.pairing_possible_families,'{}'::text[]),
      'pairing_avoid_families',coalesce(rec.pairing_avoid_families,'{}'::text[]),
      'pairing_strong_terms',coalesce(rec.pairing_strong_terms,'{}'::text[]),
      'pairing_requires_accompaniment',coalesce(rec.pairing_requires_accompaniment,false),
      'pairing_complete',coalesce(rec.pairing_complete,false),'deterministic_profile_code',code,
      'locked',coalesce(rec.locked,false)
    ));
  end loop;

  sig:=public.mt_food_role_signature_v1(present);
  if cardinality(source_profiles)=0 then
    missing:='{}'::text[];
  elsif any_composite or any_complete then
    missing:='{}'::text[];
  else
    select f.missing_roles into missing from public.mt_food_structure_formulas_v1 f where f.role_signature=sig;
    missing:=coalesce(missing,'{}'::text[]);
  end if;

  foreach role_key in array missing loop
    pools:=jsonb_set(pools,array[role_key],public.mt_food_deterministic_pool_v1(source_profiles,role_key,exclude_dict,exclude_ciqual,p_limit),true);
  end loop;
  foreach role_key in array array['protein','starch','vegetable']::text[] loop
    if not (pools ? role_key) then pools:=jsonb_set(pools,array[role_key],'[]'::jsonb,true); end if;
  end loop;

  return jsonb_build_object(
    'active',true,'engine_version','V4896594','formula_version','V4896594','matrix_version','V4896594',
    'selected_items',selected,'source_profiles',to_jsonb(source_profiles),
    'present_roles',to_jsonb(present),'role_signature',sig,'missing_roles',to_jsonb(missing),
    'complete',cardinality(missing)=0 and cardinality(source_profiles)>0,
    'composite_guard',any_composite,'candidate_pools',pools
  );
end;
$$;

revoke all on function public.mt_adapter_deterministic_candidates_v1(jsonb,integer) from public,anon;
grant execute on function public.mt_adapter_deterministic_candidates_v1(jsonb,integer) to authenticated;

commit;
