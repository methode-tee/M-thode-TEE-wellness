# PATCH V482D.2 — 2 s au premier chargement, 1,3 s ensuite

Cette version conserve exactement la même animation de chargement actuelle.

Réglage demandé :
- Première analyse après la phrase vocale : 2,0 secondes minimum.
- Recalcul après un choix d’aliment/préparation : 1,3 seconde minimum.
- Recalcul après saisie d’une quantité : 1,3 seconde minimum.

Le correctif de saisie de quantité de V482D est conservé :
- taper `10`, `100`, `150`, etc. ne déclenche pas le chargement au premier chiffre ;
- l’analyse repart seulement quand la saisie est terminée / validée.

Aucun changement sur :
- SQL
- moteur nutritionnel
- sauvegarde du Carnet
- protocoles
- logique de validation

Fichiers à remplacer :
- index.html
- www/index.html
- scripts/home-smart-cards.js
- www/scripts/home-smart-cards.js
