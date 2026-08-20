# Patch V383 — Hydratation et aperçu de demain

Correctif cumulatif construit depuis le ZIP 355.

## Hydratation

- Le panneau d'hydratation conserve les ajouts rapides existants.
- Une section « Une erreur ? Corriger le total du jour » permet de saisir le total exact en centilitres.
- La correction accepte 0 cl et remplace réellement la valeur du jour.
- Le nouveau total est synchronisé avec `daily_activity`, le calendrier, le Carnet et Mon Équilibre.

Exemple : si 4 L ont été enregistrés par erreur, saisir `150` puis toucher « Corriger » ramène le total à 1,5 L.

## Préparation du lendemain

- Le prochain jour du protocole reste verrouillé jusqu'à 7 h.
- La veille, un aperçu est affiché uniquement lorsqu'il existe une recette ou un guide terrain.
- Pour une recette, l'aperçu montre le titre et les ingrédients repérables dans la section « Ingrédients ».
- Pour un guide terrain, l'aperçu montre le nom de la plante à prévoir.
- Les instructions, quantités détaillées, fichiers, validations et autres contenus restent verrouillés.
- Aucun jour situé après le lendemain n'est dévoilé.

Aucune migration SQL n'est nécessaire.
