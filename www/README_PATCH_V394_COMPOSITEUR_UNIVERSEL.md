# Patch V394 — Compositeur universel de boissons

Ce correctif remplace la sélection dans une liste finie de recettes par une composition dynamique.

## Installation

1. Uploader le patch sur GitHub comme d'habitude.
2. Dans Supabase SQL Editor, exécuter `supabase/V394_COMPOSITEUR_BOISSONS_UNIVERSEL.sql` après V392.
3. V392 et V393 déjà exécutés n'ont pas besoin d'être relancés.

## Comportement

- chaque ingrédient sûr et activé peut être considéré seul ou avec d'autres ingrédients compatibles ;
- l'ordre de saisie n'influence pas la pertinence ;
- le moteur choisit infusion, thé, eau aromatisée ou smoothie selon les ingrédients ;
- aucun ingrédient absent n'apparaît dans la préparation ;
- un complément éventuel est clairement marqué comme facultatif ;
- avec beaucoup d'ingrédients, une proposition emploie au maximum quatre éléments cohérents et indique ceux laissés de côté ;
- « Une autre idée » fait varier la sous-combinaison ;
- les ingrédients à prudence élevée restent exclus automatiquement ;
- sensibilité à la caféine, grossesse/allaitement et traitement régulier sont respectés.

## Test de référence

Avec `pomme + hibiscus + cynorrhodon`, le moteur doit construire une infusion utilisant ces ingrédients disponibles. Il ne doit plus afficher mangue ou fruit de la passion dans la préparation.
