-- MÉTHODE TEE · V466 · CONNEXION TOTALE JAUGES / PARCOURS / JOURNÉE COLLECTIVE
-- Base : V465. Objectif : Mon Équilibre et Mes suivis relisent aussi les actions
-- déjà enregistrées dans Mon parcours aujourd'hui, les routines et Notre journée ensemble.
--
-- Principes de sécurité métier :
-- 1) Une saisie explicite reste prioritaire.
-- 2) Les données Méthode Tee déjà enregistrées servent de contexte/fallback.
-- 3) Apple Santé reste un complément pour les mesures objectives compatibles.
-- 4) Une action réalisée (rituel, routine, journée collective, etc.) nourrit la
--    régularité/contexte mais ne fabrique jamais un symptôme, une humeur ou une mesure.
-- 5) Aucun faux doublon n'est créé dans user_tracker_entries ni dans le calendrier.
--
-- Performance : aucune nouvelle table, une RPC compacte bornée à 365 jours.

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

  -- Les protocoles en cours apportent du contexte mais ne créent aucun symptôme.
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
  -- Mon parcours aujourd'hui : on relit l'état réellement enregistré.
  daily_days as (
    select
      da.activity_date d,
      nullif(da.sleep_hours,0) sleep_hours,
      nullif(da.hydration_liters,0) hydration_liters,
      coalesce(da.today_checks,'{}'::jsonb) today_checks,
      coalesce(da.has_hydration,false) has_hydration,
      coalesce(da.has_sleep,false) has_sleep,
      coalesce(da.has_journal,false) has_journal,
      coalesce(da.has_checklist,false) has_checklist,
      coalesce(da.has_tracker,false) has_tracker,
      coalesce(da.has_photo,false) has_photo,
      coalesce(da.has_recipe,false) has_recipe,
      coalesce(da.has_protocol,false) has_protocol,
      coalesce(da.has_routine,false) has_routine,
      coalesce(da.has_ritual,false) has_ritual,
      nullif(trim(da.protocol_title),'') protocol_title,
      da.protocol_day,
      (select count(*)::int
         from jsonb_each(coalesce(da.today_checks,'{}'::jsonb)) e(key,value)
        where e.value='true'::jsonb) today_check_count,
      (select count(*)::int
         from jsonb_each(coalesce(da.today_checks,'{}'::jsonb)) e(key,value)
        where e.value='true'::jsonb and e.key like 'ritual_%') ritual_check_count,
      -- Compte les actions réellement réalisées dans Mon parcours, même si une
      -- ancienne version avait posé seulement un drapeau has_* sans today_checks.
      (
        (select count(*)::int
           from jsonb_each(coalesce(da.today_checks,'{}'::jsonb)) e(key,value)
          where e.value='true'::jsonb)
        + case when coalesce(da.has_journal,false) and coalesce(da.today_checks->>'journal','false')<>'true' then 1 else 0 end
        + case when coalesce(da.has_checklist,false) and coalesce(da.today_checks->>'checklist','false')<>'true' then 1 else 0 end
        + case when coalesce(da.has_tracker,false) and coalesce(da.today_checks->>'tracker','false')<>'true' then 1 else 0 end
        + case when coalesce(da.has_photo,false) and coalesce(da.today_checks->>'photo','false')<>'true' then 1 else 0 end
        + case when coalesce(da.has_recipe,false) and coalesce(da.today_checks->>'recipe','false')<>'true' then 1 else 0 end
        + case when coalesce(da.has_protocol,false) and coalesce(da.today_checks->>'protocol','false')<>'true' then 1 else 0 end
        + case when coalesce(da.has_routine,false) and coalesce(da.today_checks->>'routine','false')<>'true' then 1 else 0 end
        + case when coalesce(da.has_ritual,false)
                 and not exists(
                   select 1 from jsonb_each(coalesce(da.today_checks,'{}'::jsonb)) e(key,value)
                   where e.value='true'::jsonb and e.key like 'ritual_%'
                 ) then 1 else 0 end
        + case when coalesce(da.hydration_liters,0)>=2 and coalesce(da.today_checks->>'hydration','false')<>'true' then 1 else 0 end
      )::int parcours_completed_count
    from public.daily_activity da
    where da.user_id=uid and da.activity_date between from_d and to_d
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
  -- Routines personnelles : uniquement des compteurs de réalisation.
  routine_days as (
    select entry_date d,
      count(*)::int routine_entry_count,
      count(*) filter(where completed=true)::int routine_completed_count
    from public.user_routine_entries
    where user_id=uid and entry_date between from_d and to_d
    group by entry_date
  ),
  -- Notre journée ensemble : on ne crée une journée que si la personne a réellement
  -- participé ou validé au moins un rendez-vous.
  journey_user_days as (
    select journey_date d
    from public.community_journey_participation
    where user_id=uid and journey_date between from_d and to_d
    union
    select journey_date d
    from public.community_journey_completions
    where user_id=uid and journey_date between from_d and to_d and completed=true
  ),
  journey_totals as (
    select journey_date d, count(*)::int total
    from public.community_journey_items
    where is_active=true
      and status in ('scheduled','published')
      and validation_enabled=true
      and journey_date between from_d and to_d
    group by journey_date
  ),
  journey_completed as (
    select journey_date d,
      count(*) filter(where completed=true)::int completed
    from public.community_journey_completions
    where user_id=uid and journey_date between from_d and to_d
    group by journey_date
  ),
  journey_days as (
    select u.d,
      coalesce(t.total,0)::int total,
      coalesce(c.completed,0)::int completed,
      exists(
        select 1 from public.community_journey_participation p
        where p.user_id=uid and p.journey_date=u.d
      ) participated
    from journey_user_days u
    left join journey_totals t on t.d=u.d
    left join journey_completed c on c.d=u.d
  ),
  -- Les signaux de journaux de protocole sont déjà structurés côté application.
  -- On n'interprète jamais le texte libre : uniquement des valeurs numériques.
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
    union select d from routine_days
    union select d from journey_days
    union select d from protocol_days
  ),
  assembled as (
    select
      x.d,
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
      -- Actions / progression : contexte de régularité uniquement.
      jsonb_strip_nulls(jsonb_build_object(
        'hydration_recorded',case when dd.has_hydration or coalesce(dd.hydration_liters,0)>0 then true end,
        'sleep_recorded',case when dd.has_sleep or coalesce(dd.sleep_hours,0)>0 then true end,
        'journal_done',case when dd.has_journal then true end,
        'checklist_done',case when dd.has_checklist then true end,
        'tracker_done',case when dd.has_tracker then true end,
        'photo_done',case when dd.has_photo then true end,
        'recipe_done',case when dd.has_recipe then true end,
        'protocol_done',case when dd.has_protocol then true end,
        'routine_done',case when dd.has_routine or coalesce(rd.routine_completed_count,0)>0 then true end,
        'ritual_done',case when dd.has_ritual or coalesce(dd.ritual_check_count,0)>0 then true end,
        'today_check_count',case when coalesce(dd.today_check_count,0)>0 then dd.today_check_count end,
        'parcours_completed_count',case when coalesce(dd.parcours_completed_count,0)>0 then dd.parcours_completed_count end,
        'ritual_check_count',case when coalesce(dd.ritual_check_count,0)>0 then dd.ritual_check_count end,
        'routine_completed_count',case when coalesce(rd.routine_completed_count,0)>0 then rd.routine_completed_count end,
        'community_journey_completed',case when coalesce(jy.completed,0)>0 then jy.completed end,
        'community_journey_total',case when coalesce(jy.total,0)>0 then jy.total end,
        'community_journey_participated',case when coalesce(jy.participated,false) then true end,
        'protocol_title',dd.protocol_title,
        'protocol_day',dd.protocol_day
      )) actions,
      coalesce(f.source_count,0)
        + case when pd.d is not null then 1 else 0 end
        + case when rd.d is not null and coalesce(rd.routine_completed_count,0)>0 then 1 else 0 end
        + case when jy.d is not null and (coalesce(jy.completed,0)>0 or coalesce(jy.participated,false)) then 1 else 0 end
        + case when dd.d is not null and (
            dd.has_hydration or dd.has_sleep or dd.has_journal or dd.has_checklist or dd.has_tracker or dd.has_photo or dd.has_recipe
            or dd.has_protocol or dd.has_routine or dd.has_ritual or coalesce(dd.parcours_completed_count,0)>0
          ) then 1 else 0 end source_count
    from dates x
    left join public.user_reference_daily_facts f on f.user_id=uid and f.fact_date=x.d
    left join meal_days md on md.d=x.d
    left join daily_days dd on dd.d=x.d
    left join journal_days jd on jd.d=x.d
    left join routine_days rd on rd.d=x.d
    left join journey_days jy on jy.d=x.d
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
    'actions',actions,
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
    'connected_surfaces',jsonb_build_array('Mon profil','Carnet','Ma journée alimentaire','Boissons','Journal','Mes suivis','Protocoles','Mon parcours aujourd''hui','Mes routines','Notre journée ensemble','Calendrier','Apple Santé en complément'),
    'calendar_note','Même date, même Carnet : les données restent rattachées à leur source réelle. Aucun faux doublon de suivi n’est créé.',
    'source_note','Méthode Tee relit d’abord les informations déjà renseignées dans l’application. Les actions de Mon parcours et de Notre journée ensemble nourrissent la régularité et le contexte sans fabriquer de donnée de santé. Apple Santé complète uniquement les mesures compatibles encore absentes.'
  );
end;
$$;

revoke all on function public.mt_tracker_connected_context(text,date,date) from public,anon;
grant execute on function public.mt_tracker_connected_context(text,date,date) to authenticated;
comment on function public.mt_tracker_connected_context(text,date,date) is
  'V466 · Contexte App First transversal : Carnet + profil + suivis + protocoles + Mon parcours + routines + Notre journée ensemble. Les actions nourrissent la régularité, jamais un symptôme inventé.';

commit;
