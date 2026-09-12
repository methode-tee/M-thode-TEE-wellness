# V4896595R1C — WEB ONLY FINAL

Le SQL V4896595R1C est déjà installé et audité proprement.

NE PAS exécuter de SQL avec ce paquet.

Remplacer uniquement ces 6 fichiers dans le projet basé sur le ZIP 484 :

- food-adapter.html
- scripts/adapter-completion.js
- scripts/food-adapter.js
- www/food-adapter.html
- www/scripts/adapter-completion.js
- www/scripts/food-adapter.js

Les query strings HTML utilisent `v4896595r1c-whole-formulas-final` pour casser le cache.

Tests prioritaires après déploiement :
1. Macaroni -> protéine + végétal cohérents issus d'une même formule entière.
2. Thon -> féculent + végétal.
3. Alloco -> base féculent culturelle ; pas variable_composite bloquant.
4. Plantain -> féculent, pas végétal.
5. Macaroni + jambon -> uniquement végétal manquant.
6. Poulet + riz + courgette -> aucun ajout.
7. Aucun fajita, légumes farcis, sandwich, pizza ou autre plat préparé comme simple brique automatique.
