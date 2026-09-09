# V489.5.1 — Budget floor + variété canonique

## Budget

V489.5 protégeait déjà les trajectoires proches du plancher dans le beam. V489.5.1 ajoute un second passage explicite : si aucune trajectoire survivante n'atteint le plancher alors que le premier plan est sous celui-ci, une recherche plus large est relancée en mode budget-floor. Une solution n'est acceptée par ce second passage que si son coût final est compris entre `hardFloorRatio × budget` et le budget.

Le passage de secours ne déclenche pas à lui seul un relâchement des contraintes de variété.

## Variété

Les compteurs utilisent désormais des familles canoniques. En particulier :

- `pasta`, `noodle(s)` et `pasta_noodle` -> `pasta_noodle`
- `semolina`, `bulgur`, `couscous` et `semolina_bulgur` -> `semolina_bulgur`
- alias de protéines (`chicken`, `volaille`, etc.) -> familles uniques

Cela empêche deux systèmes de traits différents de contourner les plafonds hebdomadaires.

## Invariants

- aucune IA externe ;
- aucun SQL ;
- aucune modification prix/paiement/protocole ;
- budget jamais dépassé ;
- restes conservés comme exception explicite ;
- 261 repas éditoriaux du backend V489.4.3.1 inchangés.
