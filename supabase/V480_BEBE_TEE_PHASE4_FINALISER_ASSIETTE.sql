-- MÉTHODE TEE V480 — Bébé TEE · Phase 4 « Finaliser son assiette »
-- Dépendances : V477 + V478B + V479 + V479B déjà appliquées.
--
-- OBJECTIF
-- Relier les choix de précision de la saisie vocale à de VRAIES références
-- nutritionnelles déjà présentes dans Méthode TEE, puis résoudre la portion
-- en grammes uniquement lorsque l'information est suffisamment fiable.
--
-- Exemples :
--   « 150 g de riz » + choix « Riz cuit / nature »
--      -> vraie entrée CIQUAL « Riz blanc, cuit sans sel ajouté » + 150 g
--   « 120 g de poulet » + choix « Blanc / filet »
--      -> vraie entrée CIQUAL « Poulet, filet sans peau, grillé/poêlé » + 120 g
--   « 2 œufs »
--      -> utilise le profil de portion déjà présent dans Méthode TEE si disponible
--         (repère estimé => confirmation obligatoire)
--
-- IMPORTANT
-- - ADDITIF : V478/V479/V479B restent intactes.
-- - N'écrit JAMAIS dans food_meals / food_meal_items.
-- - Ne touche à aucun protocole, déblocage, XP, achat ou validation.
-- - N'invente pas un poids quand Méthode TEE ne possède pas de repère de portion.
-- - Aucun appel IA, aucun audio/photo stocké.

begin;

-- ---------------------------------------------------------------------------
-- 0. GARDE-FOUS
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.resolve_food_speech_phrase_v3b(text,integer)') is null then
    raise exception 'V480 nécessite V479B : resolve_food_speech_phrase_v3b(text,integer) est introuvable';
  end if;
  if to_regprocedure('public.mt_portion_profile(text,text,uuid)') is null then
    raise exception 'V480 nécessite le moteur de portions Méthode TEE : mt_portion_profile(text,text,uuid) est introuvable';
  end if;
  if to_regclass('public.ciqual_foods') is null or to_regclass('public.food_dictionary') is null then
    raise exception 'V480 nécessite ciqual_foods + food_dictionary';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. CIBLES DES OPTIONS DE PRÉCISION
-- ---------------------------------------------------------------------------
-- On ne modifie pas food_speech_generic_concepts. Cette table établit seulement
-- le pont entre une option UI (ex. filet_blanc) et une référence nutritionnelle.
create table if not exists public.food_speech_detail_targets (
  concept_key text not null,
  option_key text not null,
  option_display_name text not null,
  resolution_mode text not null default 'food'
    check (resolution_mode in ('food','needs_subdetail','search_required','composite_needs_detail')),
  target_ciqual_code text,
  target_names text[] not null default '{}'::text[],
  followup_prompt text,
  followup_options jsonb not null default '[]'::jsonb,
  priority integer not null default 100,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (concept_key,option_key),
  constraint food_speech_detail_targets_followup_array check (jsonb_typeof(followup_options)='array')
);

create index if not exists food_speech_detail_targets_enabled_idx
  on public.food_speech_detail_targets(enabled,concept_key,priority);

alter table public.food_speech_detail_targets enable row level security;
drop policy if exists "food speech detail authenticated read" on public.food_speech_detail_targets;
drop policy if exists "food speech detail admin manage" on public.food_speech_detail_targets;
create policy "food speech detail authenticated read" on public.food_speech_detail_targets
  for select to authenticated using (enabled or public.is_admin());
create policy "food speech detail admin manage" on public.food_speech_detail_targets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.food_speech_detail_targets to authenticated;

-- Les target_names sont classés par préférence. La résolution exige un nom CIQUAL
-- normalisé EXACT parmi ces cibles : on ne revient surtout pas au fuzzy arbitraire.
insert into public.food_speech_detail_targets
  (concept_key,option_key,option_display_name,resolution_mode,target_ciqual_code,target_names,followup_prompt,followup_options,priority,enabled,updated_at)
values
  ('generic_riz','riz_cuit_nature','Riz cuit / nature','food',null,
    array['Riz blanc, cuit sans sel ajouté','Riz blanc étuvé, cuit sans sel ajouté','Riz basmati, cuit sans sel ajouté'],
    null,'[]'::jsonb,10,true,now()),
  ('generic_riz','riz_cru','Riz cru','food',null,
    array['Riz blanc, cru'],null,'[]'::jsonb,10,true,now()),
  ('generic_riz','riz_complet','Riz complet','needs_subdetail',null,'{}'::text[],
    'Ton riz complet était-il pesé cuit ou cru ?',
    jsonb_build_array(
      jsonb_build_object('option_key','riz_complet_cuit','display_name','Riz complet cuit'),
      jsonb_build_object('option_key','riz_complet_cru','display_name','Riz complet cru')
    ),10,true,now()),
  ('generic_riz','riz_complet_cuit','Riz complet cuit','food',null,
    array['Riz complet, cuit sans sel ajouté'],null,'[]'::jsonb,11,true,now()),
  ('generic_riz','riz_complet_cru','Riz complet cru','food',null,
    array['Riz complet, cru'],null,'[]'::jsonb,11,true,now()),
  ('generic_riz','autre','Autre préparation','search_required',null,'{}'::text[],
    'Recherche la préparation exacte dans Méthode TEE.', '[]'::jsonb,900,true,now()),

  ('generic_poulet','filet_blanc','Blanc / filet de poulet','food',null,
    array['Poulet, filet sans peau, grillé/poêlé'],null,'[]'::jsonb,10,true,now()),
  ('generic_poulet','cuisse','Cuisse de poulet','food',null,
    array['Poulet, cuisse, viande rôtie/cuite au four','Poulet, cuisse, viande et peau rôtie/cuite au four'],null,'[]'::jsonb,10,true,now()),
  ('generic_poulet','poulet_roti','Poulet rôti','food',null,
    array['Poulet, viande et peau rôties/cuites au four'],null,'[]'::jsonb,10,true,now()),
  ('generic_poulet','autre','Autre','search_required',null,'{}'::text[],
    'Recherche le morceau ou la préparation exacte dans Méthode TEE.', '[]'::jsonb,900,true,now()),

  ('generic_boeuf','steak','Steak / morceau de bœuf','food',null,
    array['Boeuf, steak ou bifteck, grillé/poêlé','Bœuf, steak ou bifteck, grillé/poêlé'],null,'[]'::jsonb,10,true,now()),
  ('generic_boeuf','hache','Bœuf haché','food',null,
    array['Boeuf, steak haché cuit (aliment moyen)','Bœuf, steak haché cuit (aliment moyen)'],null,'[]'::jsonb,10,true,now()),
  ('generic_boeuf','mijote','Bœuf mijoté / en sauce','food',null,
    array['Boeuf braisé','Bœuf braisé'],null,'[]'::jsonb,10,true,now()),
  ('generic_boeuf','autre','Autre','search_required',null,'{}'::text[],
    'Recherche le type de bœuf exact dans Méthode TEE.', '[]'::jsonb,900,true,now()),

  ('generic_plantain','cuit','Cuit','food',null,
    array['Banane plantain, cuite'],null,'[]'::jsonb,10,true,now()),
  ('generic_plantain','frit_alloco','Frit / alloco','food','TEE-CIV-ALLOCO-001',
    array['Alloco — Côte d’Ivoire','Alloco - Côte d’Ivoire'],null,'[]'::jsonb,10,true,now()),
  ('generic_plantain','cru','Cru / pesé avant cuisson','food',null,
    array['Banane plantain, crue'],null,'[]'::jsonb,10,true,now()),
  ('generic_plantain','autre','Autre préparation','search_required',null,'{}'::text[],
    'Recherche la préparation exacte dans Méthode TEE.', '[]'::jsonb,900,true,now()),

  ('generic_cafe_au_lait','lait_vache','Café + lait de vache','composite_needs_detail',null,'{}'::text[],
    'Quelle quantité de lait de vache environ as-tu utilisée ?', '[]'::jsonb,10,true,now()),
  ('generic_cafe_au_lait','boisson_vegetale','Café + boisson végétale','composite_needs_detail',null,'{}'::text[],
    'Quelle boisson végétale et quelle quantité as-tu utilisées ?', '[]'::jsonb,10,true,now()),
  ('generic_cafe_au_lait','autre','Autre','search_required',null,'{}'::text[],
    'Précise ou recherche ta boisson dans Méthode TEE.', '[]'::jsonb,900,true,now())
on conflict (concept_key,option_key) do update
set option_display_name=excluded.option_display_name,
    resolution_mode=excluded.resolution_mode,
    target_ciqual_code=excluded.target_ciqual_code,
    target_names=excluded.target_names,
    followup_prompt=excluded.followup_prompt,
    followup_options=excluded.followup_options,
    priority=excluded.priority,
    enabled=excluded.enabled,
    updated_at=now();

-- ---------------------------------------------------------------------------
-- 2. RÉSOLUTION D'UNE OPTION -> VRAIE RÉFÉRENCE MÉTHODE TEE
-- ---------------------------------------------------------------------------
create or replace function public.food_speech_resolve_detail_choice(
  p_concept_key text,
  p_option_key text
)
returns table(
  concept_key text,
  option_key text,
  option_display_name text,
  resolution_mode text,
  resolution_status text,
  food_ref text,
  source_kind text,
  dictionary_id uuid,
  multimodal_key text,
  ciqual_code text,
  canonical_name text,
  display_name text,
  followup_prompt text,
  followup_options jsonb
)
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  t record;
  v_code text;
  v_name text;
  v_dict_id uuid;
  v_multimodal text;
begin
  select * into t
  from public.food_speech_detail_targets x
  where x.enabled
    and x.concept_key=p_concept_key
    and x.option_key=p_option_key
  order by x.priority
  limit 1;

  if not found then
    return query select
      p_concept_key,p_option_key,null::text,'search_required'::text,'unknown_option'::text,
      null::text,null::text,null::uuid,null::text,null::text,null::text,null::text,
      'Choix inconnu : recherche l’aliment dans Méthode TEE.'::text,'[]'::jsonb;
    return;
  end if;

  if t.resolution_mode <> 'food' then
    return query select
      t.concept_key,t.option_key,t.option_display_name,t.resolution_mode,
      case when t.resolution_mode='search_required' then 'needs_search' else 'needs_subdetail' end,
      null::text,null::text,null::uuid,null::text,null::text,null::text,null::text,
      t.followup_prompt,t.followup_options;
    return;
  end if;

  -- 1) Code explicite si la cible culturelle possède déjà un code Méthode TEE.
  if nullif(t.target_ciqual_code,'') is not null then
    select c.code,c.name into v_code,v_name
    from public.ciqual_foods c
    where c.code=t.target_ciqual_code
    limit 1;
  end if;

  -- 2) Sinon uniquement un nom CIQUAL EXACT normalisé parmi les cibles approuvées.
  if v_code is null and cardinality(t.target_names)>0 then
    select c.code,c.name into v_code,v_name
    from unnest(t.target_names) with ordinality n(target_name,ord)
    join public.ciqual_foods c
      on public.food_normalize(c.name)=public.food_normalize(n.target_name)
    order by n.ord
    limit 1;
  end if;

  if v_code is null then
    return query select
      t.concept_key,t.option_key,t.option_display_name,t.resolution_mode,'target_not_found'::text,
      null::text,null::text,null::uuid,null::text,null::text,null::text,null::text,
      'La référence nutritionnelle exacte n’a pas été trouvée : recherche manuelle nécessaire.'::text,
      '[]'::jsonb;
    return;
  end if;

  select d.id,d.multimodal_key into v_dict_id,v_multimodal
  from public.food_dictionary d
  where d.enabled and d.ciqual_code=v_code
  order by d.priority,d.id
  limit 1;

  return query select
    t.concept_key,t.option_key,t.option_display_name,t.resolution_mode,'resolved'::text,
    'ciqual:'||v_code,
    case when v_dict_id is not null then 'dictionary' else 'ciqual' end,
    v_dict_id,v_multimodal,v_code,v_name,v_name,null::text,'[]'::jsonb;
end;
$$;

grant execute on function public.food_speech_resolve_detail_choice(text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. CONVERSION DE PORTION — RÉUTILISE STRICTEMENT LE MOTEUR EXISTANT
-- ---------------------------------------------------------------------------
create or replace function public.food_speech_resolve_portion(
  p_display_name text,
  p_ciqual_code text,
  p_dictionary_id uuid,
  p_quantity_value numeric,
  p_unit_code text,
  p_unit_label text,
  p_unit_kind text,
  p_base_quantity_value numeric,
  p_base_unit text,
  p_quantity_requires_confirmation boolean default true
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  p jsonb;
  v_profile_unit text;
  v_g_per_unit numeric;
  v_grams numeric;
  v_verified boolean;
  v_estimated boolean;
  v_unit_match boolean;
begin
  -- Quantité métrique explicitement dictée : on ne la ré-estime jamais.
  if p_base_quantity_value is not null and public.food_normalize(coalesce(p_base_unit,''))='g' then
    return jsonb_build_object(
      'status','resolved_exact',
      'grams',p_base_quantity_value,
      'requires_confirmation',coalesce(p_quantity_requires_confirmation,false),
      'confidence','exact',
      'source','spoken_metric',
      'estimated',false,
      'verified',true
    );
  end if;

  -- Les ml ne sont pas transformés arbitrairement en grammes sans densité connue.
  if p_base_quantity_value is not null and public.food_normalize(coalesce(p_base_unit,''))='ml' then
    return jsonb_build_object(
      'status','needs_density_or_beverage_logic',
      'grams',null,
      'quantity',p_base_quantity_value,
      'unit','ml',
      'requires_confirmation',true,
      'confidence','unresolved'
    );
  end if;

  if p_quantity_value is null or p_quantity_value<=0 then
    return jsonb_build_object(
      'status','needs_quantity',
      'grams',null,
      'requires_confirmation',true,
      'confidence','unresolved'
    );
  end if;

  p := public.mt_portion_profile(p_display_name,p_ciqual_code,p_dictionary_id);
  if p is null then
    return jsonb_build_object(
      'status','needs_quantity_detail',
      'grams',null,
      'requires_confirmation',true,
      'confidence','unresolved',
      'reason','Aucun repère de portion Méthode TEE suffisamment précis pour cet aliment.'
    );
  end if;

  v_profile_unit := coalesce(p->>'unit','');
  v_g_per_unit := nullif(p->>'grams_per_unit','')::numeric;
  v_verified := coalesce((p->>'verified')::boolean,false);
  v_estimated := coalesce((p->>'estimated')::boolean,true);

  -- Si l’utilisatrice a prononcé une unité domestique, on n’utilise le profil
  -- que si l’unité du profil correspond réellement. Pas de « tartine = pot » etc.
  if nullif(coalesce(p_unit_code,p_unit_label),'') is not null then
    v_unit_match := public.food_normalize(v_profile_unit)=public.food_normalize(coalesce(p_unit_code,p_unit_label));
    if not v_unit_match then
      return jsonb_build_object(
        'status','needs_quantity_detail',
        'grams',null,
        'requires_confirmation',true,
        'confidence','unresolved',
        'profile_unit',v_profile_unit,
        'spoken_unit',coalesce(p_unit_label,p_unit_code),
        'reason','Le repère de portion existant ne correspond pas à l’unité prononcée.'
      );
    end if;
  end if;

  if v_g_per_unit is null or v_g_per_unit<=0 then
    return jsonb_build_object('status','needs_quantity_detail','grams',null,'requires_confirmation',true,'confidence','unresolved');
  end if;

  v_grams := p_quantity_value*v_g_per_unit;

  return jsonb_build_object(
    'status',case when v_verified and not v_estimated then 'resolved_verified' else 'resolved_estimated' end,
    'grams',v_grams,
    'requires_confirmation',coalesce(p_quantity_requires_confirmation,true) or v_estimated or not v_verified,
    'confidence',case when v_verified and not v_estimated then 'verified' else 'estimated' end,
    'source','mt_portion_profile',
    'profile_unit',v_profile_unit,
    'grams_per_unit',v_g_per_unit,
    'estimated',v_estimated,
    'verified',v_verified,
    'source_label',p->>'source_label',
    'notes',p->>'notes'
  );
end;
$$;

grant execute on function public.food_speech_resolve_portion(text,text,uuid,numeric,text,text,text,numeric,text,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. PHASE 4 JSON — CHOIX -> FOOD_REF -> PORTION -> PRÊT POUR CONFIRMATION
-- ---------------------------------------------------------------------------
-- p_choices est un tableau JSON optionnel, par ex. :
-- [
--   {"item_index":1,"option_key":"riz_cuit_nature","confirmed":true},
--   {"item_index":2,"option_key":"filet_blanc","confirmed":true}
-- ]
--
-- Pour une portion non résolue, l'UI pourra aussi fournir :
--   {"item_index":3,"grams_override":70,"confirmed":true}
--
-- Cette fonction ne crée toujours aucun repas : elle prépare uniquement un payload.
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
      d.followup_options detail_followup_options
    from with_choice w
    left join lateral public.food_speech_resolve_detail_choice(w.multimodal_key,w.selected_option_key) d
      on w.source_kind='generic' and w.selected_option_key is not null
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

commit;

-- ---------------------------------------------------------------------------
-- TESTS CONSEILLÉS APRÈS APPLICATION — LECTURE SEULE
-- ---------------------------------------------------------------------------
-- A. Vérifier que les cibles existent réellement dans TA base :
-- select * from public.food_speech_resolve_detail_choice('generic_riz','riz_cuit_nature');
-- select * from public.food_speech_resolve_detail_choice('generic_poulet','filet_blanc');
-- select * from public.food_speech_resolve_detail_choice('generic_plantain','frit_alloco');
--
-- B. Phrase avec choix mais sans confirmation :
-- select public.resolve_food_speech_phrase_v4_json(
--   'J''ai mangé 150 g de riz et 120 g de poulet',
--   '[{"item_index":1,"option_key":"riz_cuit_nature"},{"item_index":2,"option_key":"filet_blanc"}]'::jsonb,
--   12
-- );
-- Attendu : food refs réelles + 150 g / 120 g, ready_for_confirmation=true,
--            ready_to_add=false.
--
-- C. Même phrase après confirmation humaine :
-- select public.resolve_food_speech_phrase_v4_json(
--   'J''ai mangé 150 g de riz et 120 g de poulet',
--   '[{"item_index":1,"option_key":"riz_cuit_nature","confirmed":true},{"item_index":2,"option_key":"filet_blanc","confirmed":true}]'::jsonb,
--   12
-- );
-- Attendu : ready_to_add=true.
--
-- D. Portions naturelles existantes :
-- select public.resolve_food_speech_phrase_v4_json(
--   'J''ai mangé deux oeufs et un demi avocat',
--   '[{"item_index":1,"confirmed":true},{"item_index":2,"confirmed":true}]'::jsonb,
--   12
-- );
-- Attendu : utilise mt_portion_profile si les repères existent ; si estimés,
--            l'objet portion le dit explicitement.
--
-- E. Ne jamais inventer une tartine si aucun profil compatible n'existe :
-- select public.resolve_food_speech_phrase_v4_json(
--   'J''ai mangé deux tartines de pain complet',
--   '[]'::jsonb,
--   12
-- );
-- Attendu possible : needs_quantity_detail (c'est volontaire).
