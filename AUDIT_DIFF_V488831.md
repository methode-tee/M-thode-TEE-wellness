# AUDIT DIFF V488.8.3.1

## Abandonné par rapport au projet V488.8.3
- aucune table `mt_personal_brain_state` ;
- aucun trigger global `dirty` ;
- aucune duplication du cerveau historique.

## Ajouté
- `mt_tee_global_memory_v1(date, integer, boolean)` : agrège les couches historiques + la mémoire alimentaire ;
- `mt_tee_memory_domain_v1(text, date, boolean)` : vues planner / protocol / home / routine / phyto ;
- `mt_tee_user_module_stats_v1(...)` : helper interne allowlisté pour la présence des modules ;
- hiérarchie Mafé/Yassa/Poulet DG = niveau 2 ;
- frontend planner branché sur la vue `planner` ;
- fallback vers V488.8.2 si le RPC fusionné est indisponible ;
- message mémoire conditionnel.

## Inchangé
Prix, nutrition, recettes, CIQUAL, paiements, droits premium, voix, contenu des protocoles, données historiques V441/V476.
