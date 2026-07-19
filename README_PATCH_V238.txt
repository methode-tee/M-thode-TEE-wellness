MÉTHODE TEE — PATCH V238
Desktop centré + suivi quotidien Sommeil / repos

BASE UTILISÉE
- M-thode-TEE-wellness-main 237.zip
- Aucun HTML du protocole ni scripts/protocol-journey.js n'a été remplacé.
- Le rendu premium mobile reste inchangé.

MODIFICATIONS
1. Desktop uniquement :
   - le haut du parcours immersif est centré ;
   - la section « Arc narratif / Tes étapes clés » est recentrée.
2. Nouveau suivi « Sommeil / repos » :
   - objectif visuel 7 h ;
   - saisie numérique de 0 à 24 h par pas de 0,25 h ;
   - conservation pour la date en cours ;
   - remise naturelle à 0 le lendemain grâce à la clé quotidienne ;
   - synchronisation Supabase ;
   - affichage dans « Mes suivis », « Mon parcours aujourd'hui » et la carte « Mon parcours » ;
   - symbole visible dans le calendrier et détail du jour.
3. Le sommeil n'est PAS ajouté dans « Mes missions du jour ».

ORDRE
1. Supabase > SQL Editor : exécuter supabase/V238_sleep_tracking.sql une seule fois.
2. Uploader les fichiers du ZIP en conservant exactement les chemins.
3. Pour l'app iOS, exécuter ensuite npx cap sync ios avant de reconstruire dans Xcode.

FICHIERS À UPLOAD
- scripts/app.js
- scripts/journal.js
- styles/style.css
- styles/journey.css
- www/scripts/app.js
- www/scripts/journal.js
- www/styles/style.css
- www/styles/journey.css

FICHIER SQL À EXÉCUTER, PAS À UTILISER COMME FICHIER D'INTERFACE
- supabase/V238_sleep_tracking.sql
