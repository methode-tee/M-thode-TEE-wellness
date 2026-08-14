PATCH V360 — Mes suivis · jours précédents

Base : 335(1)

Ajout volontairement minimal :
- navigation discrète sous le grand titre du suivi ;
- ‹ Aujourd’hui · 14 août › puis, en reculant, la date du jour consulté ;
- accès à aujourd’hui + 6 jours précédents uniquement ;
- les champs affichent les valeurs réellement enregistrées pour la date choisie ;
- la même fiche peut être corrigée puis réenregistrée pour cette date ;
- aucune analyse, aucun graphique, aucune nouvelle carte ;
- aucune lecture historique au démarrage ;
- une seule lecture user_tracker_entries pour la date exacte uniquement quand la personne change de jour ;
- données locales par user_id conservées ;
- cache du lazy-loader passé en v360.

AUCUN SQL À EXÉCUTER.

Fichiers à uploader :
- scripts/custom-trackers.js
- www/scripts/custom-trackers.js
- scripts/v18-premium.js
- www/scripts/v18-premium.js
