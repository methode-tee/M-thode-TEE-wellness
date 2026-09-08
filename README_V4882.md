# V488.2 — Planificateur : budget + variété + coûts actuels

Ce patch part **exactement de V487.4**, la version qui avait corrigé le shell natif,
le scroll et la navbar. Il ne repart pas du ZIP 441 pour `tee-next.html`, afin de ne
pas réintroduire la régression d'interface.

## Problème observé au test réel

Le planificateur :
- recomptait dans sa couverture des lignes `optional`, `requires_choice` et
  `budget_exempt` que le backend exclut déjà ;
- pouvait donc afficher 14–15 % alors que la couche de prix est beaucoup plus riche ;
- interprétait un coût partiel très faible comme une recette réellement très bon marché ;
- pouvait cuisiner le même Curry plusieurs fois + ses restes.

## V488.2

- utilise les flags backend actuels pour ne compter que les achats budgétaires ;
- distingue maintenant **Part chiffrable** de la simple présence d'une référence prix ;
- une faible couverture de coût reçoit une pénalité d'incertitude : elle ne peut plus
  gagner uniquement parce que son total documenté paraît artificiellement bas ;
- budget <= 35 € : priorité économie, maximum 2 jours de restes ;
- 36–55 € : équilibre budget/variété, maximum 1 jour de restes ;
- > 55 € : plus de liberté, budget moins agressif, maximum 1 jour de restes ;
- un même plat n'est cuisiné frais qu'une seule fois dans la semaine ;
- les ingrédients déjà utilisés reçoivent un petit bonus de mutualisation ;
- les répétitions de catégorie sont légèrement pénalisées ;
- les restes ne peuvent plus créer `Curry -> restes -> Curry -> restes`.

## Scope

Fichiers seulement :
- `scripts/tee-next.js`
- `www/scripts/tee-next.js`
- `tee-next.html`
- `www/tee-next.html`

Aucun SQL.
Aucun changement de navbar.
Aucun changement du Carnet.
Aucun changement voice.
Aucun changement protocole.
Aucun changement sécurité plantes.

## Test demandé

Après déploiement, même paramètres :
- placard vide
- exclusions vides
- 1 personne
- aucun restaurant
- restes activés

Tester 30 €, 45 €, 70 € et envoyer les trois semaines.
