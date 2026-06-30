-- Patch V90 · PDF premium uploadé pour les recettes
-- À exécuter une seule fois dans Supabase SQL Editor avant d'utiliser le champ PDF recette dans l'admin.
alter table public.recipes
add column if not exists pdf_url text;
