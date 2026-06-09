V20 — RECETTES MARKETPLACE SAFE

Ce patch ajoute un système séparé pour vendre des recettes sans toucher au déblocage existant des protocoles.

Logique :
- Page Recettes = vitrine / découverte / vente.
- Biblio > Recette = recettes déjà achetées + recettes incluses dans les protocoles.

Fichiers modifiés :
- scripts/app.js
- scripts/v18-premium.js
- styles/style.css
- supabase/functions/create-checkout-session/index.ts
- supabase/functions/stripe-webhook/index.ts

Fichier ajouté :
- supabase/SUPABASE_SQL_V20_RECETTES_MARKETPLACE_SAFE.sql

À faire dans Supabase :
1. Exécuter SUPABASE_SQL_V20_RECETTES_MARKETPLACE_SAFE.sql dans SQL Editor.
2. Redéployer les Edge Functions : create-checkout-session et stripe-webhook.
3. Ajouter tes recettes dans la table recipes.
4. Tester avec une recette premium à 1 € avant de lancer les vrais prix.

Important :
Le système protocoles reste séparé. Les achats protocoles continuent d’utiliser user_protocols.
Les achats recettes utilisent recipe_purchases.
