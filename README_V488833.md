# V488.8.3.3 — Budgets distincts + mémoire profilée

Correctif **frontend uniquement**, cumulatif sur V488.8.3.2. Aucun SQL.

## Pourquoi
Le test réel montrait qu'un même profil obtenait 6 plats sur 7 identiques à 30 € et 45 €.
La mémoire était active, mais son sous-pool était encore trop large : le budget changeait surtout l'ordre, pas la composition de la semaine.

## Ce qui change
- Fiabilité 100 % conservée avant toute mémoire.
- Construction d'un **coeur budgétaire par repas** :
  - économie : candidats réellement compatibles avec ~budget/jour ;
  - équilibre : coeur de prix intermédiaire, pour exploiter la marge de 45 € ;
  - flexible : plage plus large sans chercher à dépenser le budget.
- La mémoire est normalisée **par percentile dans le profil** (`_memoryRank`) : elle discrimine les candidats entre eux même si les scores bruts sont proches.
- Les 5 slots guidés utilisent un vrai sous-pool de 4 à 6 voisins, pas jusqu'à 10.
- Les 2 slots ouverts atténuent fortement la mémoire et évitent, si possible, le top 25 % déjà surreprésenté.
- Les repas exacts récents restent évités.
- Les garde-fous culturels V488.8.3.1 restent inchangés.

## Installation
Remplacer uniquement :
- `scripts/tee-next.js`
- `www/scripts/tee-next.js`
- `tee-next.html`
- `www/tee-next.html`

Aucun SQL, aucune modification prix/nutrition/CIQUAL/paiements/protocoles.

## Test attendu
Pour le même compte documenté :
- 30 € et 45 € ne doivent plus être la même semaine réordonnée ;
- les deux restent 100 % chiffrables tant que le pool strict suffit ;
- le profil reste visible dans les deux budgets ;
- 45 € doit exploiter davantage les candidats milieu de gamme / variés ;
- 30 € doit rester franchement économique.
