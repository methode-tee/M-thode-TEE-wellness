PATCH PDF RECETTES UPLOADÉES

Ce patch ajoute :
1. Dans Admin > Recettes : un champ fichier PDF + un champ lien PDF.
2. Dans l'app : le viewer premium affiche le PDF uploadé après l'animation “Préparation / carnet”.
3. Le bouton “Partager / PDF” ouvre/télécharge le PDF uploadé.
4. Les boutons du bas sont cachés pendant l'animation et apparaissent seulement quand le viewer est prêt.

IMPORTANT SUPABASE :
Avant d'utiliser le champ PDF, exécuter dans Supabase SQL Editor :

alter table public.recipes add column if not exists pdf_url text;

Le fichier SQL est aussi inclus ici :
supabase/SUPABASE_SQL_V90_RECIPE_PDF_UPLOAD.sql

Fichiers modifiés :
- admin.html
- scripts/admin.js
- scripts/app.js
- style.css

Aucun fichier Stripe/paiement/déblocage n'a été modifié.
