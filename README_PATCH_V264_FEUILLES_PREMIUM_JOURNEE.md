# Patch V264 — Feuilles premium « Notre journée ensemble »

Base : ZIP 263 fourni.

## Comportement
- Le surtitre « Échos du journal » devient « Rituel collectif ».
- Clic sur une vraie carte de l’accueil : feuille premium dédiée uniquement à ce rendez-vous.
- Clic sur le reste du grand bloc ou sur une carte « Moment libre » : feuille premium de la journée complète.
- Les deux feuilles reprennent le langage visuel de la feuille Hydratation : fond flouté, panneau crème, poignée et croix.
- La feuille ciblée conserve la validation et l’ouverture du contenu lié.
- La feuille complète conserve les 6 moments, le compteur membres avec son réglage et son seuil, la progression, les rendez-vous, les moments libres et les pills.

## Performance
- Aucune requête supplémentaire au clic : le payload déjà préchargé est réutilisé.
- Aucun polling, intervalle, observer ou nouveau contrôleur.
- Aucun SQL supplémentaire.
- Aucun fichier StoreKit, Stripe, protocole, achat, déblocage ou notification modifié.

## Fichiers à remplacer
- index.html
- scripts/daily-journey.js
- styles/style.css
- www/index.html
- www/scripts/daily-journey.js
- www/styles/style.css
