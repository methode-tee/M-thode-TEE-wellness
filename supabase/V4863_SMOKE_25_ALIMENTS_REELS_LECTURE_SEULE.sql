-- V486.3 · SMOKE FALLBACK BIBLIOTHÈQUE — LECTURE SEULE
-- Le test ne dépend pas d'une liste codée en dur : il prend des aliments réellement présents.
with sample as (
  select d.id,d.display_name
  from public.food_dictionary d
  where d.enabled
    and length(public.food_normalize(d.display_name))>=3
    and (
      d.ciqual_code is not null
      or d.custom_kcal_100g is not null
      or d.custom_protein_100g is not null
      or d.custom_fat_100g is not null
      or d.custom_carbs_100g is not null
      or d.custom_fiber_100g is not null
      or d.custom_salt_100g is not null
    )
  order by d.priority,d.display_name
  limit 25
), checked as (
  select
    s.id,
    s.display_name,
    public.resolve_food_speech_phrase_v7_json('J''ai mangé '||s.display_name,'[]'::jsonb,12) payload
  from sample s
)
select
  count(*) tested,
  count(*) filter(where exists(
    select 1
    from jsonb_array_elements(c.payload->'items') i
    where i->'final_food'->>'dictionary_id'=c.id::text
       or exists(
         select 1 from jsonb_array_elements(coalesce(i->'alternatives','[]'::jsonb)) a
         where a->>'option_key'='libd:'||c.id::text
       )
  )) found_by_voice_or_offered,
  count(*) filter(where not exists(
    select 1
    from jsonb_array_elements(c.payload->'items') i
    where i->'final_food'->>'dictionary_id'=c.id::text
       or exists(
         select 1 from jsonb_array_elements(coalesce(i->'alternatives','[]'::jsonb)) a
         where a->>'option_key'='libd:'||c.id::text
       )
  )) missing,
  jsonb_agg(c.display_name) filter(where not exists(
    select 1
    from jsonb_array_elements(c.payload->'items') i
    where i->'final_food'->>'dictionary_id'=c.id::text
       or exists(
         select 1 from jsonb_array_elements(coalesce(i->'alternatives','[]'::jsonb)) a
         where a->>'option_key'='libd:'||c.id::text
       )
  )) missing_names
from checked c;
