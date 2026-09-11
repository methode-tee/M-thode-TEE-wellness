# PATCH V4896576 — Adapter mon repas · affinité culinaire + bibliothèque réelle

Base auditée : `M-thode-TEE-wellness-main 478.zip`

## Pourquoi ce patch

Le V4896575 corrigeait le cas « pâtes + lardons » avec une petite liste codée en dur
(pâtes → courgette/épinard/petit pois). Ce n'était pas assez général et pouvait
recréer le même problème avec un autre plat.

V4896576 supprime cette logique parallèle.

Le chemin devient :

1. Adapter comprend les aliments avec la même résolution que le Carnet.
2. Le moteur culinaire déjà présent dans Méthode TEE (`MTFoodUniversalEngine` +
   `food-inspiration-affinities.js`) propose plusieurs affinités adaptées au vrai repas.
3. Seuls les termes issus de ces affinités sont recherchés dans `search_foods_v4`.
4. Supabase renvoie les vraies références de la bibliothèque TEE / CIQUAL.
5. Parmi ces références déjà compatibles, mémoire, moment du repas, intention et
   nutrition départagent le choix.
6. S'il n'existe pas de candidat compatible, TEE ne nomme aucun aliment au hasard.

Il n'y a donc plus de catalogue d'associations spécifique à Adapter.

## Installation

### 1. Supabase SQL Editor

Exécuter en entier :

`supabase/V4896576_ADAPTER_AFFINITE_BIBLIOTHEQUE_REELLE.sql`

Retour attendu :

- `status = v4896576_adapter_affinite_bibliotheque_reelle_pret`
- `rpc_v3 = true`
- `hardcoded_food_pair_catalog = false`

### 2. Upload des fichiers applicatifs

Copier le contenu du patch en conservant les chemins.

Fichiers applicatifs remplacés :

- `scripts/food-adapter.js`
- `www/scripts/food-adapter.js`
- `food-adapter.html`
- `www/food-adapter.html`

Le RPC V3 est essayé en premier. Si le SQL n'est pas encore disponible, le frontend
retombe sur V1 sans casser la page.

## Corrections incluses

- Pâtes : les homonymes `pâté`, `pâte à pizza`, etc. sont écartés en mode *fail closed*.
  Si aucune vraie pâte ne correspond, TEE préfère ne pas chiffrer plutôt que réinjecter
  les mauvais résultats.
- Les associations culinaires ne sont plus écrites à la main dans Adapter.
- Recherche bornée : maximum 8 termes culinaires, 5 résultats par terme, dans un seul RPC.
- Aucune sélection du « premier aliment disponible » quand l'affinité n'est pas prouvée.
- Les aliments familiers ne peuvent départager que des candidats déjà compatibles.
- La couverture macro ancienne/partielle n'est jamais assimilée à une journée complète.
- Un déficit de fibres n'est mentionné que si la couverture stricte est complète ET qu'un
  écart réel existe.
- Reconnaissance d'un aliment ≠ connaissance de sa quantité.

## Tests effectués

- `node --check scripts/food-adapter.js`
- égalité stricte `scripts/food-adapter.js` / `www/scripts/food-adapter.js`
- égalité stricte des deux HTML
- `node tests/adapter-library-affinity.cjs`
- 11 scénarios réussis, notamment :
  - moteur réel : pâtes + lardons → champignon/brocoli/épinard, pas artichaut ;
  - burger flou → aucune garniture inventée avant précision ;
  - homonymes de pâtes → rejetés sans réapparition en fallback ;
  - absence de candidat compatible → aucun aliment nommé ;
  - couverture macro partielle → refusée.

Le SQL a été relu statiquement mais ne peut pas être exécuté ici contre votre Supabase.

## Périmètre inchangé

Aucune modification :
- paiements ;
- déblocage ;
- protocoles ;
- voix / photo / scan ;
- données de repas existantes ;
- IA externe ou recherche Internet.
