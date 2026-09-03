# Patch V464 — Heure de validation de la journée collective

Base : `M-thode-TEE-wellness-main 417.zip`.

## Résultat

- Un rendez-vous reste visible avant son heure pour permettre de s’organiser.
- Avant l’heure prévue, le bouton est réellement désactivé et affiche par exemple `Disponible à 19H30`.
- La validation devient disponible automatiquement à l’heure prévue, selon le fuseau horaire local de la personne.
- La personne peut ensuite valider jusqu’à minuit, sans créneau de fermeture intermédiaire.
- Le contenu associé à un rendez-vous reste consultable avant l’heure.
- Les rendez-vous sans heure précise restent immédiatement validables.
- Les anciennes journées restent en lecture seule et aucun historique n’est réécrit.

## Double protection

1. L’interface bloque le bouton avant l’heure et se rafraîchit automatiquement au déverrouillage.
2. Supabase vérifie l’heure réelle du serveur, convertie dans le fuseau local transmis par l’application. Une tentative anticipée est donc refusée même si elle contourne le bouton.

## Ordre d’installation

1. Dans Supabase → SQL Editor, ouvrir puis exécuter entièrement :
   `supabase/V464_JOURNEE_COLLECTIVE_HEURE_VALIDATION.sql`
2. Vérifier que le résultat contient :
   `v464_journee_collective_heure_validation_pret`
3. Décompresser ensuite ce patch à la racine du dépôt GitHub et accepter le remplacement des fichiers.
4. Lancer le déploiement habituel.

Il est important d’exécuter le SQL avant de publier les fichiers web, car la nouvelle interface utilise la fonction Supabase installée par ce script.

## Éléments non modifiés

- Version de l’application : elle reste `1.1.2`, build iOS `45`.
- Achats et accès.
- Protocoles et déblocage à 7 h.
- Journées et validations historiques.
- Contenus administrés.
- Compteurs et récompenses XP existants.

## Vérifications effectuées

- Syntaxe JavaScript validée.
- Copies racine et `www/` strictement identiques.
- Cache des fichiers concernés renouvelé en V464.
- Fenêtre locale vérifiée : avant l’heure bloqué, de l’heure prévue à 23 h 59 disponible.
- Script SQL idempotent : il peut être relancé sans doublon.

