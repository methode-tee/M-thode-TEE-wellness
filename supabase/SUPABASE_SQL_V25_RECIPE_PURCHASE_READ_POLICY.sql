-- V25 — Lecture sécurisée des recettes achetées par user_id OU par email
-- À coller dans Supabase SQL Editor puis RUN.

alter table public.recipe_purchases enable row level security;

drop policy if exists "Users can read own recipe purchases" on public.recipe_purchases;
drop policy if exists "Users can read own recipe purchases by id or email" on public.recipe_purchases;

create policy "Users can read own recipe purchases by id or email"
on public.recipe_purchases
for select
to authenticated
using (
  auth.uid() = user_id
  or lower(coalesce(user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
