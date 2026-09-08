-- MÉTHODE TEE — V486.5.1 · AUDIT CONTEXTES / FRAGMENTS DE LA BIBLIOTHÈQUE
-- LECTURE SEULE : aucune modification.
--
-- 1) Origines utilisées par la bibliothèque : une origine isolée par Siri ne doit
-- jamais devenir un nouvel aliment si le plat correspondant est déjà résolu.
select
  public.food_normalize(country) context_term,
  count(*) foods_using_it
from public.food_dictionary
where enabled and nullif(btrim(country),'') is not null
group by public.food_normalize(country)
order by foods_using_it desc,context_term;

-- 2) Alias courts partagés par plusieurs aliments : ils sont à risque lorsqu'une
-- pause/punctuation les détache du nom complet.
with a as (
  select
    public.food_normalize(x.alias) alias_normalized,
    d.id,
    d.display_name
  from public.food_dictionary d
  cross join lateral unnest(
    coalesce(d.aliases,'{}'::text[]) || coalesce(d.speech_aliases,'{}'::text[])
  ) x(alias)
  where d.enabled and length(public.food_normalize(x.alias)) between 3 and 24
)
select
  alias_normalized,
  count(distinct id) foods,
  jsonb_agg(distinct display_name) displays
from a
group by alias_normalized
having count(distinct id)>1
order by foods desc,alias_normalized
limit 100;

-- 3) Qualificatifs connus : vérifier s'ils existent comme vraie identité exacte.
-- Une ligne à 0 est sûre comme "contexte pur". Une ligne >0 doit rester visible.
with terms(term) as (values
 ('mcdo'),('mcdonalds'),('cameroun'),('maroc'),('japon'),('thailande'),
 ('senegal'),('nigeria'),('ghana'),('algerie'),('tunisie'),('chine'),
 ('cote d ivoire'),('maghreb'),('afrique de l ouest'),('france'),
 ('nature'),('maison'),('fait maison'),('sans sucre'),('sans sucres'),
 ('portion'),('petite portion'),('moyenne portion'),('grande portion'),
 ('assiette'),('bol'),('verre'),('bouteille'),('canette'),('barquette'),
 ('grille'),('grillee'),('cuit'),('cuite'),('cru'),('crue'),('frit')
)
select
  t.term,
  count(d.id) exact_food_identities
from terms t
left join public.food_dictionary d
  on d.enabled
 and (
   d.normalized_name=public.food_normalize(t.term)
   or public.food_normalize(coalesce(d.display_name,''))=public.food_normalize(t.term)
   or exists(
     select 1 from unnest(coalesce(d.aliases,'{}'::text[])||coalesce(d.speech_aliases,'{}'::text[])) a
     where public.food_normalize(a)=public.food_normalize(t.term)
   )
 )
group by t.term
order by exact_food_identities desc,t.term;
