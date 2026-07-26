PATCH PHARMACOPÉE + OBJECTIFS — IMAGES STABLES — BASE 285(1)

Fichiers à uploader en conservant exactement les chemins :
- scripts/app.js
- www/scripts/app.js
- style.css
- www/style.css

Ce patch :
- conserve le correctif de performance Pharmacopée ;
- conserve l'affichage rapide d'Objectifs ;
- retire uniquement l'animation brillante mobile qui traversait les images des cartes verrouillées ;
- supprime donc l'effet de bandes/grésillement visible au chargement ;
- ne touche pas à l'accueil, l'admin, Stripe, Supabase ou aux données.

Aucun SQL à exécuter.
