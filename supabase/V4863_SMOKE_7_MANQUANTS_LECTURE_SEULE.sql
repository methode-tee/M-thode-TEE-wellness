-- V486.3 · 7 ALIMENTS ENCORE MANQUANTS APRÈS V486.2 — LECTURE SEULE
with tests(name) as (
  values
    ('Eau citronnée nature — sans sucre'),
    ('Harira — Maroc'),
    ('Ndolè — Cameroun'),
    ('Pad thaï — Thaïlande'),
    ('Poulet DG — Cameroun'),
    ('Ramen — Japon'),
    ('Sauce gombo végétarienne — Cameroun')
), d as (
  select t.name,d.id
  from tests t
  join public.food_dictionary d
    on d.enabled
   and public.food_normalize(d.display_name)=public.food_normalize(t.name)
), checked as (
  select
    d.*,
    public.resolve_food_speech_phrase_v7_json('J''ai mangé '||d.name,'[]'::jsonb,12) payload
  from d
)
select
  name,
  id dictionary_id,
  payload->>'engine_version' engine_version,
  exists(
    select 1
    from jsonb_array_elements(payload->'items') i
    where i->'final_food'->>'dictionary_id'=id::text
       or exists(
         select 1
         from jsonb_array_elements(coalesce(i->'alternatives','[]'::jsonb)) a
         where a->>'option_key'='libd:'||id::text
       )
  ) as found_or_offered,
  payload->'items' items
from checked
order by name;
