# V489.4.2 — Frontend catalogue partiel sécurisé

Base exacte : `M-thode-TEE-wellness-main 448.zip`.

Ce patch est FRONTEND ONLY. Ne lance aucun SQL supplémentaire.

Contexte production : V489.4.1.2 a chargé 300 repas, mais seulement 8 sont actuellement publiés. Le frontend V489.4.1 avait déjà été uploadé avant la lecture de ce résultat.

V489.4.2 sécurise cet état intermédiaire :
- le catalogue éditorial est considéré « prêt » à partir de 21 repas publiés ;
- avec moins de 21 repas publiés, TEE fonctionne en mode hybride sécurisé ;
- les 8 repas éditoriaux déjà validés restent utilisables ;
- les autres candidats viennent uniquement des recettes/whole-dishes historiques et des plats CIQUAL déjà composés ;
- le pool de plats CIQUAL déjà complets est élargi à 140 en mode catalogue partiel ;
- le shortlist hebdomadaire est rééquilibré pour préserver davantage d'alternatives historiques, éditoriales et CIQUAL complètes ;
- aucun assemblage libre protéine + féculent + légume n'est appelé ;
- aucun prix inconnu ne devient 0 ;
- aucune modification de paiement, protocole, voix, carnet ou CIQUAL.

## Fichiers à uploader
1. `tee-next.html`
2. `www/tee-next.html`
3. `scripts/tee-next.js`
4. `www/scripts/tee-next.js`

Puis tester `methodetee.app` en navigation privée.

Debug attendu dans `window.mtLastPlannerDebug` :
- `version = V489.4.2`
- `curated.published = 8` tant que le backend reste inchangé
- `curated.ready = false`
- `curated.minimumReady = 21`
- `curated.rawAssemblyFallbackUsed = false`
- `curated.safeHybridFallback = true`
