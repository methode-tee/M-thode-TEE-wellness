PATCH V258(34) — AFFICHAGE DIRECT ET STABLE

Base obligatoire : M-thode-TEE-wellness-main 258(34).zip

Fichiers à uploader en conservant exactement les chemins :
- protocols.html
- page.html
- scripts/app.js
- www/protocols.html
- www/page.html
- www/scripts/app.js

Modifications strictement limitées à Pharmacopée, Objectifs et Recettes :
- filtres et grilles présents dès le HTML initial ;
- suppression de l'attente bloquante des premières images avant affichage ;
- suppression du cache HTML complet de ces marketplaces ;
- chargement parallèle des protocoles et des accès ;
- chargement parallèle des deux recherches d'accès ;
- suppression de la double vérification de session sur Recettes ;
- cartes insérées une seule fois, images chargées naturellement.

Non modifié : CSS, service worker, Stripe, Supabase, admin, paiements, déblocages, navigation, protocoles internes.
