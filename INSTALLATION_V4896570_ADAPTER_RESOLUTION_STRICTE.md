# Méthode TEE — V489.6570 — Adapter mon repas : résolution stricte

## Pourquoi ce correctif
Le test `riz + poulet + ratatouille` pouvait être rapproché à tort de **Poulet DG — Cameroun** parce qu'un segment générique comme `poulet` pouvait sélectionner un plat composé dont le nom commençait par ce mot. Des libellés techniques CIQUAL pouvaient aussi remonter dans l'interface.

## Ce que V489.6570 corrige
- Les composants explicitement écrits ont priorité sur un plat composé ressemblant.
- Un plat composé n'est traité comme l'identité du repas que si son nom est réellement présent dans la saisie.
- `riz + poulet + ratatouille` reste donc `riz + poulet + ratatouille`.
- `Poulet DG` reste reconnu quand l'utilisatrice écrit réellement `Poulet DG`.
- Les libellés techniques comme `Poulet blanc, viande et peau crues` sont affichés simplement comme `poulet` dans le contexte utilisateur.
- Si un végétal est déjà reconnu, une donnée de fibres encore légère ne provoque plus artificiellement l'ajout d'un autre légume.
- Si le repas principal contient déjà protéine + féculent + végétal et qu'aucune intention particulière n'est choisie, TEE peut conclure `Garde ton repas comme prévu`.
- Dans ce cas, il n'y a plus deux CTA contradictoires : un seul bouton `Je garde mon repas comme prévu`.

## Installation
1. Dans Supabase SQL Editor, exécuter :
   `supabase/V4896570_ADAPTER_RESOLUTION_STRICTE.sql`

   Résultat attendu :
   `status = v4896570_adapter_resolution_stricte_pret`

2. Uploader ensuite les fichiers du patch en conservant l'arborescence.

3. Recharger complètement le site / l'app web pour prendre le cache-buster `v4896570-adapter-resolution-r1`.

## Tests recommandés
### Test A — composants explicites
`Riz, poulet et ratatouille`

Attendu :
- jamais `Poulet DG` ;
- composition reconnue ;
- protéine + féculent + végétal présents ;
- sans intention particulière : `Garde ton repas comme prévu` sauf justification réelle de portion connue ;
- un seul CTA si aucun changement n'est proposé.

### Test B — vrai plat nommé
`Poulet DG`

Attendu : le plat peut être reconnu comme **Poulet DG** car son nom a été explicitement écrit.

### Test C — contexte journée
Si un autre repas contient du poulet, l'interface doit afficher `du poulet` et jamais le libellé technique CIQUAL.

## Non modifié
- paiements
- déblocage
- droits premium
- voix
- photo
- scan
- protocoles
