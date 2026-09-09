# Audit diff V488.8.2

Base inspectée : `M-thode-TEE-wellness-main 443.zip`.

## Frontend
Deux fichiers seulement sont modifiés :
- `scripts/tee-next.js`
- `www/scripts/tee-next.js`

Le patch frontend est cumulatif et contient V488.8.1 :
- pool 100 % en budget flexible ;
- whole-dish non réutilisé comme faux reste.

Ajouts V488.8.2 :
- lecture de `mt_planner_candidate_meta_v1()` ;
- lecture de `mt_planner_personal_memory_v1(60)` ;
- bonus d'affinité modéré depuis les habitudes ;
- exclusion souple des titres exacts récents ;
- au plus une nouveauté éloignée si des alternatives familières existent ;
- hiérarchie culturelle niveaux 0/1/2 ;
- promotion dynamique d'une cuisine si l'historique du compte démontre sa familiarité ;
- debug `window.mtLastPlannerDebug.version = V488.8.2`.

## Backend
Un nouveau SQL :
`supabase/V48882_HIERARCHIE_CULTURELLE_MEMOIRE_ALIMENTAIRE.sql`

Il :
- ajoute uniquement des clés de ranking dans `food_dictionary.adapter_profile` ;
- crée deux RPC dédiées sans modifier la signature du catalogue historique ;
- ne crée aucune table de profil mémoire supplémentaire ; la mémoire est agrégée à la demande depuis le carnet alimentaire existant.

## Garde-fous
- aucune donnée nutritionnelle ou prix modifié ;
- aucune origine utilisateur inférée ;
- historique brut non renvoyé au frontend : agrégats courts seulement ;
- fallback sûr : si la RPC mémoire échoue ou si l'historique est insuffisant, le planificateur continue sans personnalisation mémoire.
