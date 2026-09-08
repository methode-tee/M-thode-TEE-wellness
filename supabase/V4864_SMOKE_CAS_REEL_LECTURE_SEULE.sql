-- V486.4 · TEST CIBLÉ DU CAS RÉEL — LECTURE SEULE
-- Aucun repas n'est écrit.

-- 1) Le prétraitement doit supprimer les fragments techniques sans inventer d'aliment.
select public.food_speech_voice_prepare_v4864(
  'J''ai mangé un burger Chicago, des frites grande portions des nuggets et boisson ice tea'
) as prepared_text;

-- 2) Première compréhension.
with r as (
  select public.resolve_food_speech_phrase_v8_json(
    'J''ai mangé un burger Chicago, des frites grande portions des nuggets et boisson ice tea',
    '[]'::jsonb,12
  ) p
)
select
  p->>'engine_version' engine_version,
  p->>'input_prepared' input_prepared,
  jsonb_array_length(p->'items') item_count,
  p->'items' items
from r;

-- 3) « burger Chicago » seul ne doit plus produire Burger + Chicago.
select public.resolve_food_speech_phrase_v8_json(
  'J''ai mangé un burger Chicago',
  '[]'::jsonb,12
) as burger_chicago_one_item;

-- 4) Ice Tea : doit au minimum être trouvé ou proposer la bibliothèque écrite.
with r as (
  select public.resolve_food_speech_phrase_v8_json(
    'J''ai bu une boisson ice tea',
    '[]'::jsonb,12
  ) p
)
select
  exists(
    select 1
    from jsonb_array_elements(p->'items') i
    where jsonb_typeof(i->'final_food')='object'
       or jsonb_array_length(coalesce(i->'alternatives','[]'::jsonb))>0
  ) as ice_tea_found_or_offered,
  p->'items' items
from r;

-- 5) Flux frites : le front V486.4 transforme le choix McDonald's en mcdo_grande
-- lorsque spoken_size_hint='grande'. Après ce choix, les alternatives doivent être vides.
with first_pass as (
  select public.resolve_food_speech_phrase_v8_json(
    'J''ai mangé des frites grande portion',
    '[]'::jsonb,12
  ) p
), idx as (
  select (i->>'item_index')::integer item_index
  from first_pass, jsonb_array_elements(p->'items') i
  where coalesce(i->>'spoken_size_hint','')='grande'
  limit 1
), second_pass as (
  select public.resolve_food_speech_phrase_v8_json(
    'J''ai mangé des frites grande portion',
    jsonb_build_array(jsonb_build_object(
      'item_index',idx.item_index,
      'option_key','mcdo_grande',
      'confirmed',false
    )),
    12
  ) p
  from idx
)
select
  i->'final_food'->>'display_name' final_food,
  i->>'final_grams' final_grams,
  jsonb_array_length(coalesce(i->'alternatives','[]'::jsonb)) stale_alternatives,
  i->>'status' status,
  i
from second_pass, jsonb_array_elements(p->'items') i
where coalesce(i->>'spoken_size_hint','')='grande';
