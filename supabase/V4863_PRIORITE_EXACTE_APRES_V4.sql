-- MÉTHODE TEE — V486.3 · PRIORITÉ EXACTE BIBLIOTHÈQUE APRÈS V4
--
-- Diagnostic V486.2 :
--   • couverture exacte de la bibliothèque = 284/284 ;
--   • baseline V485.3 = 139/139 ;
--   • shadow V6 = 139/139 ;
--   • mais 7 aliments exacts restaient sur un candidat CIQUAL/générique de V4.
--
-- Cause :
-- V6 protégeait toute présence d'alternatives comme une "ambiguïté métier".
-- Or V4 peut fournir des alternatives informatives même quand
-- original_resolution.status='resolved_candidate'.
--
-- Correction :
-- On protège seulement les vraies ambiguïtés métier :
--   original_resolution.status IN ('needs_detail','needs_subdetail')
-- ou un choix utilisateur explicite déjà sélectionné.
--
-- Si la bibliothèque contient UNE identité exacte pour le food_text,
-- elle prime sur un candidat CIQUAL/générique déjà résolu.
--
-- V485.3, V5 et V6 restent inchangés.

begin;

do $preflight$
begin
  if to_regprocedure('public.resolve_food_speech_phrase_v6_json(text,jsonb,integer)') is null then
    raise exception 'V486.3 nécessite V486.2 / resolve_food_speech_phrase_v6_json';
  end if;
  if to_regprocedure('public.food_speech_library_exact_dictionary_v2(text,integer)') is null then
    raise exception 'V486.3 nécessite food_speech_library_exact_dictionary_v2';
  end if;
  if to_regprocedure('public.food_speech_library_identity_v1(text)') is null then
    raise exception 'V486.3 nécessite food_speech_library_identity_v1';
  end if;
end
$preflight$;

create or replace function public.resolve_food_speech_phrase_v7_json(
  p_text text,
  p_choices jsonb default '[]'::jsonb,
  p_limit_items integer default 12
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  v_base jsonb;
  v_items jsonb;
  v_out jsonb := '[]'::jsonb;
  v_item jsonb;
  v_choice jsonb;
  v_option_key text;
  v_original_status text;
  v_exact_count integer;
  v_current_dict uuid;
  v_portion jsonb;
  v_grams numeric;
  v_grams_override numeric;
  v_confirmed boolean;
  v_ready boolean;
  v_status text;
  v_i integer;
  v_total integer;
  v_resolved integer;
  v_needs_detail integer;
  v_needs_quantity integer;
  v_all_ready boolean;
  v_all_add boolean;
  v_exact_override_count integer := 0;
  exactrow record;
  ident record;
  parsed record;
begin
  v_base := public.resolve_food_speech_phrase_v6_json(p_text,p_choices,p_limit_items);
  v_items := case when jsonb_typeof(v_base->'items')='array' then v_base->'items' else '[]'::jsonb end;

  if jsonb_array_length(v_items)=0 then
    return v_base || jsonb_build_object(
      'engine_version','V486.3',
      'library_exact_after_v4_enabled',true,
      'library_exact_after_v4_override_count',0
    );
  end if;

  for v_i in 0..jsonb_array_length(v_items)-1 loop
    v_item := v_items->v_i;
    v_choice := null;

    select e into v_choice
    from jsonb_array_elements(
      case when jsonb_typeof(coalesce(p_choices,'[]'::jsonb))='array'
           then coalesce(p_choices,'[]'::jsonb) else '[]'::jsonb end
    ) e
    where coalesce(e->>'item_index','') ~ '^[0-9]+$'
      and (e->>'item_index')::integer=coalesce((v_item->>'item_index')::integer,v_i+1)
    limit 1;

    v_option_key := coalesce(v_choice->>'option_key','');
    v_original_status := coalesce(v_item->'original_resolution'->>'status','');

    -- Choix explicite utilisateur : souverain.
    if nullif(v_option_key,'') is not null
       and v_option_key not like 'libd:%'
       and v_option_key not like 'libc:%' then
      v_out := v_out || jsonb_build_array(v_item);
      continue;
    end if;

    -- Vraie ambiguïté métier V485.3 : souveraine.
    if v_original_status in ('needs_detail','needs_subdetail') then
      v_out := v_out || jsonb_build_array(v_item);
      continue;
    end if;

    select count(*)::integer
      into v_exact_count
    from public.food_speech_library_exact_dictionary_v2(v_item->>'food_text',50);

    v_current_dict := case
      when coalesce(v_item->'final_food'->>'dictionary_id','') ~
           '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (v_item->'final_food'->>'dictionary_id')::uuid
      else null::uuid
    end;

    -- Déjà sur l'identité exacte : ne rien changer.
    if v_current_dict is not null and exists(
      select 1
      from public.food_speech_library_exact_dictionary_v2(v_item->>'food_text',50) e
      where e.dictionary_id=v_current_dict
    ) then
      v_out := v_out || jsonb_build_array(v_item);
      continue;
    end if;

    if v_exact_count=1 then
      select * into exactrow
      from public.food_speech_library_exact_dictionary_v2(v_item->>'food_text',50)
      limit 1;

      select * into ident
      from public.food_speech_library_identity_v1(exactrow.option_key)
      limit 1;

      if found then
        v_confirmed := coalesce(
          case when lower(coalesce(v_choice->>'confirmed','')) in ('true','false')
               then (v_choice->>'confirmed')::boolean end,
          coalesce((v_item->>'confirmed')::boolean,false)
        );

        v_grams_override := case
          when replace(coalesce(v_choice->>'grams_override',''),',','.') ~ '^[0-9]+([.][0-9]+)?$'
          then replace(v_choice->>'grams_override',',','.')::numeric
          else null::numeric
        end;

        select * into parsed
        from public.food_speech_parse_segment(v_item->>'raw_segment')
        limit 1;

        if v_grams_override is not null and v_grams_override>0 then
          v_portion := jsonb_build_object(
            'status','resolved_manual',
            'grams',v_grams_override,
            'requires_confirmation',true,
            'confidence','manual',
            'source','user_override',
            'estimated',false,
            'verified',false
          );
        else
          v_portion := public.food_speech_resolve_portion(
            ident.display_name,
            ident.ciqual_code,
            ident.dictionary_id,
            parsed.quantity_value,
            parsed.unit_code,
            parsed.unit_label,
            parsed.unit_kind,
            parsed.base_quantity_value,
            parsed.base_unit,
            parsed.quantity_requires_confirmation
          );
        end if;

        v_grams := case
          when coalesce(v_portion->>'grams','') ~ '^[0-9]+([.][0-9]+)?$'
          then (v_portion->>'grams')::numeric
          else null::numeric
        end;

        v_ready := v_grams is not null and v_grams>0;
        v_status := case
          when not v_ready then coalesce(v_portion->>'status','needs_quantity')
          when v_confirmed then 'ready_to_add'
          else 'awaiting_confirmation'
        end;

        v_item := v_item || jsonb_build_object(
          'final_food',jsonb_build_object(
            'food_ref',ident.food_ref,
            'source_kind',ident.source_kind,
            'dictionary_id',ident.dictionary_id,
            'multimodal_key',ident.multimodal_key,
            'ciqual_code',ident.ciqual_code,
            'canonical_name',ident.canonical_name,
            'display_name',ident.display_name
          ),
          'portion',v_portion,
          'final_grams',v_grams,
          'ready_for_confirmation',v_ready,
          'confirmed',v_confirmed,
          'ready_to_add',(v_ready and v_confirmed),
          'status',v_status,
          'library_fallback',true,
          'library_exact_priority',true,
          'library_exact_after_v4',true,
          'library_exact_via',exactrow.exact_via,
          'alternatives','[]'::jsonb
        );

        v_exact_override_count := v_exact_override_count+1;
      end if;
    end if;

    v_out := v_out || jsonb_build_array(v_item);
  end loop;

  select
    count(*)::integer,
    count(*) filter(where jsonb_typeof(x->'final_food')='object')::integer,
    count(*) filter(where coalesce(jsonb_typeof(x->'final_food'),'null')<>'object'
      or coalesce(x->>'status','') in (
        'needs_detail','needs_subdetail','needs_search','target_not_found',
        'unknown_option','needs_library_choice'
      ))::integer,
    count(*) filter(where jsonb_typeof(x->'final_food')='object'
      and not coalesce((x->>'ready_for_confirmation')::boolean,false))::integer,
    coalesce(bool_and(coalesce((x->>'ready_for_confirmation')::boolean,false)),false),
    coalesce(bool_and(coalesce((x->>'ready_to_add')::boolean,false)),false)
  into v_total,v_resolved,v_needs_detail,v_needs_quantity,v_all_ready,v_all_add
  from jsonb_array_elements(v_out) x;

  return v_base || jsonb_build_object(
    'engine_version','V486.3',
    'library_exact_after_v4_enabled',true,
    'library_exact_after_v4_override_count',v_exact_override_count,
    'item_count',v_total,
    'resolved_food_count',v_resolved,
    'needs_detail_count',v_needs_detail,
    'needs_quantity_count',v_needs_quantity,
    'ready_for_confirmation',v_all_ready,
    'ready_to_add',v_all_add,
    'requires_confirmation',true,
    'items',v_out
  );
end;
$$;

grant execute on function public.resolve_food_speech_phrase_v7_json(text,jsonb,integer) to authenticated;

commit;
