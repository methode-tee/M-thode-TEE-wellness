PATCH V254 — STABILITÉ ET CORRECTIONS REGROUPÉES

Corrigé
- Toutes les lectures protocol_progress du moteur premium récupèrent de nouveau la ligne complète avec select('*').
- Racine et www synchronisés pour v18-premium.js et style.css.
- Extrait personnalisé du feed : le bouton Lire la suite reste disponible.
- Les marqueurs [[EXTRAIT:...]] sont retirés des capsules et signaux.
- Les actions + Eau / Mood calme / Gratitude n'affichent plus un faux succès en cas d'erreur.
- Trackers : état initial Non renseigné, sauvegarde automatique explicite, libellés bas/haut compatibles avec le format Nom|min|max|bas|haut.
- Bouton Contenu suivant dans la fiche immersive, sans rechargement complet après validation.
- Le contenu terminé reste affiché et la progression se rafraîchit en arrière-plan.
- Copies root/www cohérentes pour Guide terrain, Plan du parcours et photo_progression.

Performance
- Aucun nouveau chargement au démarrage.
- Aucun timer, observer ou boucle permanente ajouté.
- Aucune photo chargée automatiquement.
- Le contenu suivant réutilise la liste déjà chargée du protocole.

Non modifié
- StoreKit 2, Stripe, Product IDs, restauration Apple.
- Fonctions Supabase serveur et schémas de tables.
- Accès payants, achats, droits et recettes liées aux protocoles.
- Déverrouillage quotidien à 7 h.

Volontairement non simulé
- Récompenses réelles : aucun contenu/coupon/protocole cible n'est configuré dans la base. Le patch ne crée pas de faux déblocage.
- Synchronisation cloud des trackers : aucune table/API officielle dédiée n'est fournie. Le stockage local existant est conservé afin de ne pas toucher à l'architecture Supabase.
- Multi-photos et mensurations structurées : chantier séparé nécessitant un modèle admin et local validé.
