PATCH V358 — Stabilisation finale 1.0.2

À FAIRE DANS CET ORDRE
1. Supabase > SQL Editor : exécuter V358_STABILISATION_FINALE_1_0_2.sql une seule fois.
2. Uploader les autres fichiers du patch sur GitHub en respectant les dossiers.
3. Sur le Mac : git pull origin main puis npx cap sync ios.
4. Vérifier Version 1.0.2 / Build 30 puis créer un nouvel Archive.

CORRECTIONS
- Notre journée ensemble : une journée 0/0 ne compte plus comme participation, côté app ET côté RPC Supabase.
- Mon Équilibre > Revoir mes journées : une seule lecture à la demande des 6 jours précédents, uniquement activity_date + tee_balance_snapshot. Aucun journal, aucune analyse 28 jours pour cet écran.
- Empreinte de la semaine : conserve ses analyses à la demande, mais ne charge plus les snapshots de jauges.
- Cache : même identifiant v358 pour les assets partagés sur toutes les pages qui les utilisent.
- Journal/local activity : données locales rattachées à l'utilisateur actif, avec migration unique des anciennes clés locales.
- Journaux privés de protocoles : clés locales rattachées au compte actif.
- Photos privées : IndexedDB v3, userId + clés/index de rôle rattachés au compte, liste filtrée au compte actif, migration locale unique des anciennes photos vers le compte actif.
- XP : le client n'envoie plus badge=undefined ; côté SQL niveau/libellé/badge sont dérivés des points.
- Sécurité protocoles : user_protocols devient lecture seule pour l'utilisateur ; écritures réservées admin/backend.
- Sécurité profil : un utilisateur ne peut plus s'accorder has_app_access.

CACHE / SUPABASE
- Aucun Realtime ajouté.
- Aucun historique préchargé au démarrage.
- Revoir mes journées = 1 requête compacte uniquement au clic, cache local 10 min.
- L'historique reste limité aux 6 jours précédents.

NOTE XP
Le système XP actuel reste compatible et continue de mettre à jour les points côté client.
V358 empêche les incohérences directes de niveau/libellé/badge mais ne transforme pas
l'ensemble du moteur XP en moteur serveur, ce qui serait une refonte distincte.
