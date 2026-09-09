# Méthode TEE — V489.4.3

Patch basé sur le ZIP **M-thode-TEE-wellness-main 449.zip**.

## Ce patch corrige les 3 points du test à 45 €

1. **Budget équilibré trop sous-utilisé**
   - cible `balanced` : 90 % de l’enveloppe ;
   - plancher de sélection : 78 % **uniquement si une semaine complète et fiable l’atteint** ;
   - sinon le moteur garde la meilleure semaine cohérente au lieu de forcer une dépense ;
   - shortlist élargie avec des candidats proches de la dépense/jour cible.

2. **Catalogue éditorial bloqué à 8 repas**
   - ajout de `mt_curated_component_dictionary_v3` ;
   - 111 règles explicites composant/rôle ;
   - elles couvrent 923 occurrences sur 937 dans le catalogue source de 300 repas ;
   - aucune baisse du seuil `resolved_high` ;
   - les 14 occurrences volontairement non mappées restent en revue/draft ;
   - les niveaux culturels 2 restent en revue manuelle ;
   - après exécution SQL, le JSON final donne le nombre réellement publié dans la base vivante.

3. **Texte interne visible aux utilisatrices**
   - retrait des compteurs CIQUAL/catalogue/prix internes ;
   - retrait de « part chiffrable », « formats magasin », RNM, fraîcheur 120/365 j, assembleur libre/IA externe ;
   - interface reformulée autour du budget, des habitudes et de la semaine ;
   - les détails techniques restent uniquement dans `window.mtLastPlannerDebug`.

## Ordre

1. Exécuter :
   `supabase/V48943_CATALOGUE_ETENDU_BUDGET_UI_PROPRE.sql`
2. Vérifier le JSON `v48943_result`.
3. Uploader les 4 fichiers :
   - `tee-next.html`
   - `www/tee-next.html`
   - `scripts/tee-next.js`
   - `www/scripts/tee-next.js`
4. Tester 45 € / « Utiliser raisonnablement mon budget » sur 3 générations.

## Garde-fous conservés

- aucun assemblage libre CIQUAL ;
- aucun prix inconnu = 0 ;
- aucune modification de `ciqual_foods` ;
- aucun changement paiement / protocoles / voix / recettes ;
- max culture spécifique conservé côté planner ;
- rotation sémantique conservée.
