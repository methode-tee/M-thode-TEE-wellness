PATCH V286(1) — correction du flash d'images sans toucher aux filtres

Fichiers à upload :
- scripts/app.js
- www/scripts/app.js

Ce correctif :
- évite le double rendu initial des grilles filtrées ;
- conserve les images déjà affichées ;
- met à jour les statuts Pharmacopée sans recréer les cartes ;
- corrige le flash gris / image / gris / image sur Pharmacopée, Objectifs et Recettes.
