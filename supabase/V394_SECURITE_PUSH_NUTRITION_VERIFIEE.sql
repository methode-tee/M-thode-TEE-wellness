-- MÉTHODE TEE V394 — sécurité push + nutrition personnalisée vérifiée
-- Idempotent. À exécuter après V425.
begin;

-- Une nutrition saisie dans le Studio reste un brouillon tant que la case
-- « Données vérifiées » n'est pas cochée. La référence CIQUAL liée reste utilisable.
create or replace function public.search_foods_v2(p_query text, p_limit integer default 10)
returns table(
  code text, name text, kcal_100g numeric, protein_100g numeric,
  fat_100g numeric, carbs_100g numeric, fiber_100g numeric, salt_100g numeric,
  source text, dictionary_id uuid, display_name text, country text,
  categories text[], adapter_profile jsonb, match_rank integer
)
language sql stable security invoker set search_path=public as $$
  with q as (select public.food_normalize(p_query) v,regexp_replace(public.food_normalize(p_query),'s$','') stem),
  ciqual_ranked as (
    select c.code,c.name,c.kcal_100g,c.protein_100g,c.fat_100g,c.carbs_100g,c.fiber_100g,c.salt_100g,
      c.source,null::uuid dictionary_id,c.name display_name,null::text country,'{}'::text[] categories,'{}'::jsonb adapter_profile,
      case when public.food_normalize(c.name) in(q.v,q.stem) then 10 when public.food_normalize(c.name) like q.stem||'%' then 20 when public.food_normalize(c.name) like '% '||q.stem||'%' then 30 when public.food_normalize(c.name) not like '%,%' then 40 else 50 end match_rank
    from public.ciqual_foods c,q
    where length(q.v)>=3 and (public.food_normalize(c.name) like '%'||q.stem||'%' or public.food_normalize(c.search_text) like '%'||q.stem||'%')
  ),
  dictionary_ranked as (
    select c.code,coalesce(c.name,d.display_name) name,
      coalesce(case when d.nutrition_verified then d.custom_kcal_100g end,c.kcal_100g) kcal_100g,
      coalesce(case when d.nutrition_verified then d.custom_protein_100g end,c.protein_100g) protein_100g,
      coalesce(case when d.nutrition_verified then d.custom_fat_100g end,c.fat_100g) fat_100g,
      coalesce(case when d.nutrition_verified then d.custom_carbs_100g end,c.carbs_100g) carbs_100g,
      coalesce(case when d.nutrition_verified then d.custom_fiber_100g end,c.fiber_100g) fiber_100g,
      coalesce(case when d.nutrition_verified then d.custom_salt_100g end,c.salt_100g) salt_100g,
      case when d.nutrition_verified and (d.custom_kcal_100g is not null or d.custom_protein_100g is not null or d.custom_fat_100g is not null or d.custom_carbs_100g is not null or d.custom_fiber_100g is not null or d.custom_salt_100g is not null)
        then coalesce(nullif(d.nutrition_source_label,''),'Méthode Tee · donnée vérifiée') else coalesce(c.source,d.source) end source,
      d.id dictionary_id,d.display_name,d.country,d.categories,
      d.adapter_profile || jsonb_build_object('tee_has_custom_nutrition',
        d.nutrition_verified and (d.custom_kcal_100g is not null or d.custom_protein_100g is not null or d.custom_fat_100g is not null or d.custom_carbs_100g is not null or d.custom_fiber_100g is not null or d.custom_salt_100g is not null),
        'tee_custom_nutrition_verified',d.nutrition_verified
      ) adapter_profile,
      case when d.normalized_name in(q.v,q.stem) then 10 when exists(select 1 from unnest(d.aliases) a where public.food_normalize(a) in(q.v,q.stem)) then 15 when d.normalized_name like q.stem||'%' then 25 when exists(select 1 from unnest(d.aliases) a where public.food_normalize(a) like q.stem||'%') then 28 else 65 end + greatest(0,least(20,d.priority/20)) match_rank
    from public.food_dictionary d cross join q left join public.ciqual_foods c on c.code=d.ciqual_code
    where d.enabled and length(q.v)>=3 and (d.normalized_name like q.stem||'%' or exists(select 1 from unnest(d.aliases) a where public.food_normalize(a) like q.stem||'%'))
  ), all_rows as (select * from ciqual_ranked union all select * from dictionary_ranked),
  dedup as (
    select distinct on (coalesce(code,'dict:'||dictionary_id::text)) code,name,kcal_100g,protein_100g,fat_100g,carbs_100g,fiber_100g,salt_100g,source,dictionary_id,display_name,country,categories,adapter_profile,match_rank
    from all_rows order by coalesce(code,'dict:'||dictionary_id::text),match_rank,(dictionary_id is null),name
  )
  select * from dedup order by match_rank,name limit greatest(1,least(coalesce(p_limit,10),10));
$$;
grant execute on function public.search_foods_v2(text,integer) to authenticated;

create or replace function public.search_foods_v3(p_query text, p_limit integer default 10)
returns table(code text,name text,kcal_100g numeric,protein_100g numeric,fat_100g numeric,carbs_100g numeric,fiber_100g numeric,salt_100g numeric,source text,dictionary_id uuid,display_name text,country text,categories text[],adapter_profile jsonb,match_rank integer,micronutrients_100g jsonb)
language sql stable security invoker set search_path=public as $$
  select f.code,f.name,f.kcal_100g,f.protein_100g,f.fat_100g,f.carbs_100g,f.fiber_100g,f.salt_100g,f.source,f.dictionary_id,f.display_name,f.country,f.categories,f.adapter_profile,f.match_rank,
    coalesce((select jsonb_object_agg(n.nutrient_key,jsonb_build_object('value',n.value_100g,'unit',n.unit,'source',n.source,'version',n.source_version)) from public.ciqual_food_nutrients n where n.ciqual_code=f.code),'{}'::jsonb)
    || coalesce((select case when d.nutrition_verified then d.custom_micronutrients_100g else '{}'::jsonb end from public.food_dictionary d where d.id=f.dictionary_id),'{}'::jsonb)
  from public.search_foods_v2(p_query,greatest(1,least(coalesce(p_limit,10),50))) f;
$$;
grant execute on function public.search_foods_v3(text,integer) to anon,authenticated;

create or replace function public.resolve_food_text(p_text text, p_limit integer default 12)
returns table(id uuid,canonical_name text,display_name text,country text,meal_contexts text[],categories text[],typical_components jsonb,optional_components jsonb,adapter_profile jsonb,ciqual_code text,confidence text)
language sql stable security invoker set search_path=public as $$
  with q as (select public.food_normalize(left(coalesce(p_text,''),1000)) v), hits as (
    select d.*,case when q.v=d.normalized_name then 'exact' when q.v ~ ('(^| )'||regexp_replace(d.normalized_name,'([\.\+\*\?\[\]\(\)\{\}\|\^\$])','\\\1','g')||'( |$)') then 'recognized' else 'alias' end confidence,length(d.normalized_name) hit_length
    from public.food_dictionary d cross join q
    where d.enabled and length(q.v)>=3 and (q.v ~ ('(^| )'||regexp_replace(d.normalized_name,'([\.\+\*\?\[\]\(\)\{\}\|\^\$])','\\\1','g')||'( |$)') or exists(select 1 from unnest(d.aliases) a where length(public.food_normalize(a))>=3 and q.v ~ ('(^| )'||regexp_replace(public.food_normalize(a),'([\.\+\*\?\[\]\(\)\{\}\|\^\$])','\\\1','g')||'( |$)')))
  )
  select id,canonical_name,display_name,country,meal_contexts,categories,typical_components,optional_components,
    adapter_profile || jsonb_build_object('tee_has_custom_nutrition',nutrition_verified and (custom_kcal_100g is not null or custom_protein_100g is not null or custom_fat_100g is not null or custom_carbs_100g is not null or custom_fiber_100g is not null or custom_salt_100g is not null),'tee_custom_nutrition_verified',nutrition_verified),
    ciqual_code,confidence from hits order by priority asc,hit_length desc limit greatest(1,least(coalesce(p_limit,12),16));
$$;
grant execute on function public.resolve_food_text(text,integer) to authenticated;

-- Les anciens repas restent intacts, mais une ligne reliée uniquement à une
-- nutrition personnalisée non vérifiée est exclue des calculs analytiques.
create or replace function public.food_day_micronutrition_summary(target_date date)
returns jsonb language sql stable security invoker set search_path=public as $$
  with meals as (select id from public.food_meals where user_id=auth.uid() and meal_date=target_date),
  items as (select i.* from public.food_meal_items i join meals m on m.id=i.meal_id),
  calculable as (
    select i.* from items i left join public.food_dictionary d on d.id=i.food_dictionary_id
    where i.quantity_g is not null and i.quantity_g>0 and (
      (i.food_dictionary_id is null and i.ciqual_code is not null)
      or (i.food_dictionary_id is not null and (
        d.nutrition_verified
        or (i.ciqual_code is not null and d.custom_kcal_100g is null and d.custom_protein_100g is null and d.custom_fat_100g is null and d.custom_carbs_100g is null and d.custom_fiber_100g is null and d.custom_salt_100g is null and coalesce(d.custom_micronutrients_100g,'{}'::jsonb)='{}'::jsonb)
      ))
    )
  ),
  counts as (select (select count(*) from meals)::int meal_count,(select count(*) from items)::int item_count,(select count(*) from calculable)::int calculable_items,(select count(distinct meal_id) from calculable)::int calculated_meals),
  macros as (select case when count(*)>0 then sum(kcal) end kcal,case when count(*)>0 then sum(protein) end protein_g,case when count(*)>0 then sum(fat) end fat_g,case when count(*)>0 then sum(carbs) end carbs_g,case when count(*)>0 then sum(fiber) end fiber_g from calculable),
  micro_contrib as (select i.food_name,e.key,case when jsonb_typeof(e.value)='number' then (e.value#>>'{}')::numeric else nullif(e.value->>'value','')::numeric end value from calculable i cross join lateral jsonb_each(i.micronutrients) e where jsonb_typeof(e.value)='number' or nullif(e.value->>'value','') is not null),
  micros as (select key,sum(value) value from micro_contrib where value is not null group by key),
  source_totals as (select key,food_name,sum(value) value from micro_contrib where value is not null and value>0 and nullif(trim(food_name),'') is not null group by key,food_name),
  source_ranked as (select key,food_name,value,row_number() over(partition by key order by value desc,food_name) rn from source_totals),
  source_arrays as (select key,jsonb_agg(jsonb_build_object('name',food_name,'value',round(value,3)) order by value desc,food_name) sources from source_ranked where rn<=5 group by key),
  source_object as (select coalesce(jsonb_object_agg(key,sources),'{}'::jsonb) value from source_arrays),
  source_foods as (select coalesce(jsonb_agg(food_name order by food_name),'[]'::jsonb) value,count(*)::int source_count from (select distinct food_name from calculable where nullif(trim(food_name),'') is not null) x)
  select jsonb_build_object('date',target_date,'meal_count',c.meal_count,'item_count',c.item_count,'quantified_items',(select count(*) from items where quantity_g is not null and quantity_g>0),'calculable_items',c.calculable_items,'calculated_meals',c.calculated_meals,'kcal',m.kcal,'protein_g',m.protein_g,'fat_g',m.fat_g,'carbs_g',m.carbs_g,'fiber_g',m.fiber_g,'micronutrients',coalesce((select jsonb_object_agg(key,round(value,3)) from micros where value is not null),'{}'::jsonb),'micronutrient_sources',(select value from source_object),'source_foods',(select value from source_foods),'micronutrient_source_count',(select source_count from source_foods),'micronutrient_coverage_count',(select count(*) from micros where value is not null),'data_quality',case when c.meal_count=0 then 'no_meal' when c.calculated_meals=0 then 'not_calculable' when c.calculated_meals<c.meal_count then 'partial' else 'complete' end,'source_note','Valeurs calculées uniquement à partir des quantités et références vérifiées disponibles. Une donnée absente vaut « non documentée », jamais zéro ni carence.') from counts c cross join macros m;
$$;
grant execute on function public.food_day_micronutrition_summary(date) to authenticated;

-- Neutralise les anciens totaux qui pourraient déjà contenir une nutrition
-- Studio non vérifiée. Le repas et ses ingrédients restent conservés.
update public.food_meals m set kcal_total=null,protein_total=null,fat_total=null,carbs_total=null,fiber_total=null,salt_total=null,updated_at=now()
where exists (
  select 1 from public.food_meal_items i join public.food_dictionary d on d.id=i.food_dictionary_id
  where i.meal_id=m.id and not d.nutrition_verified and (
    d.custom_kcal_100g is not null or d.custom_protein_100g is not null or d.custom_fat_100g is not null or d.custom_carbs_100g is not null or d.custom_fiber_100g is not null or d.custom_salt_100g is not null or coalesce(d.custom_micronutrients_100g,'{}'::jsonb)<>'{}'::jsonb
  )
);

-- Le secret n'est jamais stocké dans le dépôt. Crée-le dans Vault sous le nom
-- mt_push_internal_secret et configure la même valeur comme secret Edge Function
-- MT_PUSH_INTERNAL_SECRET avant d'activer les tâches planifiées.
create extension if not exists pg_net with schema extensions;
create or replace function public.mt_dispatch_due_post_notifications()
returns integer language plpgsql security definer set search_path=public,extensions,net as $$
declare r record;request_id bigint;sent_count integer:=0;dom_id text;route text;body_text text;emoji text;internal_secret text;
begin
  select decrypted_secret into internal_secret from vault.decrypted_secrets where name='mt_push_internal_secret' order by created_at desc limit 1;
  if coalesce(internal_secret,'')='' then raise exception 'MT_PUSH_INTERNAL_SECRET_MISSING'; end if;
  for r in select p.id,p.title,p.type,p.published_at from public.posts p where p.active=true and p.notify_on_publish=true and p.notification_sent_at is null and coalesce(p.published_at,p.created_at)<=now()-interval '1 minute' order by coalesce(p.published_at,p.created_at) asc limit 10 loop
    dom_id:='post-'||lower(r.id::text);route:=public.mt_post_notification_route(r.type);body_text:=public.mt_post_notification_body(r.type,r.title);
    emoji:=case lower(trim(coalesce(r.type,''))) when 'hydratation' then '💧' when 'fuel du jour' then '🌿' when 'mouvement' then '🚶🏽‍♀️' when 'sweet switch' then '🍫' when 'recette' then '🥣' when 'nutrition' then '🥑' when 'pharmacopée' then '🌿' else '✶' end;
    select net.http_post(url:='https://tyuvlmmmyygqqhuetwoe.supabase.co/functions/v1/send-push-notifications',headers:=jsonb_build_object('Content-Type','application/json','x-mt-internal-secret',internal_secret),body:=jsonb_build_object('title',emoji||' Méthode Tee','body',body_text,'url','/index.html?mt_post='||dom_id||'&mt_route='||route||'#'||dom_id)) into request_id;
    if request_id is not null then update public.posts set notification_sent_at=now(),updated_at=now() where id=r.id and notification_sent_at is null;sent_count:=sent_count+1;end if;
  end loop;
  return sent_count;
end;$$;
revoke all on function public.mt_dispatch_due_post_notifications() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
