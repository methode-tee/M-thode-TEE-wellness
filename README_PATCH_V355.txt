PATCH V355 — Restauration « Notre journée ensemble »

J’ai comparé la version actuelle 331(1) avec la version 316.

Cause retrouvée :
la version actuelle masque complètement le bloc d’accueil lorsqu’aucun rendez-vous
n’est marqué show_on_home. La version 316 conservait toujours le bloc et complétait
les 4 emplacements avec les moments de journée de secours.

Le patch :
- remet « Les rendez-vous du jour / Notre journée ensemble » sur l’accueil ;
- conserve les vrais rendez-vous configurés lorsqu’ils existent ;
- complète jusqu’à 4 cartes comme dans la version précédente ;
- restaure les petites actions de secours si aucune action n’est configurée ;
- conserve les nouvelles améliorations de la 331 (connexion profil/Carnet,
  cache du résumé collectif, événements de mise à jour, etc.) ;
- met à jour le cache-busting du script.

Fichiers à uploader :
- index.html
- scripts/community-journey.js
- www/index.html
- www/scripts/community-journey.js
