-- MÉTHODE TEE — V482B.2 · Exposer les choix d'ambiguïté au front V482
-- Dépendance : V482B.1 déjà appliquée.
--
-- Correctif ciblé : le moteur V479B connaissait déjà les alternatives (Eru/Okok,
-- tailles de frites, Chicken/Veggie...), mais le JSON V4 ne les exposait pas.
-- Le front V482 sait déjà afficher `item.alternatives` ; on rétablit donc simplement
-- ce champ dans le contrat JSON. Aucun aliment, repas, protocole ou historique modifié.

begin;

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
          'alternatives',coalesce(alternatives,'[]'::jsonb),
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

commit;

-- Vérification lecture seule : les alternatives doivent maintenant être visibles.
-- select public.resolve_food_speech_phrase_v4_json('J''ai mangé de l''eru','[]'::jsonb,12);
-- select public.resolve_food_speech_phrase_v4_json('J''ai mangé des frites mcdo','[]'::jsonb,12);
-- select public.resolve_food_speech_phrase_v4_json('J''ai mangé 6 nuggets mcdo','[]'::jsonb,12);
