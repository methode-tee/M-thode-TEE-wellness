MÉTHODE TEE — V13 ADMIN + DÉBLOCAGE + BIBLIOTHÈQUE

Cette version garde le visuel de la V12 et ajoute seulement les fonctions demandées :

1. Paiement Stripe Payment Links
- Tu gardes les liens Stripe par protocole.
- Le déblocage reste manuel, depuis l’admin.

2. Déblocage client dans admin.html
- email client
- protocole acheté
- bouton Débloquer
- accès général à 5€ aussi disponible

3. Bibliothèque propre
- nouvelle page library.html
- catégories : PDF, vidéos, recettes, routines, trackers, calendriers, checklists, playlists
- affiche les contenus des protocoles débloqués

4. Gestion/modification
- modifier post existant
- modifier protocole existant
- modifier contenu/fichier existant
- masquer / afficher / supprimer

5. Upload fichiers
- buckets Supabase :
  post-media
  protocol-media
  protocol-files
- accepte images, vidéos, PDF et fichiers documentaires

À faire :
1. Upload tout le ZIP sur GitHub à la racine.
2. Supabase > SQL Editor > exécute :
   supabase/SUPABASE_SQL_V13_ADMIN_UNLOCK_LIBRARY.sql
3. Va sur /admin.html
4. Connecte-toi avec l’email admin + code OUTITA.
