# PATCH PERFORMANCE — BASE 258

Fichiers à uploader en conservant exactement les chemins :

- scripts/app.js
- scripts/prewarm.js
- supabaseClient.js
- www/scripts/app.js
- www/scripts/prewarm.js
- www/supabaseClient.js

## Correctifs

- Les cards Protocoles et Recettes s’affichent sans attendre le téléchargement de trois images lourdes.
- Seule la première image visible est prioritaire ; les autres utilisent le chargement différé natif.
- Le préchauffage de l’accueil ne crée plus quatre iframes invisibles et ne télécharge plus les catalogues et leurs images en arrière-plan.
- Les demandes simultanées de l’utilisateur Supabase sont regroupées et conservées 10 secondes.

## Non modifié

Stripe, StoreKit, achats, droits, déblocages, SQL Supabase, admin, apparence des cards et données.

Aucun SQL à exécuter.
