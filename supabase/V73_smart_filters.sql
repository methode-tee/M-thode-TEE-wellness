-- V73 · Filtres intelligents stricts
-- À lancer dans Supabase > SQL Editor avant de sauvegarder de nouvelles recettes/protocoles avec les nouveaux champs.

alter table public.recipes
add column if not exists meal_type text;

alter table public.protocols
add column if not exists filter_key text;

-- Valeurs conseillées :
-- recipes.meal_type : breakfast, bowl, daily, dinner, snack, sweet, drink
-- protocols.filter_key pharmacie : digestion, sommeil, drainage, energie, cycle, douleurs
-- protocols.filter_key objectifs : silhouette, tonus, force, routine
