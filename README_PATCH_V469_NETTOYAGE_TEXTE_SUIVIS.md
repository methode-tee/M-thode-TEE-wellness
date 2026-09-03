# PATCH V469 — Nettoyage des textes visibles de Mes suivis

Base : **M-thode-TEE-wellness-main 422.zip**.

## But

Retirer de l’interface utilisateur les explications techniques introduites par V465/V466. La logique interne reste exactement la même : les données déjà renseignées dans Méthode Tee continuent d’être reliées automatiquement et Apple Santé continue de compléter les mesures compatibles.

## Modifications visibles

La carte ne montre plus :
- « MÉTHODE TEE · D’ABORD » ;
- « données de l’app prioritaires » ;
- les listes « Déjà pris en compte » ;
- « Même date, même Carnet » ;
- les explications sur les champs vides ;
- les mentions Supabase / connexion interne ;
- les détails de fonctionnement des protocoles reliés.

Elle affiche seulement ce qui est utile à la personne :
- **REPÈRES DU JOUR** ;
- les valeurs déjà disponibles quand il y en a ;
- une phrase courte indiquant que Méthode Tee intègre automatiquement les informations utiles déjà renseignées ;
- pour Réduction du sucre uniquement, la précision nécessaire « sucres totaux documentés ≠ forcément sucres ajoutés ».

## Technique

- Aucun SQL.
- Aucune table ou RPC modifiée.
- Aucun changement de calcul, de priorité des sources, de sauvegarde ou de synchronisation.
- `custom-trackers.js` uniquement pour les textes visibles.
- `v18-premium.js` et les HTML concernés uniquement pour forcer le cache V469.
