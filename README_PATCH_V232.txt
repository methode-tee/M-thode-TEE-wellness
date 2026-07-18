MÉTHODE TEE — PATCH V232

Objectif
- Corriger le rejet Apple Guideline 3.1.1 avec ExternalPurchaseCustomLink.
- Vérifier ExternalPurchaseCustomLink.isEligible.
- Afficher la feuille Apple avec showNotice(type: .withinApp).
- Ouvrir Stripe dans une WKWebView intégrée autorisée par les conditions UE actuelles.
- Authentifier automatiquement la page web grâce au jeton opaque de 30 minutes déjà créé par l'app.
- Demander les jetons Apple ACQUISITION et SERVICES et les stocker côté Supabase pour le reporting futur.

Fichiers
- ios/App/App/ExternalPurchaseLinkPlugin.swift
- ios/App/App/Info.plist
- ios/App/App/App.entitlements
- ios/App/App/AppRelease.entitlements
- scripts/app.js
- www/scripts/app.js
- checkout.html
- www/checkout.html
- supabase/functions/resolve-external-purchase-intent/index.ts
- supabase/functions/store-external-purchase-tokens/index.ts
- supabase/V232_apple_external_purchase_tokens.sql

Installation
1. Copier les fichiers en conservant exactement les dossiers.
2. Exécuter le SQL supabase/V232_apple_external_purchase_tokens.sql dans Supabase SQL Editor.
3. Déployer :
   npx supabase functions deploy resolve-external-purchase-intent --no-verify-jwt
   npx supabase functions deploy store-external-purchase-tokens
4. Puis :
   npx cap sync ios
   npx cap open ios
5. Dans Xcode, définir Minimum Deployment sur iOS 18.1 pour ce build utilisant l'API Custom Link.
6. Product > Clean Build Folder, augmenter le numéro de build, compiler et tester sur TestFlight.

Parcours attendu
Débloquer > contrôle isEligible > feuille officielle Apple > Continuer > checkout Stripe dans l'app, sans reconnexion > paiement > retour methodetee:// > contenu débloqué.

Important — reporting Apple
Ce patch collecte et conserve les jetons ACQUISITION et SERVICES. Il ne transmet pas encore les rapports à l'External Purchase Server API, car cette dernière étape nécessite les identifiants privés Apple (Issuer ID, Key ID et clé .p8) et l'intégration des événements Stripe paiement/remboursement. Ne jamais placer la clé .p8 dans l'app ou dans GitHub.
