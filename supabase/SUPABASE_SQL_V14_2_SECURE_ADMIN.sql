-- MÉTHODE TEE V14.2 — ADMIN SÉCURISÉ PAR SUPABASE
-- À exécuter dans le BON projet Supabase Méthode Tee.
-- Objectif : ne plus dépendre d’un code admin visible dans config.js.

create extension if not exists "pgcrypto";

-- Fonction admin officielle : seul cet email est admin.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('teayannaparis@gmail.com');
$$;

-- Tables principales : RLS activé
alter table if exists public.posts enable row level security;
alter table if exists public.protocols enable row level security;
alter table if exists public.protocol_contents enable row level security;
alter table if exists public.app_pages enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.user_protocols enable row level security;
alter table if exists public.club_settings enable row level security;
alter table if exists public.club_capsules enable row level security;
alter table if exists public.private_drops enable row level security;
alter table if exists public.member_profiles enable row level security;

-- POSTS : lecture pour clientes avec accès ou admin, écriture admin seulement
drop policy if exists "posts_read_paid_admin" on public.posts;
create policy "posts_read_paid_admin"
on public.posts for select
using (
  active = true and (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.has_app_access = true
    )
  )
);

drop policy if exists "posts_admin_manage" on public.posts;
create policy "posts_admin_manage"
on public.posts for all
using (public.is_admin())
with check (public.is_admin());

-- PROTOCOLS : visibles si actifs, gestion admin seulement
drop policy if exists "protocols_read_active" on public.protocols;
create policy "protocols_read_active"
on public.protocols for select
using (active = true or public.is_admin());

drop policy if exists "protocols_admin_manage" on public.protocols;
create policy "protocols_admin_manage"
on public.protocols for all
using (public.is_admin())
with check (public.is_admin());

-- CONTENUS PROTOCOLES : uniquement client qui a acheté ou admin
drop policy if exists "contents_owned_admin" on public.protocol_contents;
create policy "contents_owned_admin"
on public.protocol_contents for select
using (
  public.is_admin()
  or exists (
    select 1 from public.user_protocols up
    where up.protocol_id = protocol_contents.protocol_id
    and up.user_id = auth.uid()
    and up.status = 'active'
  )
);

drop policy if exists "contents_admin_manage" on public.protocol_contents;
create policy "contents_admin_manage"
on public.protocol_contents for all
using (public.is_admin())
with check (public.is_admin());

-- PAGES : lecture active, gestion admin
drop policy if exists "pages_read_active" on public.app_pages;
create policy "pages_read_active"
on public.app_pages for select
using (active = true or public.is_admin());

drop policy if exists "pages_admin_manage" on public.app_pages;
create policy "pages_admin_manage"
on public.app_pages for all
using (public.is_admin())
with check (public.is_admin());

-- PROFILS : chaque utilisateur voit son profil, admin gère
drop policy if exists "profiles_own_admin" on public.profiles;
create policy "profiles_own_admin"
on public.profiles for all
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- ACCÈS PROTOCOLES : utilisateur voit ses accès, admin gère
drop policy if exists "user_protocols_own_admin" on public.user_protocols;
create policy "user_protocols_own_admin"
on public.user_protocols for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

-- CLUB SETTINGS / CAPSULES / DROPS / MEMBRES
drop policy if exists "club_settings_read" on public.club_settings;
create policy "club_settings_read"
on public.club_settings for select
using (true);

drop policy if exists "club_settings_admin" on public.club_settings;
create policy "club_settings_admin"
on public.club_settings for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "capsules_read" on public.club_capsules;
create policy "capsules_read"
on public.club_capsules for select
using (active = true or public.is_admin());

drop policy if exists "capsules_admin" on public.club_capsules;
create policy "capsules_admin"
on public.club_capsules for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "drops_read" on public.private_drops;
create policy "drops_read"
on public.private_drops for select
using (active = true or public.is_admin());

drop policy if exists "drops_admin" on public.private_drops;
create policy "drops_admin"
on public.private_drops for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "member_profiles_own_admin" on public.member_profiles;
create policy "member_profiles_own_admin"
on public.member_profiles for all
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

-- Storage : lecture publique des médias nécessaires, upload/modif admin seulement
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
on storage.objects for select
using (bucket_id in ('post-media','protocol-media','protocol-files'));

drop policy if exists "media_admin_insert" on storage.objects;
create policy "media_admin_insert"
on storage.objects for insert
with check (
  bucket_id in ('post-media','protocol-media','protocol-files')
  and public.is_admin()
);

drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update"
on storage.objects for update
using (
  bucket_id in ('post-media','protocol-media','protocol-files')
  and public.is_admin()
)
with check (
  bucket_id in ('post-media','protocol-media','protocol-files')
  and public.is_admin()
);

drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete"
on storage.objects for delete
using (
  bucket_id in ('post-media','protocol-media','protocol-files')
  and public.is_admin()
);

notify pgrst, 'reload schema';
