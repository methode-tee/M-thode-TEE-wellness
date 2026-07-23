PATCH BLOC 1 — MÉTHODE TEE V244

Fichiers à uploader en conservant exactement les dossiers :
- scripts/app.js
- scripts/admin.js
- scripts/v18-premium.js
- styles/style.css
- admin.html
- library.html
- www/scripts/app.js
- www/scripts/admin.js
- www/scripts/v18-premium.js
- www/styles/style.css
- www/admin.html
- www/library.html

Modifications :
- filtres Recettes en français + filtre Bowls ;
- correction Disponiblee / disponiblees ;
- suppression des ombres grises des filtres Recettes, Pharmacopée et Objectifs ;
- feed structuré : intertitres, listes, espacements, contraste et encadré Anecdote méconnue ;
- champ Extrait du feed dans l’admin, sans migration Supabase (stocké dans le contenu avec un marqueur invisible dans l’app) ;
- textes et haut de Bibliothèque légèrement compactés ;
- Routines favorites renommé Tes routines ;
- Profil mieux hiérarchisé et légèrement compacté ;
- états visuels persistants pour + Eau, Mood calme et Note gratitude.

Strictement inchangé :
- StoreKit 2, Stripe, Product IDs, achats, restaurations, accès, déblocages ;
- logique Supabase des droits ;
- accès des recettes dans les protocoles ;
- progression et verrouillage des jours.
