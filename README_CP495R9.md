# PATCH CP495R9 — FRONTEND PUBLIC RELEVANCE

## Objet
Correctif frontend après les tests CP495R8 / R8.3.

Ce patch ne touche pas Supabase. Il corrige le rendu public restant côté Adapter :

1. **libellés CIQUAL trop techniques** dans les propositions et dans les choix de repères ;
2. **formules publiques trop rigides ou trompeuses** (ex. « salade protéinée & céréale » affichée pour une omelette) ;
3. **affichage plus naturel des ajouts** pour les aliments cuits / pains / légumes.

## Effets attendus
- `poulet grillé au citron` ne doit plus afficher des ajouts au format trop brut de type :
  - `Pomme de terre, bouillie/cuite à l'eau`
  - `Épinard, bouilli/cuit à l'eau`
  mais des formes plus naturelles :
  - `Pommes de terre cuites`
  - `Épinards cuits`

- `omelette de 2 œufs aux épinards` ne doit plus afficher publiquement la formule
  `salade protéinée & céréale`.
  Le texte public doit être reformulé en quelque chose de plus cohérent comme
  `assiette complète autour de ta protéine`.

- Les libellés suivants sont simplifiés quand ils remontent du resolver / CIQUAL :
  - Pain complet ou intégral (à la farine T150) -> **Pain complet**
  - Pomme de terre, bouillie/cuite à l'eau -> **Pommes de terre cuites**
  - Épinard, bouilli/cuit à l'eau -> **Épinards cuits**
  - Carotte, bouillie/cuite à l'eau -> **Carottes cuites**
  - Haricot vert, cuit -> **Haricots verts**
  - Courgette, rôtie/cuite au four -> **Courgettes rôties**
  - Lieu jaune ou colin, cuit -> **Poisson blanc cuit**
  - Fromage blanc, nature, 0% MG -> **Fromage blanc 0 %**
  - Fromage blanc, nature, 2-3% MG -> **Fromage blanc 2–3 %**

## Fichiers à remplacer
- `scripts/adapter-v-engine.js`
- `www/scripts/adapter-v-engine.js`
- `scripts/food-adapter.js`
- `www/scripts/food-adapter.js`

## Remarque
Ce patch améliore **le rendu et la cohérence publique visibles**.
Il ne recure pas encore toute la curation formule par formule côté base.
Si, après ça, certaines propositions restent discutables sur le fond,
il faudra faire un patch SQL de priorité / rotation des formules.
