PATCH V363 — Ma journée alimentaire : multi-repas + repères nutritionnels fiables

1) Plusieurs repas du même type
- Deux collations, deux déjeuners, etc. sont désormais TOUS affichés.
- Aucun repas n'est écrasé visuellement par un Map meal_type → repas.
- Les cartes restent triées selon l'heure déjà renvoyée par Supabase.

2) 0 kcal trompeur supprimé
- La page vérifie, dans la MÊME requête food_meals, si le repas contient réellement des food_meal_items.
- Description/photo seule : affiche « Repères non calculés » au lieu de laisser croire à 0 kcal.
- Au résumé :
  • aucun repas calculé → « — / Non calculé »
  • certains repas calculés → valeurs indiquées comme « partiel »
  • tous calculés → affichage normal
- Un vrai aliment structuré à 0 kcal reste correctement affiché à 0 : ce n'est pas confondu avec « non calculé ».

Technique / Supabase
- Pas de nouvelle requête séparée : food_meal_items(id) est embarqué dans la lecture food_meals existante.
- Aucun Realtime.
- Aucun SQL.
- Aucun historique supplémentaire.
- Cache-busting uniquement de food-day.js / food.css.

Fichiers :
- food-day.html
- www/food-day.html
- scripts/food-day.js
- www/scripts/food-day.js
- styles/food.css
- www/styles/food.css
