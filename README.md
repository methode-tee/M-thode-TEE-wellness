PATCH V288 — affichage stable Pharmacopée, Objectifs et Recettes

Fichiers à upload en conservant les chemins :
- protocols.html
- page.html
- scripts/app.js
- scripts/prewarm.js
- styles/style.css
- www/protocols.html
- www/page.html
- www/scripts/app.js
- www/scripts/prewarm.js
- www/styles/style.css

Principes :
- filtres Pharmacopée/Objectifs déjà présents dans le HTML ;
- filtre Recettes et grille Recettes présents dans le HTML initial ;
- aucune image de card masquée par CSS en attente d'une classe JavaScript ;
- toutes les images de cards chargent normalement, sans lazy loading instable ;
- suppression des anciens caches HTML de cards pouvant réafficher des zones vides ;
- une seule construction initiale de la grille Recettes ;
- statuts d'achat mis à jour ensuite sans remplacer les images ;
- correction du sélecteur de préchauffage Recettes.

Aucun SQL.
