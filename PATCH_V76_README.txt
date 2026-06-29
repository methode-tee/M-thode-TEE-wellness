Patch V76 — Issue du protocole + Meals

À uploader/remplacer :
- admin.html
- scripts/admin.js
- scripts/app.js
- style.css
- styles/style.css

À exécuter une seule fois dans Supabase SQL Editor :
- supabase/V76_recipe_related_protocol.sql

Ce patch ne modifie pas :
- Stripe
- stripe-webhook
- create-checkout-session
- create-recipe-checkout-session
- user_protocols
- les champs images des recettes

Note : le filtre 'Daily' est seulement renommé visuellement en 'Meals'. La valeur technique reste 'daily' pour ne pas casser les recettes existantes.
