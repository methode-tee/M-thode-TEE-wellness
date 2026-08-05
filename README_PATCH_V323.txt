PATCH V323 — Journal toujours ouvert en haut sur iPhone

Corrige le cas où iOS/WKWebView rouvrait le journal à une ancienne position de défilement, ce qui coupait le haut du formulaire.

Le patch :
- conserve les améliorations V322 ;
- force le journal à revenir en haut après plusieurs cycles de rendu iOS ;
- neutralise la restauration automatique du scroll ;
- garde le défilement vertical du journal ;
- ne modifie ni Supabase, ni les achats, ni les protocoles, ni la version iOS.

Fichiers remplacés :
- scripts/journal.js
- www/scripts/journal.js
- styles/style.css
- www/styles/style.css
