# V486.3 — correction des 7 derniers manquants

## Résultat V486.2

- baseline V485.3 : 139/139
- shadow V6 : 139/139
- couverture exacte : 284/284
- smoke 25 : 18/25

La couche exacte savait donc retrouver tous les aliments, mais 7 étaient bloqués
avant l'override par une condition trop large : la simple présence d'alternatives
était considérée comme une ambiguïté métier.

Or les 7 ont `original_resolution.status = resolved_candidate` : ce ne sont pas
des ambiguïtés à protéger. Le V4 avait seulement fourni des alternatives
informatives.

V486.3 protège désormais uniquement les vraies ambiguïtés :
`needs_detail` / `needs_subdetail` (ex. Eru, Chicken/Veggie McDo).

Quand une fiche exacte unique existe dans food_dictionary, elle prend priorité
sur un candidat CIQUAL/générique déjà résolu.

## Ordre SQL

1. `V4863_PRIORITE_EXACTE_APRES_V4.sql`
2. `V4863_INSTALL_SHADOW_GATE_139.sql`
3. `V4863_RUN_GATE_V4853_INCHANGE_LECTURE_SEULE.sql`
4. `V4863_RUN_SHADOW_GATE_V7_LECTURE_SEULE.sql`
5. `V4863_SMOKE_7_MANQUANTS_LECTURE_SEULE.sql`
6. `V4863_SMOKE_25_ALIMENTS_REELS_LECTURE_SEULE.sql`
7. `V4863_COUVERTURE_BIBLIOTHEQUE_COMPLETE_LECTURE_SEULE.sql`

Attendu :
- 139/139 baseline
- 139/139 shadow V7
- 7/7 anciens manquants
- 25/25 smoke
- 284/284 couverture exacte

Le frontend cumulatif appelle V7.
