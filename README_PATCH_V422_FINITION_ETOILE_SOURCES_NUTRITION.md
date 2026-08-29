# Patch V422 — finition avant soumission

Base : ZIP 381 — version 1.1.0 build 43.

## Corrections
- Remplacement du losange décoratif du raccourci Apple Santé par l’étoile à huit branches de l’identité Méthode Tee.
- Les marqueurs décoratifs de la frise protocole utilisent désormais uniquement des étoiles.
- Suppression du nom « CIQUAL » de tous les libellés visibles concernés dans les suivis, analyses nutritionnelles et balises protocole. Le moteur de référence reste inchangé en interne.
- Les sources visibles deviennent « Carnet alimentaire » ou un libellé fonctionnel compréhensible par l’utilisatrice.
- Cache-busting V422 pour éviter qu’un ancien JS reste affiché après déploiement.

## Données sportives — fonctionnement existant conservé
La personne renseigne son activité dans Carnet > Mes suivis > Activité & récupération > Saisir aujourd’hui. Le formulaire demande la pratique, la durée, l’intensité, la récupération et, selon la discipline choisie, des champs dédiés (Pilates, musculation, course, etc.).

Apple Santé peut compléter les données objectives disponibles en lecture seule : pas, distance, énergie active et entraînements. Les ressentis restent saisis manuellement.

Les protocoles physiques ne créent pas une deuxième saisie sportive : ils lisent les données déjà enregistrées dans le suivi Activité & récupération et, lorsque pertinent, les données Apple Santé. Ils les filtrent sur les dates du protocole pour construire leurs propres balises analytiques. Les jours déjà réalisés avant l’installation de ce patch restent pris en compte si ces données existaient déjà dans les suivis / validations du protocole.

Aucun nouveau SQL n’est nécessaire.
