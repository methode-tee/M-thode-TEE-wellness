PATCH V319 — CALENDRIER « MON PARCOURS » : DÉTAIL DU JOUR

Correction ciblée :
- corrige le chargement infini après un appui sur un jour comportant des pastilles ;
- supprime une référence JavaScript invalide à `year` et `month` dans fetchDayDetail();
- ajoute un repli sûr : une erreur réseau ne laisse plus la fenêtre bloquée sur « Chargement… ».

Fichiers modifiés uniquement :
- scripts/journal.js
- www/scripts/journal.js

Aucun changement :
- mise en page iPhone/iPad/desktop ;
- performances au démarrage ;
- paiements et achats ;
- Supabase / SQL ;
- version 1.0.1.
