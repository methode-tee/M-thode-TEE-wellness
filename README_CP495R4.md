# CP495R4 — Resolver exact + fail-closed

Ce patch corrige le passage entre la reconnaissance texte et les formules CP495.

## SQL
1. Ajoute une table d'alias qui pointe directement vers des `profile_key` exacts.
2. Intègre cette table dans `mt_adapter_manual_reference_candidates_v1` avant l'ancien resolver par groupe.
3. Conserve le resolver historique en fallback.
4. Ne touche pas au moteur de formules, à la mémoire, aux variantes ni à la complétude.

Alias explicitement curatés inclus : `œufs brouillés / œufs brouillées` -> `ciqual:22502`, `yaourt nature` -> `ciqual:19593`.

## Frontend
Les 2 fichiers `food-adapter.js` empêchent désormais une adaptation partielle : si un seul segment du repas reste sans fiche, TEE bloque la proposition et demande de préciser ce segment au lieu d'envoyer uniquement les aliments reconnus au moteur.

## Ordre
1. Exécuter `CP495R4_SQL_A_EXECUTER.sql`.
2. Vérifier l'audit.
3. Uploader seulement `scripts/food-adapter.js` et `www/scripts/food-adapter.js`.
4. Retester `Poire + yaourt nature` puis `œufs brouillées`.
