PATCH V239 — SUPPRESSION DU FLASH « RESTAURER MES ACHATS APPLE »

Fichiers à uploader en conservant exactement les chemins :
- index.html
- dashboard.html
- scripts/app.js
- www/index.html
- www/dashboard.html

Effet :
- le bloc Apple Restore est caché dès le premier rendu HTML ;
- il ne s’affiche plus brièvement avant le chargement du profil ;
- il reste disponible uniquement dans l’application iOS native, une fois le profil chargé ;
- il reste invisible sur Safari/desktop/PWA ;
- aucun CSS global, aucun protocole et aucun composant immersif n’a été modifié.
