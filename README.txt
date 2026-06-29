PATCH V77 — Issue du protocole recettes + Daily -> Meals

Remplacer uniquement :
- admin.html
- scripts/admin.js
- scripts/app.js
- style.css
- styles/style.css

SQL :
- supabase/V76_recipe_related_protocol.sql
À ne PAS relancer si déjà exécuté.

Ce patch ne modifie PAS :
- Stripe
- supabase/functions
- stripe-webhook
- create-checkout-session
- create-recipe-checkout-session
- user_protocols
- mtRecipeCard()
- mtFetchRecipes()
- la logique recipe.image_url

Changements précis :
- Admin recettes : champ optionnel Issue du protocole alimenté par la liste des protocoles.
- Admin recettes : sauvegarde recipes.related_protocol_id.
- App recette : carte premium juste avant Ingrédients si related_protocol_id existe.
- Bouton Voir dans Pharmacopée : va vers protocols.html?category=... sans Stripe.
- Filtre recette : libellé Daily remplacé par Meals, mais la valeur reste daily pour ne pas casser les anciennes recettes.
