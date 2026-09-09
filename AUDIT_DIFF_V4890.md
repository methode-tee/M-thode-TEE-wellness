# Audit diff — V489.0

## Backend ajouté
- `mt_planner_preferences.budget_mode`
- `mt_planner_candidate_traits`
- `mt_planner_candidate_traits_v1()`
- `mt_recipe_cost_batch_v2()`
- `mt_planner_recommendation_history`
- `mt_planner_recent_recommendations_v1()`
- `mt_planner_record_generation_v1()`
- `mt_food_purchase_format_reference`
- `mt_planner_purchase_quote_v1()`

## Frontend modifié
- remplacement du choix glouton par beam search hebdomadaire ;
- trois modes d'utilisation de l'enveloppe ;
- prix de tous les candidats ;
- rotation persistante ;
- mémoire personnelle forte mais subordonnée à la fiabilité prix ;
- diversité multi-axes ;
- affichage couverture « formats magasin » ;
- cache-bust `v4890-week-optimizer-r1`.

## Source de vérité
Ajout en archive des migrations exactes absentes du ZIP 445 : V4885, V48862, V4887, V4888.

## Inchangé
Paiements, accès premium, recettes, nutrition, CIQUAL, protocoles, moteur voix, HealthKit, fonctions du cerveau historique.
