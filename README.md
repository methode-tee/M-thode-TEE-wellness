PATCH V287 — Recettes : même fluidité que Pharmacopée/Objectifs

Fichiers à upload :
- scripts/app.js
- www/scripts/app.js

Ce correctif :
- conserve les filtres Recettes ;
- affiche immédiatement le rendu déjà en cache ;
- lance les recettes et la session en parallèle ;
- utilise le cache local des achats pour le premier affichage ;
- vérifie ensuite les achats réels sans recréer les images ;
- charge seulement la première image en priorité, les suivantes en lazy loading ;
- supprime le flash image → gris → image.
