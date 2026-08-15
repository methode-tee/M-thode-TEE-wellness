-- V374 — OFFERT PAR TEE · BIBLIOTHÈQUE PERSONNELLE
-- À exécuter AVANT d'uploader le patch V374.
--
-- Objectifs :
-- - Ressources offertes autonomes (PDF, audio, routine, checklist, tracker, suivi, etc.).
-- - L'utilisateur choisit "Ajouter à ma bibliothèque".
-- - Une fois ajoutée, la ressource reste liée à son compte.
-- - Les ressources récupérées rejoignent leur vraie catégorie dans le Carnet.
-- - Cached Egress maîtrisé :
--   * 1 RPC compact à l'ouverture du Carnet (métadonnées seulement),
--   * le contenu lourd/fichier n'est récupéré qu'au moment d'Ouvrir,
--   * pagination 12 par 12 dans "Voir toutes les ressources",
--   * aucun Realtime.
--
-- Les fichiers offerts uploadés par l'admin utilisent le bucket public déjà
-- employé par les recettes (post-media). Les protocoles premium restent privés
-- et totalement séparés.

begin;

create table if not exists public.library_offered_resources (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'pdf',
  title text not null,
  description text,
  content_text text,
  duration_label text,
  thumbnail_url text,
  audio_url text,
  video_url text,
  public_url text,
  file_url text,
  active boolean not null default true,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_offered_resources_type_check check (
    type in (
      'pdf','document','ebook','guide_plantes','video','audio','recette',
      'routine','checklist','tracker','tableau','calendar','playlist','suivi'
    )
  )
);

create index if not exists library_offered_resources_public_idx
  on public.library_offered_resources(active, published_at desc, sort_order asc);

create index if not exists library_offered_resources_type_idx
  on public.library_offered_resources(type, active, published_at desc);

create table if not exists public.library_resource_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.library_offered_resources(id) on delete restrict,
  claimed_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create index if not exists library_resource_claims_user_idx
  on public.library_resource_claims(user_id, claimed_at desc);

alter table public.library_offered_resources enable row level security;
alter table public.library_resource_claims enable row level security;

drop policy if exists "library_offers_admin_all" on public.library_offered_resources;
create policy "library_offers_admin_all"
on public.library_offered_resources
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "library_resource_claims_own_select" on public.library_resource_claims;
create policy "library_resource_claims_own_select"
on public.library_resource_claims
for select
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete
on public.library_offered_resources
to authenticated;

grant select
on public.library_resource_claims
to authenticated;

create or replace function public.library_offers_home()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  offered jsonb := '[]'::jsonb;
  claimed jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into offered
  from (
    select
      r.id,
      r.type,
      r.title,
      left(coalesce(r.description,''), 240) as description,
      r.thumbnail_url,
      r.duration_label,
      r.published_at
    from public.library_offered_resources r
    where r.active = true
      and r.published_at <= now()
      and (r.expires_at is null or r.expires_at > now())
      and not exists (
        select 1
        from public.library_resource_claims c
        where c.user_id = uid
          and c.resource_id = r.id
      )
    order by r.published_at desc, r.sort_order asc, r.created_at desc
    limit 6
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into claimed
  from (
    select
      r.id,
      r.type,
      r.title,
      left(coalesce(r.description,''), 240) as description,
      r.thumbnail_url,
      r.duration_label,
      c.claimed_at
    from public.library_resource_claims c
    join public.library_offered_resources r
      on r.id = c.resource_id
    where c.user_id = uid
    order by c.claimed_at desc
    limit 200
  ) x;

  return jsonb_build_object(
    'offers', offered,
    'claimed', claimed
  );
end;
$$;

grant execute
on function public.library_offers_home()
to authenticated;

create or replace function public.library_offers_page(
  p_type text default 'all',
  p_status text default 'all',
  p_offset integer default 0,
  p_limit integer default 12
)
returns table(
  id uuid,
  type text,
  title text,
  description text,
  thumbnail_url text,
  duration_label text,
  published_at timestamptz,
  claimed boolean,
  claimed_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      r.id,
      r.type,
      r.title,
      left(coalesce(r.description,''), 240) as description,
      r.thumbnail_url,
      r.duration_label,
      r.published_at,
      (c.resource_id is not null) as claimed,
      c.claimed_at
    from public.library_offered_resources r
    left join public.library_resource_claims c
      on c.resource_id = r.id
     and c.user_id = auth.uid()
    where auth.uid() is not null
      and (
        c.resource_id is not null
        or (
          r.active = true
          and r.published_at <= now()
          and (r.expires_at is null or r.expires_at > now())
        )
      )
      and (
        coalesce(nullif(lower(trim(p_type)), ''), 'all') = 'all'
        or r.type = lower(trim(p_type))
      )
      and (
        coalesce(nullif(lower(trim(p_status)), ''), 'all') = 'all'
        or (lower(trim(p_status)) = 'available' and c.resource_id is null)
        or (lower(trim(p_status)) = 'claimed' and c.resource_id is not null)
      )
  )
  select
    b.id,
    b.type,
    b.title,
    b.description,
    b.thumbnail_url,
    b.duration_label,
    b.published_at,
    b.claimed,
    b.claimed_at,
    count(*) over() as total_count
  from base b
  order by
    b.claimed asc,
    coalesce(b.claimed_at, b.published_at) desc
  offset greatest(0, coalesce(p_offset, 0))
  limit least(24, greatest(1, coalesce(p_limit, 12)));
$$;

grant execute
on function public.library_offers_page(text,text,integer,integer)
to authenticated;

create or replace function public.library_claim_offer(
  target_resource uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.library_offered_resources%rowtype;
  claim_time timestamptz;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into r
  from public.library_offered_resources
  where id = target_resource
    and active = true
    and published_at <= now()
    and (expires_at is null or expires_at > now())
  limit 1;

  if not found then
    raise exception 'RESOURCE_NOT_AVAILABLE';
  end if;

  insert into public.library_resource_claims(user_id, resource_id)
  values(uid, r.id)
  on conflict(user_id, resource_id) do nothing;

  select c.claimed_at
  into claim_time
  from public.library_resource_claims c
  where c.user_id = uid
    and c.resource_id = r.id;

  return jsonb_build_object(
    'ok', true,
    'id', r.id,
    'type', r.type,
    'title', r.title,
    'description', r.description,
    'thumbnail_url', r.thumbnail_url,
    'duration_label', r.duration_label,
    'claimed_at', claim_time
  );
end;
$$;

grant execute
on function public.library_claim_offer(uuid)
to authenticated;

create or replace function public.library_offered_item(
  target_resource uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.library_offered_resources%rowtype;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_admin()
     and not exists (
       select 1
       from public.library_resource_claims c
       where c.user_id = uid
         and c.resource_id = target_resource
     )
  then
    raise exception 'RESOURCE_NOT_CLAIMED';
  end if;

  select *
  into r
  from public.library_offered_resources
  where id = target_resource
  limit 1;

  if not found then
    raise exception 'RESOURCE_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'id', r.id,
    'offer_resource_id', r.id,
    'library_offer', true,
    'source', 'Offert par Tee',
    'type', r.type,
    'title', r.title,
    'description', r.description,
    'content_text', r.content_text,
    'duration_label', r.duration_label,
    'thumbnail_url', r.thumbnail_url,
    'audio_url', r.audio_url,
    'video_url', r.video_url,
    'public_url', r.public_url,
    'file_url', r.file_url,
    'created_at', r.created_at
  );
end;
$$;

grant execute
on function public.library_offered_item(uuid)
to authenticated;

notify pgrst,'reload schema';

commit;
