PATCH V357 — « Comprendre ma journée » s’ouvre dès le premier appui

Cause exacte
------------
Le Carnet calculait Mon Équilibre au chargement avec refresh(... silent:true).
Les jauges étaient donc bien affichées, mais ce mode silencieux ne publiait pas
le résultat courant dans window.__MT_TEE_BALANCE_RESULT__.

Le bouton « Comprendre ma journée » dépend de ce résultat pour ouvrir la sheet.
Au premier appui, il pouvait donc ne rien faire.

Pourquoi l’ouverture de « Notre journée ensemble » débloquait ensuite le bouton ?
La participation à la journée collective déclenche un événement de mise à jour.
Cet événement relançait Mon Équilibre en mode normal, lequel publiait alors le
résultat global. Le bouton se mettait donc à fonctionner après coup.

Correction
----------
- Le résultat courant est maintenant publié même pendant le chargement silencieux.
- Le bouton dispose aussi d’un repli sur le cache local compact déjà présent.
- Aucun passage par « Notre journée ensemble » n’est nécessaire.
- Aucune nouvelle requête Supabase n’est ajoutée.
- Aucun Realtime ajouté.
- Aucun historique supplémentaire préchargé.
- Le fonctionnement Cached Egress du V356 reste inchangé.
- Cache-busting du script tee-balance pour web + iOS.

Fichiers à uploader
-------------------
scripts/tee-balance.js
www/scripts/tee-balance.js
library.html
www/library.html
dashboard.html
www/dashboard.html

Aucun SQL à exécuter pour ce correctif.
