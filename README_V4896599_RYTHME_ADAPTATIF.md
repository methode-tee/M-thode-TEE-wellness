# Méthode TEE — V4896599 — Rythme alimentaire adaptatif

Correctif de V4896598.

## Ce qui reste volontairement inchangé
- Le seuil technique de 7 h sur la carte d'accueil reste un simple garde-fou d'affichage.
- Il ne signifie pas que la journée alimentaire commence à 7 h.
- Aucun SQL supplémentaire n'est requis : le moteur utilise le backend V4896597 déjà installé.

## Correction principale
Le pilotage ne s'appuie plus sur des seuils fonctionnels fixes 10 h / 14 h / 16 h / 18 h / 19 h.

Quand au moins 3 journées documentées permettent d'apprendre le rythme :
- la médiane du premier repas et la médiane du dernier repas définissent la fenêtre personnelle ;
- les phases « début / milieu / tard / fin » sont calculées relativement à cette fenêtre ;
- les seuils d'alerte de rattrapage se déplacent donc selon le rythme de l'utilisateur ;
- une personne dont la fenêtre habituelle est 11 h 30 → 22 h n'est pas pilotée comme une personne à 8 h → 20 h.

Sans historique suffisant, l'heure est volontairement sous-pondérée et les repas réellement renseignés priment.

## Contexte du prochain repas
Avant le premier repas documenté du jour, Tee ne devine plus arbitrairement « petit-déjeuner » ou « déjeuner ».
Après un repas documenté, le contexte suivant est dérivé des types de repas réellement saisis (ex. breakfast + lunch → snack).

## Fichiers modifiés
- scripts/food-guidance.js
- scripts/home-smart-cards.js
- scripts/food-day.js
- www/scripts/food-guidance.js
- www/scripts/home-smart-cards.js
- www/scripts/food-day.js
- index.html / www/index.html
- food-day.html / www/food-day.html

## Validation
`qa/test_v4896599_adaptive_pacing.js` vérifie notamment que les seuils temporels se déplacent selon le rythme appris et qu'aucun type de repas n'est inventé avant le premier repas du jour.
