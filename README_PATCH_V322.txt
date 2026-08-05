MÉTHODE TEE — PATCH V322

Corrige :
1. Le journal privé sur iPhone : la fiche est désormais scrollable, revient toujours en haut à l'ouverture et n'est plus coupée.
2. Le détail d'une journée : toutes les activités existantes restent affichées et les futurs champs « has_* » sont repris automatiquement.
3. Les trackers : affichage du nom du tracker, du protocole associé et d'un résumé de ses valeurs lorsque les données sont disponibles.
4. L'hydratation à 2 L ne crée plus artificiellement une activité « Tracker ».

Fichiers remplacés :
- scripts/journal.js
- www/scripts/journal.js
- styles/style.css
- www/styles/style.css

Aucune modification :
- achats / IAP
- Supabase SQL
- protocol_progress
- version iOS
- performances au démarrage
