MÉTHODE TEE — V14.2 ADMIN SÉCURISÉ SUPABASE

Correction :
- ADMIN_ACCESS_CODE supprimé de config.js
- plus de code admin dans le front
- admin.html ne demande plus de mot de passe/code
- l’accès admin repose sur :
  1. connexion Supabase
  2. email autorisé dans ADMIN_EMAILS
  3. fonction SQL public.is_admin()
  4. policies RLS Supabase

À faire après upload :
1. Upload tout le ZIP sur GitHub.
2. Supabase > SQL Editor > exécuter :
   supabase/SUPABASE_SQL_V14_2_SECURE_ADMIN.sql
3. Ouvrir /admin.html
4. Te connecter avec l’email admin : teayannaparis@gmail.com
5. Cliquer “Entrer dans le studio admin”

Important :
Sur GitHub Pages, il n’y a pas de backend privé.
La vraie sécurité vient donc de Supabase Auth + RLS.
