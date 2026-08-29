-- Méthode Tee V394 — compositeur universel de boissons
-- À exécuter APRÈS V392. Idempotent.
-- Le moteur ne dépend plus d'une liste finie de recettes : il compose à partir
-- des ingrédients réellement disponibles, de leurs formes, goûts et affinités.

begin;

drop function if exists public.suggest_botanical_beverage(uuid[],text,boolean,boolean,boolean);
drop function if exists public.suggest_botanical_beverage(uuid[],text,boolean,boolean,boolean,integer);

create or replace function public.suggest_botanical_beverage(
  p_ingredient_ids uuid[],
  p_intent text default 'hydration',
  p_caffeine_sensitive boolean default false,
  p_pregnancy_or_breastfeeding boolean default false,
  p_regular_medication boolean default false,
  p_variant integer default 0
) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare
  v_result jsonb;
  v_variant integer := greatest(0,coalesce(p_variant,0));
begin
  if coalesce(cardinality(p_ingredient_ids),0)=0 then return null; end if;

  with recursive
  raw_supplied as (
    select distinct i.*
    from unnest(p_ingredient_ids) u(id)
    join botanical_ingredients i on i.id=u.id
    where i.enabled
  ),
  supplied as (
    select i.* from raw_supplied i
    where i.composer_enabled
      and i.caution_level<>'high'
      and not (p_caffeine_sensitive and i.caffeine_level in ('present','variable'))
      and not ((p_pregnancy_or_breastfeeding or p_regular_medication) and i.caution_level='notice')
  ),
  classified as (
    select s.*,
      case
        when s.ingredient_kind='tea' then 'tea'
        when s.ingredient_kind in ('plant','spice','dried_fruit','citrus_peel')
          or s.preparation_forms && array['infusion','infusion chaude','infusion froide','décoction','concassé'] then 'infusion'
        when s.ingredient_kind='fresh_fruit' then 'fruit'
        when s.preparation_forms && array['smoothie','boisson végétale'] then 'base'
        else 'other'
      end role,
      case when s.flavor_tags && array['amer','astringent','puissant','terreux'] then 1 else 0 end strong_flavor
    from supplied s
  ),
  mode_choice as (
    select case
      when count(*) filter(where role in('tea','infusion'))>0 then 'infusion'
      when count(*) filter(where role='fruit')>0 and
           (count(*) filter(where role='base')>0 or p_intent in('energy','gourmand')) then 'smoothie'
      when count(*) filter(where role='fruit')>0 then 'eau_aromatisee'
      else 'infusion'
    end mode
    from classified
  ),
  eligible as (
    select c.*,
      case
        when m.mode='infusion' and c.role in('tea','infusion') then 60
        when m.mode='infusion' and c.role='fruit' then 35
        when m.mode='smoothie' and c.role in('fruit','base') then 60
        when m.mode='eau_aromatisee' and c.role='fruit' then 60
        when m.mode='eau_aromatisee' and c.role='infusion' and c.flavor_tags && array['frais','citronné','floral'] then 35
        else 5
      end
      + case when p_intent='gourmand' and c.flavor_tags && array['doux','fruité','tropical','crémeux','cacao','floral'] then 18 else 0 end
      + case when p_intent='energy' and (c.caffeine_level in('present','variable','low') or c.ingredient_kind='fresh_fruit') then 15 else 0 end
      + case when p_intent='calm' and c.caffeine_level='none' and c.traditional_context_tags && array['soir','pause','rituel calme'] then 18 else 0 end
      + case when p_intent='digestive_comfort' and c.traditional_context_tags && array['après repas','confort digestif'] then 18 else 0 end
      + case when p_intent='menstrual_comfort' and c.traditional_context_tags && array['confort menstruel'] then 18 else 0 end
      - c.strong_flavor*8 - greatest(0,c.priority/20) base_score
    from classified c cross join mode_choice m
  ),
  ranked as (
    select e.*,
      e.base_score
      + coalesce((select count(*)*9 from classified x
          where x.id<>e.id and (
            exists(select 1 from unnest(e.pairing_tags) p where botanical_normalize(p) in (x.normalized_name,botanical_normalize(x.display_name)))
            or exists(select 1 from unnest(x.pairing_tags) p where botanical_normalize(p) in (e.normalized_name,botanical_normalize(e.display_name)))
            or e.flavor_tags && x.flavor_tags
          )),0)
      + case when mod(abs(hashtext(e.id::text)::bigint),7)=mod(v_variant,7) then 35 else 0 end score
    from eligible e
  ),
  picked as (
    select * from ranked
    order by score desc, mod(abs(hashtext(id::text)::bigint)+v_variant,2147483647), display_name
    limit 4
  ),
  restrained as (
    -- Une seule base caféinée et au maximum deux ingrédients très puissants.
    select p.* from picked p
    where not (p.role='tea' and exists(
      select 1 from picked q where q.role='tea' and (q.score>p.score or (q.score=p.score and q.id<p.id))
    ))
      and not (p.strong_flavor=1 and 2 <= (
        select count(*) from picked q where q.strong_flavor=1 and (q.score>p.score or (q.score=p.score and q.id<p.id))
      ))
  ),
  chosen as (
    select * from restrained
    union all
    select * from ranked r
    where not exists(select 1 from restrained)
    order by score desc limit 4
  ),
  chosen_stats as (
    select m.mode,
      array_agg(c.display_name order by c.score desc,c.display_name) names,
      array_agg(c.id order by c.score desc,c.display_name) ids,
      array_agg(c.normalized_name) normalized_names,
      count(*) n,
      count(*) filter(where c.role='fruit') fruit_count,
      count(*) filter(where c.role='base') base_count,
      count(*) filter(where c.role='tea') tea_count,
      count(*) filter(where c.role='infusion') infusion_count,
      string_agg(distinct c.caution_text,' ' order by c.caution_text) filter(where c.caution_text is not null) caution
    from chosen c cross join mode_choice m group by m.mode having count(*)>0
  ),
  complement as (
    select i.display_name
    from chosen_stats cs
    join chosen c on true
    join lateral unnest(c.pairing_tags) p(tag) on true
    join botanical_ingredients i on i.enabled and i.composer_enabled
      and (i.normalized_name=botanical_normalize(p.tag)
        or botanical_normalize(i.display_name)=botanical_normalize(p.tag)
        or exists(select 1 from unnest(i.aliases) a where botanical_normalize(a)=botanical_normalize(p.tag)))
    where i.id<>all(cs.ids) and i.caution_level<>'high'
      and not (p_caffeine_sensitive and i.caffeine_level in('present','variable'))
      and not ((p_pregnancy_or_breastfeeding or p_regular_medication) and i.caution_level='notice')
    group by i.id,i.display_name,i.priority
    order by count(*) desc,i.priority,i.display_name
    limit 1
  ),
  payload as (
    select jsonb_build_object(
      'blend_id',null,
      'composition_mode',cs.mode,
      'used_ingredient_ids',to_jsonb(cs.ids),
      'used',to_jsonb(cs.names),
      'unused',coalesce((select jsonb_agg(x.display_name order by x.display_name) from classified x where x.id<>all(cs.ids)),'[]'::jsonb),
      'excluded_for_safety',coalesce((select jsonb_agg(x.display_name order by x.display_name) from raw_supplied x where not exists(select 1 from classified c where c.id=x.id)),'[]'::jsonb),
      'title',case cs.mode
        when 'smoothie' then 'Smoothie '||array_to_string(cs.names,'–')
        when 'eau_aromatisee' then 'Eau '||array_to_string(cs.names,'–')
        else 'Infusion '||array_to_string(cs.names,'–') end,
      'reason',case p_intent
        when 'energy' then 'Tee privilégie ici une composition vive et cohérente avec ton intention, uniquement avec des ingrédients réellement disponibles.'
        when 'digestive_comfort' then 'Tee privilégie une composition culinaire adaptée à un moment après le repas, sans la présenter comme un traitement.'
        when 'calm' then 'Tee privilégie une composition sans stimulant comme rituel de pause, sans promesse sur le sommeil.'
        when 'menstrual_comfort' then 'Tee privilégie un rituel doux et prudent, sans prétendre traiter une douleur ou le cycle.'
        when 'gourmand' then 'Tee associe les profils aromatiques les plus complémentaires pour une boisson gourmande.'
        else 'Tee utilise la combinaison la plus cohérente parmi les ingrédients réellement disponibles.' end,
      'preparation',case cs.mode
        when 'smoothie' then 'Mixer '||array_to_string(cs.names,', ')||case when cs.base_count=0 then ' avec 150 à 200 ml d’eau' else '' end||'. Ajuster progressivement la texture et servir frais.'
        when 'eau_aromatisee' then 'Couper ou écraser légèrement '||array_to_string(cs.names,', ')||', ajouter à une eau fraîche et laisser reposer 20 à 30 minutes avant de goûter.'
        else 'Déposer '||array_to_string(cs.names,', ')||' dans une tasse. Verser de l’eau chaude non bouillante, infuser 5 à 8 minutes puis filtrer. Commencer par de petites quantités et ajuster au goût.' end,
      'missing','[]'::jsonb,
      'optional_addition',(select display_name from complement),
      'caution',nullif(cs.caution,'')
    ) value from chosen_stats cs
  ) select value into v_result from payload;

  return v_result;
end $$;

grant execute on function public.suggest_botanical_beverage(uuid[],text,boolean,boolean,boolean,integer) to authenticated;

-- Vérification lisible dans SQL Editor.
select 'V394 installé : compositeur dynamique actif' as resultat;

commit;
