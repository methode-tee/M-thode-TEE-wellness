-- MÉTHODE TEE — V486.4 · CORRECTIF VOICE MCDO / CONTEXTE DE DICTÉE
--
-- Cas réel observé :
--   « J'ai mangé un burger Chicago, des frites grande portions des nuggets et ice tea »
--
-- Problèmes vus sur appareil :
--   • « burger Chicago » pouvait donner 2 repères : Burger + Chicago ;
--   • « grandes portions » pouvait devenir un repère fantôme séparé ;
--   • après choix « grande portion », les vieilles options McDonald's / autre
--     pouvaient réapparaître et créer une boucle ;
--   • « boisson ice tea » gardait un mot générique inutile pour la recherche.
--
-- V486.4 est ADDITIVE :
--   • V485.3/V4, V486.1, V486.2, V486.3 ne sont pas modifiés ;
--   • création d'un prétraitement de dictée uniquement pour V8 ;
--   • V8 appelle V7 avec le texte préparé puis ajoute uniquement les indices
--     contextuels nécessaires à l'UI ;
--   • aucune écriture Carnet, aucun nouvel aliment, aucune nutrition inventée.

begin;

do $preflight$
begin
  if to_regprocedure('public.resolve_food_speech_phrase_v7_json(text,jsonb,integer)') is null then
    raise exception 'V486.4 nécessite V486.3 / resolve_food_speech_phrase_v7_json';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. PRÉPARATION CONSERVATRICE DU TEXTE ISSU DE LA DICTÉE
-- ---------------------------------------------------------------------------
create or replace function public.food_speech_voice_prepare_v4864(p_text text)
returns text
language plpgsql
immutable
parallel safe
as $$
declare
  v text := coalesce(p_text,'');
begin
  -- « burger Chicago » : burger est un mot de catégorie, Chicago porte
  -- l'identité du produit. On évite qu'une ponctuation automatique de Siri
  -- transforme cela en deux aliments.
  v := regexp_replace(v,
    E'\\m(burger|hamburger)[[:space:],;:.-]+(le[[:space:]]+)?chicago[[:space:]]+classic[[:space:]]+bacon\\M',
    'chicago classic bacon','gi');
  v := regexp_replace(v,
    E'\\m(burger|hamburger)[[:space:],;:.-]+(le[[:space:]]+)?chicago[[:space:]]+spicy[[:space:]]+bbq\\M',
    'chicago spicy bbq','gi');
  v := regexp_replace(v,
    E'\\m(burger|hamburger)[[:space:],;:.-]+(le[[:space:]]+)?chicago[[:space:]]+classic\\M',
    'chicago classic','gi');
  v := regexp_replace(v,
    E'\\m(burger|hamburger)[[:space:],;:.-]+(le[[:space:]]+)?chicago\\M',
    'chicago','gi');

  -- Le mot « boisson » n'apporte aucune identité pour « ice tea ».
  v := regexp_replace(v,
    E'\\mboisson[[:space:]]+(ice[[:space:]-]*tea)\\M',
    E'\\1','gi');

  -- Dictée naturelle sans « et » :
  -- « frites grande portions des nuggets » -> « frites et des nuggets ».
  -- La taille n'est pas perdue : V8 la récupère depuis la phrase ORIGINALE
  -- sous forme de spoken_size_hint.
  v := regexp_replace(v,
    E'\\m(frite|frites)[[:space:],;:.-]+(petite|petites|moyenne|moyennes|grande|grandes)[[:space:]]+portions?[[:space:]]+(des|de|du|un|une|six|neuf|vingt|[0-9]+)[[:space:]]+(nugget|nuggets)\\M',
    E'\\1 et \\3 \\4','gi');

  -- Même groupe sans aliment immédiatement après : on garde seulement « frites »
  -- pour le resolver historique ; la taille reste fournie séparément par V8.
  v := regexp_replace(v,
    E'\\m(frite|frites)[[:space:],;:.-]+(petite|petites|moyenne|moyennes|grande|grandes)[[:space:]]+portions?\\M',
    E'\\1','gi');

  -- Variante « grande portion de frites ».
  v := regexp_replace(v,
    E'\\m(petite|petites|moyenne|moyennes|grande|grandes)[[:space:]]+portions?[[:space:]]+(de|des|du)[[:space:]]+(frite|frites)\\M',
    E'\\3','gi');

  return regexp_replace(v,'[[:space:]]+',' ','g');
end;
$$;

grant execute on function public.food_speech_voice_prepare_v4864(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. V8 : V7 INTACT + INDICE DE TAILLE + NETTOYAGE DES OPTIONS PÉRIMÉES
-- ---------------------------------------------------------------------------
create or replace function public.resolve_food_speech_phrase_v8_json(
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
  v_prepared text;
  v_norm text;
  v_size text := null;
  v_base jsonb;
  v_items jsonb;
  v_out jsonb := '[]'::jsonb;
  v_item jsonb;
  v_item_food text;
  v_item_ref text;
  v_i integer;
begin
  v_prepared := public.food_speech_voice_prepare_v4864(p_text);
  v_norm := public.food_normalize(coalesce(p_text,''));

  -- Taille de frites explicitement prononcée dans la phrase d'origine.
  if v_norm ~ '(^| )frites?( |,)*(grande|grandes)( |)+(portion|portions)( |$)' 
     or v_norm ~ '(^| )(grande|grandes)( |)+(portion|portions)( |)+(de|des|du)( |)+frites?( |$)' then
    v_size := 'grande';
  elsif v_norm ~ '(^| )frites?( |,)*(moyenne|moyennes)( |)+(portion|portions)( |$)'
     or v_norm ~ '(^| )(moyenne|moyennes)( |)+(portion|portions)( |)+(de|des|du)( |)+frites?( |$)' then
    v_size := 'moyenne';
  elsif v_norm ~ '(^| )frites?( |,)*(petite|petites)( |)+(portion|portions)( |$)'
     or v_norm ~ '(^| )(petite|petites)( |)+(portion|portions)( |)+(de|des|du)( |)+frites?( |$)' then
    v_size := 'petite';
  end if;

  v_base := public.resolve_food_speech_phrase_v7_json(v_prepared,p_choices,p_limit_items);
  v_items := case when jsonb_typeof(v_base->'items')='array' then v_base->'items' else '[]'::jsonb end;

  if jsonb_array_length(v_items)>0 then
    for v_i in 0..jsonb_array_length(v_items)-1 loop
      v_item := v_items->v_i;
      v_item_food := public.food_normalize(coalesce(v_item->>'food_text',''));
      v_item_ref := coalesce(v_item->'original_resolution'->>'food_ref','');

      if v_size is not null
         and (
           v_item_food in ('frite','frites')
           or v_item_ref in ('generic:generic_frites','generic:generic_mcdo_frites')
           or public.food_normalize(coalesce(v_item->'original_resolution'->>'display_name','')) in ('frite','frites','frites mcdonald s','frites mcdonalds')
         ) then
        v_item := v_item || jsonb_build_object('spoken_size_hint',v_size);
      end if;

      -- Une fois un sous-choix résolu, les alternatives du concept parent ne sont
      -- plus valides. On les efface pour éviter toute boucle même avec un ancien front.
      if jsonb_typeof(v_item->'final_food')='object'
         and coalesce(v_item->'selected_option'->>'status','')='resolved' then
        v_item := v_item || jsonb_build_object('alternatives','[]'::jsonb);
      end if;

      v_out := v_out || jsonb_build_array(v_item);
    end loop;
  end if;

  return v_base || jsonb_build_object(
    'engine_version','V486.4',
    'input_original',coalesce(p_text,''),
    'input_prepared',v_prepared,
    'voice_context_cleanup_enabled',true,
    'items',v_out
  );
end;
$$;

grant execute on function public.resolve_food_speech_phrase_v8_json(text,jsonb,integer) to authenticated;

commit;
