# Patch cumulatif 396 — base 369(4)

Ce patch différentiel contient uniquement les fichiers ajoutés ou modifiés depuis le ZIP 369(4).

## Inclus

- éléments du README de prochaine mise à jour et des cinq captures validées ;
- bibliothèque boissons, infusions, plantes, fruits et mélanges ;
- saisie d’une boisson déjà consommée et compositeur dynamique ;
- connexion des boissons au Carnet et à Mon Équilibre ;
- accompagnement quotidien et tendances prudentes ;
- bilan et trois évaluations après un protocole ;
- notifications locales des rendez-vous ;
- objectifs ponctuels propres à chaque journée, avec retour au texte par défaut le lendemain ;
- corrections Cycle, moteur alimentaire et « Une autre idée » ;
- suppression de compte avec motif facultatif et historique anonyme ;
- localisation française des choix photo iOS ;
- fichiers racine et `www` synchronisés ;
- compositeur universel V394 : sous-combinaisons dynamiques, formats infusion/thé/smoothie/eau aromatisée, précautions et ingrédients réellement disponibles.

## Installation

1. Décompresser le ZIP à la racine du dépôt GitHub et accepter le remplacement des fichiers.
2. Exécuter dans Supabase SQL Editor, dans cet ordre :
   - `supabase/V392_BIBLIOTHEQUE_BOISSONS_INFUSIONS.sql`
   - `supabase/V393_ACCOMPAGNEMENT_CONTINU.sql`
   - `supabase/V394_COMPOSITEUR_BOISSONS_UNIVERSEL.sql`
3. Si V392 et V393 ont déjà été exécutés avec succès, exécuter seulement V394.
4. Redéployer la fonction Supabase `delete-account` afin d’activer le motif facultatif et l’historique anonyme.
5. Pour une nouvelle archive iOS, ouvrir le projet Xcode après synchronisation Capacitor : les textes système de sélection photo seront alors localisés en français.

## Contrôle de référence

Avec `pomme + hibiscus + cynorrhodon`, le compositeur doit produire une infusion utilisant ces ingrédients réellement disponibles. Aucun ingrédient absent ne doit apparaître dans la préparation.
