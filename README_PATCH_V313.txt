PATCH V313 — Restaurer mes achats Apple (un seul emplacement)

Correction :
- suppression du vieux bloc statique encore présent dans dashboard.html ;
- conservation du seul bouton dynamique placé juste après « Gérer mes accès » ;
- suppression de l’énorme espace vide en bas du Profil ;
- aucun changement sur StoreKit, les achats, Supabase ou les performances.

Fichiers à remplacer :
- dashboard.html
- www/dashboard.html

Important :
Le premier délai observé sur l’écran de connexion n’est plus causé par le loader :
dans le ZIP actuel, le loader et v14-luxe.js sont déjà absents de auth.html.
Le fait que cela ne se produise qu’au tout premier lancement ressemble désormais
au démarrage à froid du clavier / WebView iOS. Aucun autre correctif risqué n’a été
ajouté dans ce patch afin de ne pas dégrader la connexion ni la fluidité.
