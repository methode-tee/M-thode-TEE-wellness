-- Méthode Tee V464 — Notre journée ensemble : validation seulement à l'heure prévue
-- À exécuter une seule fois dans Supabase SQL Editor avant de publier les fichiers web.
-- Idempotent : le script peut être relancé sans créer de doublon.

begin;

create or replace function public.community_journey_set_completion(
  p_item_id uuid,
  p_completed boolean,
  p_timezone text default 'UTC'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  journey_item public.community_journey_items%rowtype;
  resolved_timezone text;
  local_now timestamp without time zone;
  saved_at timestamptz := clock_timestamp();
  current_member_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select name
    into resolved_timezone
    from pg_timezone_names
   where name = nullif(trim(p_timezone), '')
   limit 1;

  if resolved_timezone is null then
    raise exception 'INVALID_TIMEZONE';
  end if;

  select *
    into journey_item
    from public.community_journey_items
   where id = p_item_id
     and is_active = true
     and status in ('scheduled', 'published');

  if not found then
    raise exception 'JOURNEY_ITEM_NOT_AVAILABLE';
  end if;

  if journey_item.validation_enabled is false then
    raise exception 'JOURNEY_VALIDATION_DISABLED';
  end if;

  local_now := timezone(resolved_timezone, saved_at);

  -- Une validation ou une annulation concerne uniquement la journée locale en cours.
  if journey_item.journey_date <> local_now::date then
    raise exception 'JOURNEY_NOT_TODAY';
  end if;

  -- La consultation reste possible en avance, mais une nouvelle validation attend l'heure.
  if p_completed
     and journey_item.scheduled_time is not null
     and local_now::time < journey_item.scheduled_time then
    raise exception 'JOURNEY_TOO_EARLY:%', to_char(journey_item.scheduled_time, 'HH24:MI');
  end if;

  insert into public.community_journey_completions(
    user_id,
    journey_item_id,
    journey_date,
    completed,
    completed_at,
    updated_at
  ) values (
    auth.uid(),
    journey_item.id,
    journey_item.journey_date,
    p_completed,
    case when p_completed then saved_at else null end,
    saved_at
  )
  on conflict (user_id, journey_item_id, journey_date)
  do update set
    completed = excluded.completed,
    completed_at = excluded.completed_at,
    updated_at = excluded.updated_at;

  current_member_count := public.community_journey_participate(
    journey_item.journey_date,
    p_completed
  );

  return jsonb_build_object(
    'ok', true,
    'journey_item_id', journey_item.id,
    'journey_date', journey_item.journey_date,
    'completed', p_completed,
    'completed_at', case when p_completed then saved_at else null end,
    'scheduled_time', journey_item.scheduled_time,
    'timezone', resolved_timezone,
    'server_local_time', local_now,
    'member_count', current_member_count
  );
end;
$$;

revoke all on function public.community_journey_set_completion(uuid, boolean, text) from public;
grant execute on function public.community_journey_set_completion(uuid, boolean, text) to authenticated;

commit;

select jsonb_pretty(jsonb_build_object(
  'status', 'v464_journee_collective_heure_validation_pret',
  'validation_avant_heure_bloquee', true,
  'consultation_avant_heure_conservee', true,
  'rattrapage_jusqua_minuit', true,
  'historique_modifie', false,
  'achats_modifies', false,
  'protocoles_modifies', false
));
