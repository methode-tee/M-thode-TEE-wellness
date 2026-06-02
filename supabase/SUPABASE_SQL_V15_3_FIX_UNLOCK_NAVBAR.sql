-- MÉTHODE TEE V15.3 — Correctif accès protocoles / achats Stripe
-- À lancer une fois dans Supabase > SQL Editor.

alter table if exists public.user_protocols add column if not exists user_email text;
alter table if exists public.user_protocols add column if not exists unlocked boolean default true;
alter table if exists public.user_protocols alter column unlocked set default true;

-- Répare les anciennes lignes créées seulement par email.
update public.user_protocols up
set user_id = p.id,
    user_email = coalesce(up.user_email, p.email),
    unlocked = true,
    status = coalesce(up.status, 'active')
from public.profiles p
where up.user_id is null
  and up.user_email is not null
  and lower(p.email) = lower(up.user_email);

-- Les lignes actives existantes sont considérées comme débloquées.
update public.user_protocols
set unlocked = true
where status = 'active' and unlocked is distinct from true;

-- RLS : l'utilisateur peut lire ses accès par user_id OU par email.
alter table public.user_protocols enable row level security;
drop policy if exists "user_protocols_own_admin" on public.user_protocols;
create policy "user_protocols_own_admin"
on public.user_protocols for all
using (
  user_id = auth.uid()
  or lower(coalesce(user_email,'')) = lower(coalesce(auth.jwt()->>'email',''))
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or lower(coalesce(user_email,'')) = lower(coalesce(auth.jwt()->>'email',''))
  or public.is_admin()
);

-- RLS contenus : lire les contenus si protocole débloqué par user_id OU email.
drop policy if exists "protocol_contents_read_own_admin" on public.protocol_contents;
create policy "protocol_contents_read_own_admin"
on public.protocol_contents for select
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

-- Force Supabase/PostgREST à recharger le schéma/policies.
notify pgrst, 'reload schema';
