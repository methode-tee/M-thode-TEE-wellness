# Patch V439 — Étoile officielle · Mes tendances

Base : Méthode Tee 394.

## Correction visuelle
- Remplace les glyphes `✦` visibles ajoutés à **Mes tendances** par l’asset officiel `brand-compass-star-transparent.png`.
- Corrige l’icône de la ligne **Mes tendances** dans le Carnet.
- Corrige l’icône du titre dans la feuille **Mes tendances**.
- Corrige le bouton **Ouvrir Mes tendances** dans l’historique d’un suivi.
- Aucun losange n’est utilisé pour ces nouveaux éléments.

## Comportement de Mes tendances
- Aucun changement fonctionnel du moteur.
- Le moteur attend au moins 5 journées comparables pour une corrélation transversale avant d’afficher une association.
- L’observation temporelle repas → reflux peut apparaître à partir de 3 épisodes renseignés compatibles.
- Les absences de données restent absentes et ne deviennent jamais zéro.
- Lecture bornée et à la demande, cache 5 minutes : aucune hausse volontaire du cached egress.

## Cache
Les versions de `v18-premium.js` et du chargeur `custom-trackers.js` sont incrémentées afin d’éviter qu’un ancien symbole reste affiché à cause du cache navigateur.

## SQL
Aucun SQL supplémentaire pour ce patch.
