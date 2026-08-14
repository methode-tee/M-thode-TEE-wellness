PATCH V356 — Mon Équilibre : revoir les jauges des jours précédents

OBJECTIF
- Depuis « Comprendre ma journée », ajouter « Revoir mes journées ».
- Afficher les 3 jauges d’un jour précédent : Vitalité, Équilibre intérieur, Régularité.
- Navigation par flèches entre les jours disponibles.

CACHED EGRESS / SUPABASE — CONTRAINTE RESPECTÉE
- Aucun historique préchargé au démarrage.
- Aucun Realtime.
- Aucune image, vidéo ou PDF ajouté.
- « Revoir mes journées » charge uniquement au clic.
- Le chargement réutilise buildWeekly() et les 2 lectures Supabase déjà existantes pour l’empreinte hebdomadaire.
- AUCUNE nouvelle requête de lecture historique n’est ajoutée : on ajoute seulement tee_balance_snapshot à la sélection daily_activity existante.
- Le résultat hebdomadaire/historique reste en cache local 10 minutes.
- Le score du jour est enregistré sous forme d’un JSON très compact dans daily_activity uniquement quand les jauges changent. L’écriture est dédupliquée localement.
- L’index existant daily_activity_user_date_idx (user_id, activity_date) est réutilisé.

IMPORTANT — ORDRE
1. Exécuter supabase/V356_MON_EQUILIBRE_HISTORIQUE.sql une seule fois dans Supabase > SQL Editor.
2. Uploader ensuite les fichiers du patch dans le projet.
3. Recharger / synchroniser l’app normalement.

HISTORIQUE AVANT V356
- Les journées enregistrées après V356 conserveront exactement les jauges du jour.
- Pour les jours antérieurs sans snapshot, l’app reconstruit une lecture avec les repères historiques déjà disponibles (daily_activity + journal), sans lancer de lecture supplémentaire.
- Ces jours sont explicitement indiqués comme « Lecture reconstruite ».

FICHIERS
- dashboard.html
- library.html
- scripts/tee-balance.js
- styles/style.css
- www/dashboard.html
- www/library.html
- www/scripts/tee-balance.js
- www/styles/style.css
- supabase/V356_MON_EQUILIBRE_HISTORIQUE.sql
