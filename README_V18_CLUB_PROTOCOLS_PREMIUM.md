# MÉTHODE TEE — V18 CLUB + PROTOCOLES PREMIUM

Base utilisée : V17b stable.

Conservé intact :
- navbar validée
- topbar validée
- structure visuelle V17b
- déblocage automatique après paiement via `user_protocols`

Ajouté :
- accès Club 5€ : rituel du jour, streak global, mood/eau/gratitude, mini contenus, aperçu premium
- bibliothèque enrichie : contenus Club + contenus protocoles débloqués
- protocoles premium : progression jour X/Y, streak, XP, niveau, timeline, bouton “Valider aujourd’hui”
- viewer immersif iOS : PDF, document, ebook, guide plantes, vidéo, audio, recette, routine, checklist, tracker, tableau, calendrier, playlist, suivi, photo, document privé
- admin enrichi : nouveaux types de contenu, jour du protocole, accès club/protocole, texte/checklist, audio, miniature, XP, aperçu
- SQL : `SUPABASE_SQL_V18_CLUB_PROTOCOLS_PREMIUM.sql`

À faire après upload :
1. Remplacer les fichiers du zip dans GitHub.
2. Exécuter `supabase/SUPABASE_SQL_V18_CLUB_PROTOCOLS_PREMIUM.sql` dans Supabase SQL Editor.
3. Ne pas modifier la navbar.
