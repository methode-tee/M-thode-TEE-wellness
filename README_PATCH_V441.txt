PATCH V441 — REPÈRES PERSONNELS ÉVOLUTIFS
Méthode Tee — basé sur M-thode-TEE-wellness-main 396(1)

ORDRE D’INSTALLATION
1. Ouvrir Supabase > SQL Editor.
2. Exécuter intégralement : supabase/V441_REPERES_PERSONNELS_EVOLUTIFS.sql
3. Copier ensuite les fichiers du patch dans le projet en conservant exactement l’arborescence.
4. Reconstruire / resynchroniser l’app comme d’habitude.

IMPORTANT
- Le SQL n’a PAS été exécuté sur la base Supabase de production depuis cet environnement.
- Les contrôles JavaScript et la parité racine/www ont été effectués avant packaging.
- Ne pas supprimer les fichiers non présents dans ce patch : seuls les fichiers modifiés/nouveaux sont fournis.

CE QUE V441 AJOUTE
- Couche transversale de repères personnels évolutifs.
- Résumé alimentaire conservé compact ; interprétation éditoriale discrète et détails dans un sheet.
- Profil : date de naissance + taille pour l’estimation initiale, avec réutilisation des données déjà connues ailleurs.
- Repères énergie / protéines / fibres avec statut en construction, évolutif ou établi.
- Ajustement progressif selon plusieurs semaines comparables, jamais sur une seule journée.
- Connexions avec stress, sommeil, digestion, satiété, faim/appétit, marche/pas, récupération, hydratation, cycle/symptômes, évolution corporelle, micronutrition et alimentation.
- Adapter mon repas reçoit un contexte personnel récent et borné.
- Mes tendances : 28 jours fins et transversaux.
- Mes tendances : 3 mois via agrégats mensuels, sans téléchargement de l’historique journalier brut.
- Protocoles : lecture Avant / Pendant / Après quand les périodes existent.

PROTECTION CACHED EGRESS
- 28 jours : RPC compacte, maximum 28 faits quotidiens agrégés.
- 3 mois : agrégats mensuels uniquement.
- Aucun polling ni Realtime supplémentaire.
- Cache client des RPC pendant 5 minutes.
- Bootstrap serveur de l’historique borné et temporisé.
- Les tendances transversales n’ont PLUS de fallback qui télécharge l’historique brut des user_tracker_entries.
- Le lien temporel repas -> reflux est pré-calculé côté Supabase dans le fait quotidien ; aucune seconde lecture food_meals n’est faite par Mes tendances.
- L’absence d’une donnée reste une absence : elle n’est jamais transformée en zéro.

COMPORTEMENT DE SECOURS
Si V441 SQL n’est pas encore installé, les fonctionnalités existantes restent utilisables ; la couche de repères/tendances compactes peut simplement ne rien afficher. Elle ne déclenche pas de téléchargement massif de l’historique brut pour compenser.

SÉCURITÉ / INTERPRÉTATION
- Les RPC publiques sont limitées à l’utilisateur authentifié et s’auto-scopent sur auth.uid().
- Les associations sont présentées comme des associations, jamais comme des causalités.
- Les données HealthKit brutes restent locales ; seules les valeurs déjà explicitement enregistrées dans Méthode Tee peuvent alimenter l’agrégation serveur.
