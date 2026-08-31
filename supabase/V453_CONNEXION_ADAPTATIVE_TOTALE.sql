-- MÉTHODE TEE · V453 · CONNEXION ADAPTATIVE TOTALE
-- Aujourd'hui d'abord, tous les trackers numériques reliés, protocoles compacts,
-- détail nutritionnel relié à CIQUAL + bibliothèque Méthode Tee sans faux zéro.
begin;


create or replace function public.mt_food_reference_lookup(p_ciqual_codes text[] default '{}'::text[], p_dictionary_ids uuid[] default '{}'::uuid[])
returns table(
  code text,name text,kcal_100g numeric,protein_100g numeric,fat_100g numeric,carbs_100g numeric,fiber_100g numeric,salt_100g numeric,
  source text,dictionary_id uuid,display_name text,nutrition_source_label text,micronutrients_100g jsonb,nutrition_extra_100g jsonb
)
language sql stable security invoker set search_path=public as $$
  with ciqual_rows as (
    select c.code,c.name,c.kcal_100g,c.protein_100g,c.fat_100g,c.carbs_100g,c.fiber_100g,c.salt_100g,
      coalesce(c.source,'CIQUAL') source,null::uuid dictionary_id,c.name display_name,coalesce(c.source,'CIQUAL') nutrition_source_label,
      coalesce((select jsonb_object_agg(n.nutrient_key,jsonb_build_object('value',n.value_100g,'unit',n.unit,'source',n.source,'version',n.source_version)) from public.ciqual_food_nutrients n where n.ciqual_code=c.code),'{}'::jsonb) micronutrients_100g,
      coalesce(c.nutrition_extra_100g,'{}'::jsonb) nutrition_extra_100g
    from public.ciqual_foods c where c.code=any(coalesce(p_ciqual_codes,'{}'::text[]))
  ), dictionary_rows as (
    select coalesce(c.code,d.ciqual_code) code,coalesce(c.name,d.display_name) name,
      coalesce(d.custom_kcal_100g,c.kcal_100g),coalesce(d.custom_protein_100g,c.protein_100g),coalesce(d.custom_fat_100g,c.fat_100g),
      coalesce(d.custom_carbs_100g,c.carbs_100g),coalesce(d.custom_fiber_100g,c.fiber_100g),coalesce(d.custom_salt_100g,c.salt_100g),
      coalesce(d.nutrition_source_label,c.source,'Méthode Tee') source,d.id dictionary_id,d.display_name,coalesce(d.nutrition_source_label,c.source,'Méthode Tee') nutrition_source_label,
      coalesce((select jsonb_object_agg(n.nutrient_key,jsonb_build_object('value',n.value_100g,'unit',n.unit,'source',n.source,'version',n.source_version)) from public.ciqual_food_nutrients n where n.ciqual_code=d.ciqual_code),'{}'::jsonb)
        || coalesce(d.custom_micronutrients_100g,'{}'::jsonb) micronutrients_100g,
      coalesce(c.nutrition_extra_100g,'{}'::jsonb) || case when d.nutrition_verified then coalesce(d.custom_nutrition_extra_100g,'{}'::jsonb) else '{}'::jsonb end nutrition_extra_100g
    from public.food_dictionary d left join public.ciqual_foods c on c.code=d.ciqual_code
    where d.id=any(coalesce(p_dictionary_ids,'{}'::uuid[])) and (d.enabled or public.is_admin())
  )
  select * from ciqual_rows
  union all
  select * from dictionary_rows;
$$;
revoke all on function public.mt_food_reference_lookup(text[],uuid[]) from public,anon;
grant execute on function public.mt_food_reference_lookup(text[],uuid[]) to authenticated;

create or replace function public.mt_reference_context(target_date date default current_date)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  v_today jsonb := '{}'::jsonb;
  v_profile jsonb := '{}'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_trackers jsonb := '{}'::jsonb;
  v_preferences jsonb := '{}'::jsonb;
  v_active_protocols jsonb := '[]'::jsonb;
  v_today_tracker_keys jsonb := '[]'::jsonb;
  v_today_text_signals jsonb := '{}'::jsonb;
  v_today_source_count integer := 0;
  w_first numeric; w_last numeric; w_first_date date; w_last_date date;
  w_old numeric; w_recent numeric; w_old_n int; w_recent_n int;
begin
  if uid is null then raise exception 'auth required'; end if;

  -- Le profil de départ est prioritaire et ne dépend d'aucun bootstrap historique.
  select jsonb_strip_nulls(jsonb_build_object(
    'birth_date',birth_date,
    'height_cm',height_cm,
    'reference_gender',reference_gender,
    'reference_sex',reference_sex,
    'reference_weight_kg',reference_weight_kg,
    'settings',reference_settings
  ))
  into v_profile
  from public.profiles
  where id=uid;
  v_profile:=coalesce(v_profile,'{}'::jsonb);

  -- Fait compact du jour déjà produit par les triggers. Son absence est normale.
  begin
    select coalesce(core,'{}'::jsonb) || coalesce(numeric_signals,'{}'::jsonb),
      to_jsonb(coalesce(tracker_keys,'{}'::text[])),coalesce(source_count,0)
    into v_today,v_today_tracker_keys,v_today_source_count
    from public.user_reference_daily_facts
    where user_id=uid and fact_date=target_date;
    v_today:=coalesce(v_today,'{}'::jsonb);
  exception when others then
    v_today:='{}'::jsonb;
    v_today_tracker_keys:='[]'::jsonb;
    v_today_source_count:=0;
  end;

  -- Champs qualitatifs scalaires du JOUR uniquement (texte court / booléen).
  -- Ils rendent un tracker futur visible au contexte sans alourdir l'historique mensuel.
  begin
    select coalesce(jsonb_object_agg(e.tracker_key||'.'||j.key,j.value),'{}'::jsonb)
    into v_today_text_signals
    from public.user_tracker_entries e
    left join lateral jsonb_each(e.values) j on true
    where e.user_id=uid and e.entry_date=target_date
      and jsonb_typeof(j.value) in ('string','boolean')
      and length(coalesce(j.value#>>'{}',''))<=80;
    v_today_text_signals:=coalesce(v_today_text_signals,'{}'::jsonb);
  exception when others then
    v_today_text_signals:='{}'::jsonb;
  end;

  -- Historique compact existant : aucune reconstruction synchrone ici.
  begin
    v_summary:=coalesce(public.mt_reference_period_summary(uid,current_date-27,current_date),'{}'::jsonb);

    select fact_date,public.mt_reference_num(core,'weight_kg')
    into w_first_date,w_first
    from public.user_reference_daily_facts
    where user_id=uid and fact_date>=current_date-27
      and public.mt_reference_num(core,'weight_kg') is not null
    order by fact_date asc limit 1;

    select fact_date,public.mt_reference_num(core,'weight_kg')
    into w_last_date,w_last
    from public.user_reference_daily_facts
    where user_id=uid and fact_date>=current_date-27
      and public.mt_reference_num(core,'weight_kg') is not null
    order by fact_date desc limit 1;

    select round(avg(public.mt_reference_num(core,'weight_kg')),2),count(*)::int
    into w_old,w_old_n
    from public.user_reference_daily_facts
    where user_id=uid and fact_date between current_date-27 and current_date-14
      and public.mt_reference_num(core,'weight_kg') is not null;

    select round(avg(public.mt_reference_num(core,'weight_kg')),2),count(*)::int
    into w_recent,w_recent_n
    from public.user_reference_daily_facts
    where user_id=uid and fact_date between current_date-13 and current_date
      and public.mt_reference_num(core,'weight_kg') is not null;

    v_summary:=v_summary || jsonb_strip_nulls(jsonb_build_object(
      'weight_first',w_first,'weight_first_date',w_first_date,
      'weight_last',w_last,'weight_last_date',w_last_date,
      'weight_older_avg',w_old,'weight_older_count',w_old_n,
      'weight_recent_avg',w_recent,'weight_recent_count',w_recent_n
    ));

    with t as (
      select k,count(*)::int days
      from public.user_reference_daily_facts d
      cross join lateral unnest(d.tracker_keys) k
      where d.user_id=uid
        and d.fact_date>=current_date-27 and d.fact_date<=current_date
        and d.source_count>0
      group by k
    )
    select coalesce(jsonb_object_agg(k,days),'{}'::jsonb)
    into v_trackers from t;
  exception when others then
    -- Une lecture historique défaillante ne doit jamais empêcher le point de départ.
    v_summary:='{}'::jsonb;
    v_trackers:='{}'::jsonb;
  end;

  -- Préférences de trackers : contexte optionnel.
  begin
    select coalesce(jsonb_object_agg(tracker_key,settings),'{}'::jsonb)
    into v_preferences
    from public.user_tracker_preferences
    where user_id=uid and enabled=true;
    v_preferences:=coalesce(v_preferences,'{}'::jsonb);
  exception when others then
    v_preferences:='{}'::jsonb;
  end;

  -- Protocoles réellement en cours : contexte optionnel, jamais bloquant.
  begin
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',p.id,'slug',p.slug,'title',p.title,
        'current_day',pp.current_day,'total_days',pp.total_days
      ) order by pp.updated_at desc
    ),'[]'::jsonb)
    into v_active_protocols
    from public.protocol_progress pp
    join public.protocols p on p.id=pp.protocol_id
    where pp.user_id=uid
      and coalesce(pp.certificate_unlocked,false)=false
      and (case
        when jsonb_typeof(coalesce(pp.completed_days,'[]'::jsonb))='array'
          then jsonb_array_length(coalesce(pp.completed_days,'[]'::jsonb))
        else 0 end) < greatest(1,coalesce(pp.total_days,1));
    v_active_protocols:=coalesce(v_active_protocols,'[]'::jsonb);
  exception when others then
    v_active_protocols:='[]'::jsonb;
  end;

  return jsonb_build_object(
    'date',target_date,
    'profile',v_profile,
    'today',coalesce(v_today,'{}'::jsonb),
    'today_tracker_keys',coalesce(v_today_tracker_keys,'[]'::jsonb),
    'today_text_signals',coalesce(v_today_text_signals,'{}'::jsonb),
    'today_source_count',coalesce(v_today_source_count,0),
    'summary28',coalesce(v_summary,'{}'::jsonb),
    'tracker_days',coalesce(v_trackers,'{}'::jsonb),
    'preferences',coalesce(v_preferences,'{}'::jsonb),
    'active_protocols',coalesce(v_active_protocols,'[]'::jsonb),
    'context_mode','instant_compact',
    'source_note','Point de départ immédiat depuis Mon profil ; les faits compacts déjà disponibles affinent ensuite le repère. Une absence reste une absence, jamais un zéro.'
  );
end;
$$;

revoke all on function public.mt_reference_context(date) from public,anon;
grant execute on function public.mt_reference_context(date) to authenticated;
comment on function public.mt_reference_context(date) is 'V453 · Contexte instantané transversal : profil immédiatement disponible, historique compact non bloquant, aucun bootstrap synchrone.';

create or replace function public.mt_protocol_reference_comparison(p_protocol_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid(); p record; start_d date; planned_end date; actual_end date; observed_until date; today_d date:=current_date;
  before_j jsonb; during_j jsonb; after_j jsonb; during_days jsonb := '[]'::jsonb;
  completed_count integer:=0; finished boolean:=false; total_n integer:=1;
begin
  if uid is null then raise exception 'auth required'; end if;
  select started_at,total_days,current_day,completed_days,certificate_unlocked,last_validated_at,updated_at into p
  from public.protocol_progress where user_id=uid and protocol_id=p_protocol_id limit 1;
  if not found then return jsonb_build_object('available',false); end if;

  start_d:=coalesce(p.started_at::date,current_date);
  total_n:=greatest(1,least(60,coalesce(p.total_days,28)));
  planned_end:=start_d+total_n-1;
  if jsonb_typeof(coalesce(p.completed_days,'[]'::jsonb))='array' then completed_count:=jsonb_array_length(coalesce(p.completed_days,'[]'::jsonb)); end if;
  finished:=coalesce(p.certificate_unlocked,false) or completed_count>=total_n;
  if finished then actual_end:=coalesce(p.last_validated_at,p.updated_at)::date; end if;
  observed_until:=case when finished then least(actual_end,today_d) else least(coalesce(p.last_validated_at::date,start_d),today_d) end;

  perform public.mt_reference_bootstrap(90);
  before_j:=public.mt_reference_period_summary(uid,start_d-28,start_d-1);
  during_j:=public.mt_reference_period_summary(uid,start_d,greatest(start_d,observed_until));

  -- Maximum 60 lignes compactes et whitelisted : jamais food_meal_items, jamais
  -- l'historique brut des trackers. Les protocoles peuvent donc être nourris par
  -- alimentation, boissons, activité, sommeil, corps et ressentis sans exploser l'egress.
  select coalesce(jsonb_agg(jsonb_build_object('date',d.fact_date,'core',jsonb_strip_nulls(jsonb_build_object(
    'food_kcal',public.mt_reference_num(d.core,'food_kcal'),'protein_g',public.mt_reference_num(d.core,'protein_g'),'fiber_g',public.mt_reference_num(d.core,'fiber_g'),
    'fat_g',public.mt_reference_num(d.core,'fat_g'),'carbs_g',public.mt_reference_num(d.core,'carbs_g'),'salt_g',public.mt_reference_num(d.core,'salt_g'),
    'sugars_g',public.mt_reference_num(d.core,'sugars_g'),'saturated_fat_g',public.mt_reference_num(d.core,'saturated_fat_g'),'sodium_g',public.mt_reference_num(d.core,'sodium_g'),
    'omega3_g',public.mt_reference_num(d.core,'omega3_g'),'omega6_g',public.mt_reference_num(d.core,'omega6_g'),'micronutrient_coverage_count',public.mt_reference_num(d.core,'micronutrient_coverage_count'),
    'food_energy',public.mt_reference_num(d.core,'food_energy'),'food_digestion',public.mt_reference_num(d.core,'food_digestion'),'food_satiety',public.mt_reference_num(d.core,'food_satiety'),
    'beverage_count',public.mt_reference_num(d.core,'beverage_count'),'beverage_hydration_liters',public.mt_reference_num(d.core,'beverage_hydration_liters'),
    'beverage_energy',public.mt_reference_num(d.core,'beverage_energy'),'beverage_digestion',public.mt_reference_num(d.core,'beverage_digestion'),'beverage_caffeine_count',public.mt_reference_num(d.core,'beverage_caffeine_count'),
    'hydration_liters',public.mt_reference_num(d.core,'hydration_liters'),'stress',public.mt_reference_num(d.core,'stress'),'mood',public.mt_reference_num(d.core,'mood'),'energy',public.mt_reference_num(d.core,'energy'),'digestion',public.mt_reference_num(d.core,'digestion'),
    'sleep_quality',public.mt_reference_num(d.core,'sleep_quality'),'sleep_hours',public.mt_reference_num(d.core,'sleep_hours'),'steps',public.mt_reference_num(d.core,'steps'),'active_energy_kcal',public.mt_reference_num(d.core,'active_energy_kcal'),'recovery',public.mt_reference_num(d.core,'recovery'),
    'weight_kg',public.mt_reference_num(d.core,'weight_kg'),'waist_cm',public.mt_reference_num(d.core,'waist_cm')
  )), 'signals', (
    select coalesce(jsonb_object_agg(x.key,x.value),'{}'::jsonb)
    from (select e.key,e.value from jsonb_each(coalesce(d.numeric_signals,'{}'::jsonb)) e order by e.key limit 24) x
  )) order by d.fact_date),'[]'::jsonb) into during_days
  from public.user_reference_daily_facts d
  where d.user_id=uid and d.fact_date between start_d and greatest(start_d,observed_until) and d.source_count>0;

  if finished and actual_end is not null and today_d>actual_end then
    after_j:=public.mt_reference_period_summary(uid,actual_end+1,least(actual_end+28,today_d));
  else
    after_j:=jsonb_build_object('documented_days',0);
  end if;

  return jsonb_build_object('available',true,'start_date',start_d,'planned_end_date',planned_end,
    'actual_end_date',actual_end,'end_date',coalesce(actual_end,planned_end),'completion_status',case when finished then 'completed' else 'in_progress' end,
    'before',before_j,'during',during_j,'after',after_j,'during_days',during_days,
    'note',case when finished then 'Comparaison descriptive fondée sur la fin réellement enregistrée.' else 'Protocole non terminé : aucune période Après n’est créée.' end);
end;
$$;

revoke all on function public.mt_protocol_reference_comparison(uuid) from public,anon;
grant execute on function public.mt_protocol_reference_comparison(uuid) to authenticated;
comment on function public.mt_protocol_reference_comparison(uuid) is 'V453 · Protocoles : faits whitelisted + jusqu’à 24 signaux numériques génériques par jour, max 60 jours.';
commit;
