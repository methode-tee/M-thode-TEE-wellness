PATCH V287(4)

1. Pharmacopée et Objectifs
- Le filtre est injecté immédiatement avant les attentes réseau/session.
- Aucun changement d'apparence ni de fonctionnement des filtres.
- Le rendu performant des cartes et images reste conservé.

2. Recettes
- Chargement des recettes sans attente artificielle du décodage des images.
- Premier rendu avec les accès connus localement.
- Vérification des achats ensuite, sans recréer les éléments image.
- Deux premières images prioritaires, suivantes en lazy loading.
- Correction du sélecteur de préchauffage des vraies cards Recettes.

Fichiers à uploader :
- scripts/app.js
- scripts/prewarm.js
- www/scripts/app.js
- www/scripts/prewarm.js
