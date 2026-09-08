# AUDIT DIFF — V488.7

## Frontend
Base : V488.2 validée.

Modifications uniquement dans `tee-next.js` :
- ajout `coverageReliabilityScore()` ;
- le score de couverture s'applique à tous les budgets ;
- le mode flexible ne reçoit plus de bonus positif significatif sur un coût partiel ;
- détection `planner_food_whole_dish_v1` ;
- répétition d'un whole-dish = `repeat:true`, affichage `À nouveau ·` ;
- debug passe à V488.7 et expose `repeat` ;
- libellé flexible : `Plus de liberté + variété fiable`.

`tee-next.html` ne change que le cache-buster du script :
`v4882-budget-variete-r1` -> `v4887-fiabilite-culture-r1`.

## Backend
Ajout strict de 4 plats culturels existants : Ramen, Pad thaï, Soupe wonton, Tom kha gai.

Aucune table de stage/temporaire n'est utilisée.
Le SQL fonctionne dans un seul bloc `DO` pour les écritures, puis renvoie un SELECT JSON séparé.

Prix : une référence whole-dish exacte par `food_dictionary_id`, observée le 2026-09-08.
Aucun appel à `mt_food_price_resolve_legacy_v2` pour activer ces plats.

## Non modifié
- `recipes`
- `ciqual_foods`
- fonctions voix
- protocoles
- paiements / déblocages
- moteur de coût des recettes existantes
