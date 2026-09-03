-- MÉTHODE TEE · V465 · SUIVIS CONNECTÉS · APP FIRST
-- Objectif : les suivis lisent d'abord les données déjà renseignées dans Méthode Tee.
-- Apple Santé reste un complément facultatif pour les données objectives compatibles.
--
-- Sécurité / performance :
-- - aucune nouvelle table ;
-- - aucune duplication de l'historique ;
-- - une seule RPC compacte, bornée à 365 jours ;
-- - aucun texte libre de journal/protocole n'est renvoyé ;
-- - les repas ne renvoient que leurs horaires + les agrégats déjà compacts ;
-- - une absence reste une absence, jamais un zéro.

begin;

create or replace function public.mt_tracker_connected_context(
  p_tracker_key text default null,
  p_from date default (current_date - 27),
  p_to date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  to_d date := coalesce(p_to,current_date);
  from_d date := greatest(coalesce(p_from,to_d-27), to_d-364);
  v_profile jsonb := '{}'::jsonb;
  v_active_protocols jsonb := '[]'::jsonb;
  v_days jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'auth required'; end if;
  if from_d > to_d then from_d := to_d; end if;

  -- Le profil est un point de départ, jamais une fausse mesure historique.
  begin
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
  exception when others then
    v_profile:='{}'::jsonb;
  end;

  -- Les protocoles en cours servent de contexte. Aucun protocole ne crée à lui seul
  -- un symptôme ou une mesure qui n'a pas été renseigné(e).
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,
      'slug',p.slug,
      'title',p.title,
      'current_day',pp.current_day,
      'total_days',pp.total_days,
      'started_at',pp.started_at
    ) order by pp.updated_at desc),'[]'::jsonb)
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

  with
  -- Horaires des repas : nécessaires notamment au suivi Jeûne intermittent.
  meal_days as (
    select
      meal_date d,
      min(meal_time) filter (where meal_time is not null) first_meal_time,
      max(meal_time) filter (where meal_time is not null) last_meal_time,
      count(*)::int meal_count
    from public.food_meals
    where user_id=uid and meal_date between from_d and to_d
    group by meal_date
  ),
  -- Fallback direct pour les anciennes journées qui auraient précédé les agrégats.
  daily_days as (
    select activity_date d,
      max(nullif(sleep_hours,0)) sleep_hours,
      max(nullif(hydration_liters,0)) hydration_liters
    from public.daily_activity
    where user_id=uid and activity_date between from_d and to_d
    group by activity_date
  ),
  journal_days as (
    select entry_date d,
      max(tracker_stress) stress,
      max(tracker_humeur) mood,
      max(tracker_energie) energy,
      max(tracker_digestion) digestion,
      max(tracker_sommeil) sleep_quality
    from public.journal_entries
    where user_id=uid and entry_date between from_d and to_d
    group by entry_date
  ),
  -- Les signaux de journaux de protocole sont déjà structurés côté application.
  -- On n'interprète jamais ici le texte libre : uniquement des valeurs numériques 1–10.
  protocol_signal_values as (
    select p.entry_date d, j.key,
      avg(case
        when jsonb_typeof(j.value)='number' then (j.value#>>'{}')::numeric
        when jsonb_typeof(j.value)='string' and (j.value#>>'{}') ~ '^-?[0-9]+([.,][0-9]+)?$'
          then replace(j.value#>>'{}',',','.')::numeric
        else null end) value
    from public.protocol_journal_entries p
    cross join lateral jsonb_each(coalesce(p.signals,'{}'::jsonb)) j
    where p.user_id=uid and p.entry_date between from_d and to_d
    group by p.entry_date,j.key
  ),
  protocol_days as (
    select d,
      coalesce(jsonb_object_agg(key,to_jsonb(round(value,2))) filter(where value is not null),'{}'::jsonb) signals
    from protocol_signal_values
    group by d
  ),
  protocol_titles as (
    select entry_date d,
      array_remove(array_agg(distinct nullif(trim(protocol_title),'')),null) titles
    from public.protocol_journal_entries
    where user_id=uid and entry_date between from_d and to_d
    group by entry_date
  ),
  dates as (
    select fact_date d from public.user_reference_daily_facts where user_id=uid and fact_date between from_d and to_d
    union select d from meal_days
    union select d from daily_days
    union select d from journal_days
    union select d from protocol_days
  ),
  assembled as (
    select
      x.d,
      -- Les faits compacts issus de Méthode Tee restent prioritaires. Les lectures
      -- directes ci-dessous ne sont que des fallbacks de compatibilité.
      jsonb_strip_nulls(
        jsonb_build_object(
          'sleep_hours',dd.sleep_hours,
          'hydration_liters',dd.hydration_liters,
          'stress',jd.stress,
          'mood',jd.mood,
          'energy',jd.energy,
          'digestion',jd.digestion,
          'sleep_quality',jd.sleep_quality,
          'first_meal_time',case when md.first_meal_time is not null then to_char(md.first_meal_time,'HH24:MI') end,
          'last_meal_time',case when md.last_meal_time is not null then to_char(md.last_meal_time,'HH24:MI') end,
          'food_meal_time_count',case when coalesce(md.meal_count,0)>0 then md.meal_count end
        ) || coalesce(f.core,'{}'::jsonb)
      ) core,
      coalesce(f.numeric_signals,'{}'::jsonb) numeric_signals,
      coalesce(pd.signals,'{}'::jsonb) protocol_signals,
      coalesce(f.tracker_keys,'{}'::text[]) tracker_keys,
      coalesce(pt.titles,'{}'::text[]) protocol_titles,
      coalesce(f.source_count,0)
        + case when pd.d is not null then 1 else 0 end source_count
    from dates x
    left join public.user_reference_daily_facts f on f.user_id=uid and f.fact_date=x.d
    left join meal_days md on md.d=x.d
    left join daily_days dd on dd.d=x.d
    left join journal_days jd on jd.d=x.d
    left join protocol_days pd on pd.d=x.d
    left join protocol_titles pt on pt.d=x.d
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d,
    'core',core,
    'numeric_signals',numeric_signals,
    'protocol_signals',protocol_signals,
    'tracker_keys',to_jsonb(tracker_keys),
    'protocol_titles',to_jsonb(protocol_titles),
    'source_count',source_count
  ) order by d),'[]'::jsonb)
  into v_days
  from assembled;

  return jsonb_build_object(
    'tracker_key',coalesce(p_tracker_key,''),
    'from',from_d,
    'to',to_d,
    'profile',v_profile,
    'active_protocols',v_active_protocols,
    'days',coalesce(v_days,'[]'::jsonb),
    'priority_order',jsonb_build_array('Saisie explicite du suivi','Données Méthode Tee reliées','Apple Santé en complément'),
    'calendar_note','Les données restent rattachées à leur journée d’origine dans le Carnet. Aucun faux doublon de suivi n’est créé.',
    'source_note','Méthode Tee relit d’abord les informations déjà renseignées dans l’application. Apple Santé complète uniquement les données compatibles encore absentes.'
  );
end;
$$;

revoke all on function public.mt_tracker_connected_context(text,date,date) from public,anon;
grant execute on function public.mt_tracker_connected_context(text,date,date) to authenticated;
comment on function public.mt_tracker_connected_context(text,date,date) is
  'V465 · Contexte compact App First pour Mes suivis : Carnet/profil/journal/protocoles d’abord, Apple Santé en complément côté client.';

commit;
