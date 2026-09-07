-- MÉTHODE TEE V477 — Food Identity multimodale, phase 1
-- Objectif : préparer le dictionnaire alimentaire EXISTANT à la voix et à la vision locale,
-- sans modifier le moteur alimentaire actuel, les repas historiques, les protocoles,
-- les validations, les XP ni les déblocages.
--
-- Ce patch est ADDITIF : les fonctions actuelles continuent d'ignorer ces colonnes.
-- Aucun appel IA, aucun upload d'image et aucun egress supplémentaire n'est déclenché par ce SQL.

begin;

alter table public.food_dictionary
  add column if not exists multimodal_key text,
  add column if not exists speech_aliases text[] not null default '{}',
  add column if not exists speech_locale text not null default 'fr-FR',
  add column if not exists speech_enabled boolean not null default true,
  add column if not exists vision_class_key text,
  add column if not exists vision_family text,
  add column if not exists vision_enabled boolean not null default false,
  add column if not exists vision_priority integer not null default 100,
  add column if not exists vision_reference_count integer not null default 0,
  add column if not exists vision_status text not null default 'not_prepared';

-- Clé stable utilisable plus tard par les modèles locaux Core ML.
-- normalized_name est déjà unique dans food_dictionary : le backfill est donc déterministe.
update public.food_dictionary
set multimodal_key = 'food_' || replace(normalized_name, ' ', '_')
where nullif(trim(multimodal_key),'') is null;

create unique index if not exists food_dictionary_multimodal_key_uidx
  on public.food_dictionary(multimodal_key)
  where multimodal_key is not null;

create index if not exists food_dictionary_speech_aliases_idx
  on public.food_dictionary using gin(speech_aliases);

create index if not exists food_dictionary_vision_ready_idx
  on public.food_dictionary(vision_enabled, vision_priority, vision_status)
  where vision_enabled = true;

-- Ne jamais écraser les futurs alias vocaux saisis manuellement.
-- Pour les lignes encore vierges, on part du vocabulaire déjà validé par Méthode TEE.
update public.food_dictionary d
set speech_aliases = (
  select coalesce(array_agg(distinct v order by v), '{}')
  from unnest(array_append(coalesce(d.aliases,'{}'::text[]), d.canonical_name)) as x(v)
  where nullif(trim(v),'') is not null
)
where cardinality(d.speech_aliases)=0;

alter table public.food_dictionary drop constraint if exists food_dictionary_vision_status_check;
alter table public.food_dictionary add constraint food_dictionary_vision_status_check
  check (vision_status in ('not_prepared','collecting','training_ready','testing','validated','retired'));

alter table public.food_dictionary drop constraint if exists food_dictionary_vision_reference_count_check;
alter table public.food_dictionary add constraint food_dictionary_vision_reference_count_check
  check (vision_reference_count >= 0);

-- Résolution VOCale déterministe. Elle ne remplace PAS search_foods_v2/v3.
-- Elle sera appelée plus tard uniquement par le futur bouton « Le dire à Tee ».
create or replace function public.resolve_food_speech(
  p_text text,
  p_limit integer default 8
)
returns table(
  id uuid,
  multimodal_key text,
  canonical_name text,
  display_name text,
  country text,
  culture text,
  ciqual_code text,
  matched_term text,
  match_type text,
  match_rank integer
)
language sql
stable
security invoker
set search_path=public
as $$
  with q as (
    select public.food_normalize(left(coalesce(p_text,''),1000)) as v
  ), terms as (
    select d.id,d.multimodal_key,d.canonical_name,d.display_name,d.country,d.culture,d.ciqual_code,
           d.priority,d.normalized_name as term_norm,d.canonical_name as term_raw,'canonical'::text as term_kind
    from public.food_dictionary d
    where d.enabled and d.speech_enabled

    union all

    select d.id,d.multimodal_key,d.canonical_name,d.display_name,d.country,d.culture,d.ciqual_code,
           d.priority,public.food_normalize(a) as term_norm,a as term_raw,'alias'::text as term_kind
    from public.food_dictionary d
    cross join lateral unnest(d.aliases) a
    where d.enabled and d.speech_enabled and length(public.food_normalize(a))>=2

    union all

    select d.id,d.multimodal_key,d.canonical_name,d.display_name,d.country,d.culture,d.ciqual_code,
           d.priority,public.food_normalize(a) as term_norm,a as term_raw,'speech_alias'::text as term_kind
    from public.food_dictionary d
    cross join lateral unnest(d.speech_aliases) a
    where d.enabled and d.speech_enabled and length(public.food_normalize(a))>=2
  ), hits as (
    select t.*,
      case
        when q.v=t.term_norm then 0
        when q.v ~ ('(^| )'||t.term_norm||'( |$)') then 10
        when t.term_norm like q.v||'%' then 20
        when q.v like t.term_norm||'%' then 25
        else 90
      end
      + case t.term_kind when 'canonical' then 0 when 'speech_alias' then 2 else 4 end
      + greatest(0,least(20,t.priority/20)) as rank_value
    from terms t cross join q
    where length(q.v)>=2 and (
      q.v=t.term_norm
      or q.v ~ ('(^| )'||t.term_norm||'( |$)')
      or t.term_norm like q.v||'%'
      or q.v like t.term_norm||'%'
    )
  ), dedup as (
    select distinct on (id)
      id,multimodal_key,canonical_name,display_name,country,culture,ciqual_code,
      term_raw,term_kind,rank_value
    from hits
    order by id,rank_value,length(term_norm) desc
  )
  select id,multimodal_key,canonical_name,display_name,country,culture,ciqual_code,
         term_raw as matched_term,term_kind as match_type,rank_value as match_rank
  from dedup
  order by rank_value,canonical_name
  limit greatest(1,least(coalesce(p_limit,8),12));
$$;

grant execute on function public.resolve_food_speech(text,integer) to authenticated;

-- Vue légère pour préparer les datasets hors production. Elle ne contient aucune photo.
create or replace view public.food_multimodal_catalog_v1 as
select
  id,multimodal_key,canonical_name,display_name,aliases,speech_aliases,speech_locale,
  country,region,culture,categories,typical_components,optional_components,
  ciqual_code,enabled,speech_enabled,
  vision_class_key,vision_family,vision_enabled,vision_priority,vision_reference_count,vision_status
from public.food_dictionary;

grant select on public.food_multimodal_catalog_v1 to authenticated;

commit;
