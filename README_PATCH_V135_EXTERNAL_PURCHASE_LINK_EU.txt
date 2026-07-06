PATCH V135 — External Purchase Link UE

Fichiers modifiés :
- scripts/app.js
- www/scripts/app.js
- style.css
- styles/style.css
- www/styles/style.css
- config.js / www/config.js si présents

Objet :
- Conserver Stripe intact.
- Ajouter une couche d'information avant l'ouverture du checkout externe sur iOS natif.
- Laisser le web/PWA continuer à ouvrir Stripe normalement.

Important App Store UE :
Ce patch ne remplace pas l'activation officielle de l'entitlement Apple. Avant soumission, le compte développeur doit activer l'External Purchase Link Entitlement UE dans App Store Connect / Apple Developer, utiliser les APIs StoreKit requises côté natif si Apple les exige pour l'app, et prévoir le reporting des transactions externes via l'External Purchase Server API.

Workflow :
1. Upload/remplacer les fichiers sur GitHub.
2. Commit changes.
3. Sur Mac : git pull origin main
4. npx cap sync ios
5. Xcode > Product > Clean Build Folder > Run
