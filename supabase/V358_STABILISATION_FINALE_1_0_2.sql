-- V358 — Stabilisation finale 1.0.2
-- À exécuter UNE FOIS dans Supabase > SQL Editor avant de publier la build.
-- Objectifs :
-- 1) ne jamais compter une journée collective 0/0 comme participation ;
-- 2) rendre user_protocols lecture seule pour l'utilisateur (écritures admin/backend seulement) ;
-- 3) empêcher un utilisateur de s'accorder has_app_access ;
-- 4) empêcher la falsification directe du libellé/niveau/badge XP (ils sont dérivés des points).

begin;

-- ---------------------------------------------------------
-- A. Notre journée ensemble : une journée vide ne compte pas.
-- ---------------------------------------------------------
create or replace function public.community_journey_participate(target_date date, completed_now boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return (select count(*)::integer from public.community_journey_participation where journey_date = target_date);
  end if;

  -- Aucun rendez-vous actif = vue informative 0/0, pas une participation.
  if not exists (
    select 1 from public.community_journey_items
    where journey_date = target_date and is_active = true
  ) then
    return (select count(*)::integer from public.community_journey_participation where journey_date = target_date);
  end if;

  insert into public.community_journey_participation(
    user_id, journey_date, first_opened_at, last_opened_at, first_completed_at
  ) values (
    auth.uid(), target_date, now(), now(), case when completed_now then now() else null end
  )
  on conflict (user_id, journey_date) do update set
    last_opened_at = now(),
    first_completed_at = coalesce(public.community_journey_participation.first_completed_at,
      case when completed_now then now() else null end);

  return (select count(*)::integer from public.community_journey_participation where journey_date = target_date);
end;
$$;
grant execute on function public.community_journey_participate(date, boolean) to authenticated;

-- ---------------------------------------------------------
-- B. Accès protocoles : utilisateur = lecture ; admin/backend = écriture.
-- ---------------------------------------------------------
alter table public.user_protocols enable row level security;
drop policy if exists "user_protocols_own_admin" on public.user_protocols;
drop policy if exists "user_protocols_read_own" on public.user_protocols;
drop policy if exists "user_protocols_admin_manage" on public.user_protocols;

create policy "user_protocols_read_own"
on public.user_protocols for select to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(user_email,'')) = lower(coalesce(auth.jwt()->>'email',''))
  or public.is_admin()
);

create policy "user_protocols_admin_manage"
on public.user_protocols for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Une seule policy de lecture des contenus premium : statut actif + déblocage réel.
-- On supprime l'ancienne policy historique qui ne vérifiait pas unlocked.
drop policy if exists "contents_owned_admin" on public.protocol_contents;
drop policy if exists "protocol_contents_read_own_admin" on public.protocol_contents;
create policy "protocol_contents_read_own_admin"
on public.protocol_contents for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.user_protocols up
    where up.protocol_id = protocol_contents.protocol_id
      and up.status = 'active'
      and up.unlocked is distinct from false
      and (
        up.user_id = auth.uid()
        or lower(coalesce(up.user_email,'')) = lower(coalesce(auth.jwt()->>'email',''))
      )
  )
);

-- ---------------------------------------------------------
-- C. Profil : has_app_access ne peut pas être modifié par le compte lui-même.
-- ---------------------------------------------------------
create or replace function public.mt_request_is_trusted_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or coalesce(auth.jwt()->>'role','') = 'service_role';
$$;

create or replace function public.mt_guard_profile_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.mt_request_is_trusted_writer() then return new; end if;
  if tg_op = 'INSERT' then
    new.has_app_access := false;
  elsif new.has_app_access is distinct from old.has_app_access then
    raise exception 'HAS_APP_ACCESS_MANAGED_BY_BACKEND';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mt_guard_profile_access on public.profiles;
create trigger trg_mt_guard_profile_access
before insert or update on public.profiles
for each row execute function public.mt_guard_profile_access();

-- On garde la création/modification de son nom/email, mais la suppression directe
-- du profil utilisateur passe par la fonction delete-account côté backend.
drop policy if exists "profiles_own_admin" on public.profiles;
drop policy if exists "profiles_select_own_admin" on public.profiles;
drop policy if exists "profiles_insert_own_admin" on public.profiles;
drop policy if exists "profiles_update_own_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_select_own_admin" on public.profiles for select to authenticated
using (auth.uid() = id or public.is_admin());
create policy "profiles_insert_own_admin" on public.profiles for insert to authenticated
with check (auth.uid() = id or public.is_admin());
create policy "profiles_update_own_admin" on public.profiles for update to authenticated
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());
create policy "profiles_delete_admin" on public.profiles for delete to authenticated
using (public.is_admin());

-- ---------------------------------------------------------
-- D. XP : niveau/libellé/badge sont toujours recalculés depuis points.
-- Les points restent compatibles avec le système XP actuel de l'app ; ce patch
-- évite qu'un client choisisse directement un niveau ou un badge incohérent.
-- ---------------------------------------------------------
create or replace function public.mt_normalize_member_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare p integer;
begin
  if public.mt_request_is_trusted_writer() then return new; end if;
  p := greatest(0, coalesce(new.points,0));
  new.points := p;
  if p < 250 then
    new.level := 'semence'; new.level_label := 'Semence'; new.badge := '🌱';
  elsif p < 500 then
    new.level := 'graine'; new.level_label := 'Graine'; new.badge := '🌱';
  elsif p < 1500 then
    new.level := 'pousse'; new.level_label := 'Pousse'; new.badge := '🌿';
  elsif p < 4000 then
    new.level := 'floraison'; new.level_label := 'Floraison'; new.badge := '🌸';
  elsif p < 8000 then
    new.level := 'racines'; new.level_label := 'Racines'; new.badge := '🌳';
  else
    new.level := 'alchimiste'; new.level_label := 'Alchimiste'; new.badge := '✶';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mt_normalize_member_level on public.member_profiles;
create trigger trg_mt_normalize_member_level
before insert or update on public.member_profiles
for each row execute function public.mt_normalize_member_level();

notify pgrst, 'reload schema';
commit;
