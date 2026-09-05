-- MÉTHODE TEE · V475 · CONNEXION PROTOCOLES ↔ CERVEAU GLOBAL ↔ MÉNOPAUSE ↔ FRINGALES
-- Base attendue : V474 corrigé déjà installé.
-- Idempotent.
--
-- Objectifs :
--   1) faire remonter les trackers NUMÉRIQUES intégrés aux protocoles (tracker_entries)
--      dans user_reference_daily_facts sans dupliquer l'historique ;
--   2) conserver la priorité aux saisies explicites de Mes suivis / Journal / Carnet ;
--   3) connecter le contexte Périménopause & ménopause au modèle Fringales & envies ;
--   4) éviter les conclusions simplistes en laissant le modèle multivarié redistribuer
--      ses poids entre sommeil, stress, structure alimentaire et contexte hormonal ;
--   5) ne jamais interpréter du texte libre ni transformer une association en causalité.

begin;

do $$
begin
  if to_regclass('public.tracker_entries') is null then
    raise exception 'V475 prerequisite missing: public.tracker_entries';
  end if;
  if to_regclass('public.user_reference_daily_facts') is null then
    raise exception 'V475 prerequisite missing: public.user_reference_daily_facts';
  end if;
  if to_regprocedure('public.mt_refresh_reference_day(uuid,date,boolean)') is null then
    raise exception 'V475 prerequisite missing: mt_refresh_reference_day';
  end if;
  if to_regprocedure('public.mt_holistic_learning_refresh(date)') is null
     or to_regprocedure('public.mt_holistic_context_v473_base(date)') is null
     or to_regprocedure('public.mt_holistic_intervention_effect(uuid,date,text,date)') is null
     or to_regprocedure('public.mt_holistic_pair_corr(uuid,text,text,integer,date,date)') is null
     or to_regclass('public.user_holistic_learning_models') is null then
    raise exception 'V475 prerequisite missing: V474 learning layer';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Overlay sûr des trackers internes aux protocoles dans le fait journalier.
--
-- Les champs restent namespacés sous protocol_tracker.<content_id>.<field_key>.
-- Seules quelques familles sémantiques NUMÉRIQUES sont aussi normalisées en 0..10
-- pour permettre une lecture transversale. Les données déjà présentes dans core
-- (Mes suivis, Journal, alimentation, etc.) gardent toujours la priorité.
-- ---------------------------------------------------------------------------
create or replace function public.mt_v475_reference_protocol_overlay()
returns trigger
language plpgsql security definer
set search_path=public
as $$
declare
  v_proto_numeric jsonb := '{}'::jsonb;
  v_base_numeric jsonb := '{}'::jsonb;
  v_semantic jsonb := '{}'::jsonb;
  v_proto_keys text[] := '{}';
  v_base_keys text[] := '{}';
  v_all_keys text[] := '{}';
  v_proto_count integer := 0;
  v_old_proto_count integer := 0;
  v_base_source_count integer := 0;

  v_energy numeric; v_stress numeric; v_mood numeric; v_digestion numeric;
  v_sleep numeric; v_recovery numeric; v_hunger numeric; v_satiety numeric;
  v_cravings numeric; v_pain numeric; v_bloating numeric;
  v_hot_proto numeric; v_sweats_proto numeric;
  v_hot_personal numeric; v_sweats_personal numeric;
  v_hot_context numeric; v_sweats_context numeric;
begin
  if new.user_id is null or new.fact_date is null then return new; end if;

  -- Nettoie uniquement l'overlay V475 précédent. Les autres signaux restent intacts.
  select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb)
  into v_base_numeric
  from jsonb_each(coalesce(new.numeric_signals,'{}'::jsonb)) e
  where e.key not like 'protocol_tracker.%'
    and e.key not like 'protocol.%'
    and e.key not in ('perimenopause.hot_flashes_context','perimenopause.night_sweats_context');

  select count(*) filter (where k like 'protocol_tracker:%')
  into v_old_proto_count
  from unnest(coalesce(new.tracker_keys,'{}'::text[])) k;

  -- Retire les anciennes clés protocol_tracker:* de la base avant de recalculer.
  select coalesce(array_agg(k),'{}'::text[])
  into v_base_keys
  from unnest(coalesce(new.tracker_keys,'{}'::text[])) k
  where k not like 'protocol_tracker:%';

  v_base_source_count := greatest(0,coalesce(new.source_count,0)-coalesce(v_old_proto_count,0));

  with raw as (
    select
      te.content_id,
      te.protocol_id,
      lower(regexp_replace(coalesce(fs.elem->>'key',j.key),'[^a-zA-Z0-9_]+','','g')) as field_key,
      coalesce(fs.elem->>'label','') as field_label,
      case
        when jsonb_typeof(j.value)='number' then (j.value #>> '{}')::numeric
        when jsonb_typeof(j.value)='string' and (j.value #>> '{}') ~ '^-?[0-9]+([.,][0-9]+)?$'
          then replace(j.value #>> '{}',',','.')::numeric
        else null
      end as raw_value,
      case when coalesce(fs.elem->>'min','') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(fs.elem->>'min',',','.')::numeric else null end as min_value,
      case when coalesce(fs.elem->>'max','') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(fs.elem->>'max',',','.')::numeric else null end as max_value
    from public.tracker_entries te
    cross join lateral jsonb_each(coalesce(te.values,'{}'::jsonb)) j
    left join lateral (
      select x elem
      from jsonb_array_elements(coalesce(te.field_schema,'[]'::jsonb)) x
      where coalesce(x->>'key','')=j.key
      limit 1
    ) fs on true
    where te.user_id=new.user_id and te.entry_date=new.fact_date
  ), vals as (
    select *,
      case
        when raw_value is null then null
        when max_value is not null and min_value is not null and max_value>min_value
          then greatest(0::numeric,least(10::numeric,10*(raw_value-min_value)/(max_value-min_value)))
        else greatest(0::numeric,least(10::numeric,raw_value))
      end as norm_value
    from raw
    where raw_value is not null and field_key<>''
  )
  select
    coalesce(jsonb_object_agg('protocol_tracker.'||content_id::text||'.'||field_key,to_jsonb(round(raw_value,4))),'{}'::jsonb),
    coalesce(array_agg(distinct 'protocol_tracker:'||content_id::text),'{}'::text[]),
    count(distinct content_id)::int,
    round(avg(norm_value) filter(where field_key ~ '(^|_)(energie|energy|vitalite)(_|$)'),3),
    round(avg(norm_value) filter(where field_key ~ '(stress|tension|cortisol)'),3),
    round(avg(norm_value) filter(where field_key ~ '(^|_)(humeur|mood)(_|$)'),3),
    round(avg(norm_value) filter(where field_key ~ '(digestion|confort_digestif)'),3),
    round(avg(norm_value) filter(where field_key ~ '(sommeil|sleep|qualite_du_sommeil)'),3),
    round(avg(norm_value) filter(where field_key ~ '(recuperation|recovery)'),3),
    round(avg(norm_value) filter(where field_key ~ '(^|_)(faim|hunger)(_|$)'),3),
    round(avg(norm_value) filter(where field_key ~ '(satiete|satiety)'),3),
    round(avg(norm_value) filter(where field_key ~ '(fringale|craving|envie)'),3),
    round(avg(norm_value) filter(where field_key ~ '(douleur|pain|crampe)'),3),
    round(avg(norm_value) filter(where field_key ~ '(ballonnement|bloating)'),3),
    round(avg(norm_value) filter(where field_key ~ '(bouffee|hot_flash)'),3),
    round(avg(norm_value) filter(where field_key ~ '(sueur_nocturne|night_sweat)'),3)
  into v_proto_numeric,v_proto_keys,v_proto_count,
       v_energy,v_stress,v_mood,v_digestion,v_sleep,v_recovery,v_hunger,v_satiety,
       v_cravings,v_pain,v_bloating,v_hot_proto,v_sweats_proto
  from vals;

  -- Les catégories du suivi Périménopause sont transformées uniquement en contexte
  -- ordinal descriptif 0..10. Une non-réponse reste NULL, jamais zéro.
  select
    case
      when values->>'hot_flashes' ilike 'Aucune%' then 0
      when values->>'hot_flashes' ~ '1[^0-9]*à[^0-9]*2' then 3.333
      when values->>'hot_flashes' ~ '3[^0-9]*à[^0-9]*5' then 6.667
      when values->>'hot_flashes' ilike 'Plus de 5%' then 10
      else null
    end,
    case
      when values->>'night_sweats' ilike 'Aucune%' then 0
      when values->>'night_sweats' ilike 'Légère%' then 3.333
      when values->>'night_sweats' ilike 'Modérée%' then 6.667
      when values->>'night_sweats' ilike 'Marquée%' then 10
      else null
    end
  into v_hot_personal,v_sweats_personal
  from public.user_tracker_entries
  where user_id=new.user_id and entry_date=new.fact_date and tracker_key='perimenopause'
  limit 1;

  v_hot_context:=coalesce(v_hot_personal,v_hot_proto);
  v_sweats_context:=coalesce(v_sweats_personal,v_sweats_proto);

  v_semantic:=jsonb_strip_nulls(jsonb_build_object(
    'protocol.energy',v_energy,
    'protocol.stress',v_stress,
    'protocol.mood',v_mood,
    'protocol.digestion',v_digestion,
    'protocol.sleep_quality',v_sleep,
    'protocol.recovery',v_recovery,
    'protocol.hunger',v_hunger,
    'protocol.satiety',v_satiety,
    'protocol.cravings',v_cravings,
    'protocol.pain',v_pain,
    'protocol.bloating',v_bloating,
    'protocol.hot_flashes',v_hot_proto,
    'protocol.night_sweats',v_sweats_proto,
    'perimenopause.hot_flashes_context',v_hot_context,
    'perimenopause.night_sweats_context',v_sweats_context
  ));

  new.numeric_signals:=coalesce(v_base_numeric,'{}'::jsonb)
    || coalesce(v_proto_numeric,'{}'::jsonb)
    || coalesce(v_semantic,'{}'::jsonb);

  -- Un tracker de protocole peut compléter un repère manquant, jamais écraser une
  -- saisie personnelle déjà présente dans core.
  new.core:=jsonb_strip_nulls(jsonb_build_object(
      'energy',v_energy,
      'stress',v_stress,
      'mood',v_mood,
      'digestion',v_digestion,
      'sleep_quality',v_sleep,
      'recovery',v_recovery
    )) || coalesce(new.core,'{}'::jsonb);

  select coalesce(array_agg(distinct k),'{}'::text[])
  into v_all_keys
  from unnest(coalesce(v_base_keys,'{}'::text[])||coalesce(v_proto_keys,'{}'::text[])) k;
  new.tracker_keys:=coalesce(v_all_keys,'{}'::text[]);

  new.source_count:=v_base_source_count+coalesce(v_proto_count,0);
  return new;
end;
$$;

revoke all on function public.mt_v475_reference_protocol_overlay() from public, anon, authenticated;

drop trigger if exists z_v475_reference_protocol_overlay on public.user_reference_daily_facts;
create trigger z_v475_reference_protocol_overlay
before insert or update on public.user_reference_daily_facts
for each row execute function public.mt_v475_reference_protocol_overlay();

-- ---------------------------------------------------------------------------
-- 2. Chaque sauvegarde/suppression d'un tracker de protocole reconstruit le jour.
--    Si ce tracker est l'unique donnée du jour, une ligne compacte est créée.
-- ---------------------------------------------------------------------------
create or replace function public.mt_v475_refresh_protocol_tracker_day(
  p_user uuid,
  p_date date,
  p_refresh_month boolean default true
)
returns void
language plpgsql security definer
set search_path=public
as $$
begin
  if p_user is null or p_date is null then return; end if;

  perform public.mt_refresh_reference_day(p_user,p_date,false);

  if exists(select 1 from public.tracker_entries where user_id=p_user and entry_date=p_date)
     and not exists(select 1 from public.user_reference_daily_facts where user_id=p_user and fact_date=p_date) then
    insert into public.user_reference_daily_facts(user_id,fact_date,core,numeric_signals,tracker_keys,source_count,updated_at)
    values(p_user,p_date,'{}'::jsonb,'{}'::jsonb,'{}'::text[],0,now())
    on conflict(user_id,fact_date) do update set updated_at=now();
  end if;

  if p_refresh_month then perform public.mt_refresh_reference_month(p_user,p_date); end if;
end;
$$;

revoke all on function public.mt_v475_refresh_protocol_tracker_day(uuid,date,boolean) from public, anon, authenticated;

create or replace function public.mt_v475_tracker_entries_changed()
returns trigger
language plpgsql security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    perform public.mt_v475_refresh_protocol_tracker_day(old.user_id,old.entry_date,true);
    return old;
  end if;

  perform public.mt_v475_refresh_protocol_tracker_day(new.user_id,new.entry_date,true);
  if tg_op='UPDATE' and (old.user_id is distinct from new.user_id or old.entry_date is distinct from new.entry_date) then
    perform public.mt_v475_refresh_protocol_tracker_day(old.user_id,old.entry_date,true);
  end if;
  return new;
end;
$$;

revoke all on function public.mt_v475_tracker_entries_changed() from public, anon, authenticated;

drop trigger if exists z_v475_tracker_entries_connected on public.tracker_entries;
create trigger z_v475_tracker_entries_connected
after insert or update or delete on public.tracker_entries
for each row execute function public.mt_v475_tracker_entries_changed();

-- ---------------------------------------------------------------------------
-- 3. Apprentissage individuel V475 : le contexte hormonal peut désormais entrer
--    dans les modèles énergie / fringales / récupération quand il est suffisamment
--    documenté. Avec peu de données, ces prédicteurs restent automatiquement inactifs.
-- ---------------------------------------------------------------------------
create or replace function public.mt_holistic_learning_refresh(target_date date default current_date)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  specs jsonb:=jsonb_build_array(
    jsonb_build_object('key','energy','outcome','energy','predictors',jsonb_build_array('sleep_hours','stress','protein_g','active_energy_kcal','food_kcal','perimenopause.hot_flashes_context','perimenopause.night_sweats_context'),'lags',jsonb_build_array(1,0,0,0,0,0,0)),
    jsonb_build_object('key','cravings','outcome','fringales_envies.urge_intensity','predictors',jsonb_build_array('sleep_hours','stress','protein_g','fiber_g','jeune_intermit._fast_hours','cycle.appetite','perimenopause.hot_flashes_context','perimenopause.night_sweats_context'),'lags',jsonb_build_array(1,0,0,0,0,0,0,0)),
    jsonb_build_object('key','digestion','outcome','digestion','predictors',jsonb_build_array('stress','fiber_g','sleep_hours','jeune_intermit._fast_hours'),'lags',jsonb_build_array(0,0,1,0)),
    jsonb_build_object('key','recovery','outcome','recovery','predictors',jsonb_build_array('sleep_hours','stress','active_energy_kcal','protein_g','food_kcal','perimenopause.hot_flashes_context','perimenopause.night_sweats_context'),'lags',jsonb_build_array(0,0,0,0,0,0,0)),
    jsonb_build_object('key','satiety','outcome','food_satiety','predictors',jsonb_build_array('protein_g','fiber_g','food_kcal','sleep_hours','stress'),'lags',jsonb_build_array(0,0,0,1,0))
  );
  spec jsonb; model jsonb; cached jsonb; models jsonb:='{}'::jsonb;
  pkeys text[]; plags integer[]; mkey text; outcome text;
  source_updated timestamptz; cached_updated timestamptz; cached_through date;
  trained int:=0; usable int:=0;
begin
  if uid is null then raise exception 'auth required'; end if;
  select max(updated_at) into source_updated
  from public.user_reference_daily_facts
  where user_id=uid and fact_date between target_date-89 and target_date;

  for spec in select value from jsonb_array_elements(specs) loop
    mkey:=spec->>'key'; outcome:=spec->>'outcome';
    select array_agg(value order by ord) into pkeys
    from jsonb_array_elements_text(spec->'predictors') with ordinality q(value,ord);
    select array_agg(value::int order by ord) into plags
    from jsonb_array_elements_text(spec->'lags') with ordinality q(value,ord);

    select payload,trained_through,updated_at into cached,cached_through,cached_updated
    from public.user_holistic_learning_models
    where user_id=uid and model_key=mkey;

    if cached is not null and cached_through=target_date
       and (source_updated is null or cached_updated>=source_updated) then
      model:=cached;
    else
      model:=public.mt_holistic_ridge_fit(uid,outcome,pkeys,plags,target_date-89,target_date,1.5);
      insert into public.user_holistic_learning_models(user_id,model_key,trained_through,payload,updated_at)
      values(uid,mkey,target_date,model,now())
      on conflict(user_id,model_key) do update set
        trained_through=excluded.trained_through,payload=excluded.payload,updated_at=now();
    end if;

    trained:=trained+1;
    if model->>'status'='usable' then usable:=usable+1; end if;
    models:=models||jsonb_build_object(mkey,model);
  end loop;

  return jsonb_build_object(
    'version',475,
    'trained_through',target_date,
    'models',models,
    'models_trained',trained,
    'models_usable',usable,
    'causal_graph',jsonb_build_object(
      'version',2,
      'strategy','pre_specified_temporal_graph',
      'principles',jsonb_build_array(
        'previous_day_signals_can_precede_next_day_outcomes',
        'protocol_trackers_are_structured_context_not_free_text',
        'personal_tracker_data_has_priority_over_protocol_fallbacks',
        'perimenopause_is_context_not_automatic_cause',
        'behavioral_adherence_never_fakes_physiology',
        'no_automatic_energy_change'
      )
    ),
    'note','Les poids se recalibrent sur l historique individuel. Le contexte hormonal peut participer au modèle seulement lorsqu il est suffisamment documenté ; il ne constitue jamais une preuve causale.'
  );
end;
$$;

revoke all on function public.mt_holistic_learning_refresh(date) from public, anon;
grant execute on function public.mt_holistic_learning_refresh(date) to authenticated;

-- Force le prochain appel à recalculer les modèles dont la spécification a changé.
update public.user_holistic_learning_models
set trained_through=trained_through-1
where model_key in ('energy','cravings','recovery');

-- ---------------------------------------------------------------------------
-- 4. Wrapper holistique V475 : associations descriptives menopause ↔ fringales.
-- ---------------------------------------------------------------------------
create or replace function public.mt_holistic_context(target_date date default current_date)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  base jsonb; learning jsonb:='{}'::jsonb; effect jsonb:='{}'::jsonb;
  cycle_state jsonb:='{}'::jsonb; cycle_start date; lever text;
  a_hot jsonb; a_sweats jsonb;
begin
  if uid is null then raise exception 'auth required'; end if;
  base:=public.mt_holistic_context_v473_base(target_date);
  learning:=public.mt_holistic_learning_refresh(target_date);
  cycle_state:=coalesce(base->'holistic'->'adaptive_cycle_state','{}'::jsonb);
  cycle_start:=case when coalesce(cycle_state->>'startedOn','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then (cycle_state->>'startedOn')::date else null end;
  lever:=coalesce(cycle_state->'decision'->>'key','');
  if cycle_start is not null and lever<>'' then
    effect:=public.mt_holistic_intervention_effect(uid,cycle_start,lever,target_date);
  else
    effect:=jsonb_build_object('status','not_applicable');
  end if;

  a_hot:=public.mt_holistic_pair_corr(uid,'perimenopause.hot_flashes_context','fringales_envies.urge_intensity',0,target_date-89,target_date);
  a_sweats:=public.mt_holistic_pair_corr(uid,'perimenopause.night_sweats_context','fringales_envies.urge_intensity',0,target_date-89,target_date);

  base:=jsonb_set(base,'{holistic,version}',to_jsonb(475),true);
  base:=jsonb_set(base,'{holistic,learning}',coalesce(learning,'{}'::jsonb),true);
  base:=jsonb_set(base,'{holistic,intervention_effect}',coalesce(effect,'{}'::jsonb),true);
  base:=jsonb_set(base,'{holistic,associations,perimenopause_hot_flashes_to_cravings}',coalesce(a_hot,'{}'::jsonb),true);
  base:=jsonb_set(base,'{holistic,associations,perimenopause_night_sweats_to_cravings}',coalesce(a_sweats,'{}'::jsonb),true);
  base:=jsonb_set(base,'{holistic,connection_matrix_version}',to_jsonb(2),true);
  base:=jsonb_set(base,'{holistic,note}',to_jsonb('Lecture personnalisée multivariée. Les trackers structurés des protocoles rejoignent le même contexte quotidien ; les saisies personnelles restent prioritaires et les associations hormonales restent descriptives.'::text),true);
  return base;
end;
$$;

revoke all on function public.mt_holistic_context(date) from public, anon;
grant execute on function public.mt_holistic_context(date) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Backfill compact limité à 90 jours pour les trackers de protocole existants.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select distinct user_id,entry_date
    from public.tracker_entries
    where entry_date between current_date-89 and current_date
  loop
    perform public.mt_v475_refresh_protocol_tracker_day(r.user_id,r.entry_date,false);
  end loop;

  for r in
    select distinct user_id,date_trunc('month',entry_date)::date month_start
    from public.tracker_entries
    where entry_date between current_date-89 and current_date
  loop
    perform public.mt_refresh_reference_month(r.user_id,r.month_start);
  end loop;
end $$;

commit;
