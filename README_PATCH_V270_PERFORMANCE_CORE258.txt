PATCH V270 — PERFORMANCE CATALOGUES SUR SOCLE 258

À envoyer en conservant exactement l'arborescence :
- page.html
- protocols.html
- scripts/app.js
- scripts/v18-premium-core258.js
- www/page.html
- www/protocols.html
- www/scripts/app.js
- www/scripts/v18-premium-core258.js

Ce patch :
1. remet le moteur v18 de la version 258 uniquement sur Recettes et Pharmacopée/Objectifs ;
2. conserve le moteur complet 270 sur l'accueil, la bibliothèque, le dashboard et les parcours où les nouveautés sont utiles ;
3. supprime l'attente bloquante du décodage des images dans la grille des protocoles ;
4. force de nouvelles URLs de cache pour Safari avec v270-performance-core258 ;
5. ne touche à aucun fichier iOS, StoreKit, Stripe, Supabase Auth, achat, accès ou notification.
