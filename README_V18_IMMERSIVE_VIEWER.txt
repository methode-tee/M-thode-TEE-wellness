MÉTHODE TEE — V18 : VIEWER IMMERSIF + PROGRESSION
===================================================

FICHIERS MODIFIÉS :
- scripts/app.js        → viewer immersif + progress bar
- styles/style.css      → styles viewer, cards immersives, progress
- admin.html            → champ total_days + nouveaux types de contenu
- scripts/admin.js      → save total_days sur les protocoles

FICHIER SQL À EXÉCUTER :
→ supabase/SUPABASE_SQL_V18_PROGRESS_VIEWER.sql

NOUVELLES FONCTIONNALITÉS :

1. VIEWER IMMERSIF
   Chaque contenu s'ouvre dans un bottom sheet premium selon son type :
   - PDF      → iframe lecteur intégré + bouton télécharger
   - Audio    → player avec cover + titre
   - Vidéo    → YouTube / Vimeo embed ou lecteur natif
   - Recette  → lecture plein écran avec ingrédients + étapes
   - Checklist → items cochables avec progression sauvegardée
   - Routine  → étapes listées + téléchargement
   - Tracker / Tableau / Suivi → lien d'ouverture
   - Calendrier → lien d'ouverture
   - Playlist → lien Spotify/Apple Music
   - Ebook / Guide plantes → PDF ou lien

2. NOUVEAUX TYPES DE CONTENU DANS L'ADMIN :
   📄 PDF / Document, 📖 Ebook, 🌿 Guide plantes, 🎥 Vidéo,
   🎧 Audio, 🥣 Recette, 🌙 Routine, ✅ Checklist,
   📊 Tracker, 📊 Tableau, 🗓️ Calendrier, 🎧 Playlist, 📈 Suivi

3. PROGRESSION JOUR X/Y
   - Champ "Nombre de jours" sur chaque protocole dans l'admin
   - La cliente voit : Jour 8 / 21 + barre de progression
   - Bouton "Valider aujourd'hui" = check-in quotidien
   - Streak automatique (jours consécutifs)
   - Sauvegardé dans la table protocol_progress (Supabase)

POUR ACTIVER LA PROGRESSION :
   1. Exécuter le SQL V18 dans Supabase
   2. Modifier un protocole dans l'admin → renseigner "Nombre de jours"
   3. La barre apparaît automatiquement dans l'espace protocole

RECETTES ET CHECKLISTS ENRICHIES :
   Pour ajouter des ingrédients/étapes à une recette ou items à une checklist,
   stocker le JSON dans le champ "payload" de protocol_contents :
   Recette : { "ingredients": ["500g patates douces", ...], "steps": ["Éplucher...", ...] }
   Checklist : { "items": ["Boire 1,5L d'eau au réveil", ...] }
