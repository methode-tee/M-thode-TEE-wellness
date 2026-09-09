# MÉTHODE TEE — V488.8.3.1 · FUSION DU CERVEAU HISTORIQUE

Cette version **remplace V488.8.3 non exécuté**. Elle ne crée pas `mt_personal_brain_state` et ne construit pas un second cerveau parallèle.

## Ce qui est fusionné
- `user_reference_daily_facts` + `mt_reference_context()` : mémoire factuelle compacte par jour ;
- `user_holistic_learning_models` + contexte V474/V476 : apprentissage statistique propre au compte ;
- `user_adaptive_cycles` : cycle adaptatif et réévaluation ;
- V488.8.2 : familiarité alimentaire, habitudes, récence, cultures ;
- profil et `reference_settings` ;
- routines, favoris, Notre journée ensemble, activité/journal, trackers, boissons, protocoles, préférences du planificateur ;
- sécurité phyto disponible seulement dans la vue `phyto`.

Le nouveau RPC `mt_tee_global_memory_v1` est un **orchestrateur** : il relie les mémoires existantes au lieu de recopier les données dans une nouvelle table. `mt_tee_memory_domain_v1` fournit ensuite une vue limitée au moteur qui en a besoin.

## Règle essentielle
Tout est relié, mais tout n'agit pas sur tout. Le sommeil n'est pas autorisé à décider arbitrairement d'une cuisine, le sexe ne décide pas d'un plat, et une association statistique reste descriptive. Le planificateur utilise surtout la familiarité alimentaire et les préférences pertinentes ; les protocoles / suivis continuent d'utiliser le contexte holistique V441–V476.

## Culture
- Pad thaï / Ramen / Wonton : premier plan.
- Tom kha gai / Harira : découverte accessible.
- Mafé / Yassa / Poulet DG : découverte spécifique, maximum 1/semaine par défaut.
- Une familiarité réellement enregistrée peut promouvoir un plat spécifique.

## Installation
1. **Ne pas exécuter l'ancien V488.8.3.**
2. Exécuter `supabase/V488831_FUSION_CERVEAU_HISTORIQUE_MEMOIRE_GLOBALE.sql`.
3. Envoyer le JSON `v488831_result`.
4. Si `global_fusion_rpc=true` et `domain_view_rpc=true`, uploader :
   - `scripts/tee-next.js`
   - `www/scripts/tee-next.js`
   - `tee-next.html`
   - `www/tee-next.html`
5. Tester d'abord `methodetee.app` en navigation privée. Xcode seulement après validation web.

## Frontend
Le planificateur demande maintenant la vue `planner` du cerveau fusionné. En cas de problème de déploiement du nouveau RPC, il retombe automatiquement sur la mémoire alimentaire V488.8.2 au lieu de casser l'écran.

Le texte est aussi corrigé : un compte sans assez de repas enregistrés ne prétend plus que TEE connaît déjà ses habitudes alimentaires.
