MÉTHODE TEE — PATCH V225 SECURE EXTERNAL PURCHASE HAND-OFF

But:
- conserver la feuille officielle StoreKit ;
- transmettre le protocole/recette choisi de la WebView Capacitor vers Safari ;
- ne plus dépendre du localStorage ou de la session navigateur ;
- ouvrir directement le bon checkout Stripe après la feuille Apple.

Fichiers modifiés/ajoutés:
- ios/App/App/ExternalPurchaseLinkPlugin.swift
- scripts/app.js
- www/scripts/app.js
- checkout.html
- www/checkout.html
- supabase/functions/create-external-purchase-intent/index.ts
- supabase/functions/resolve-external-purchase-intent/index.ts
- supabase/V225_external_purchase_intent_tokens.sql

Déploiement requis:
1. Exécuter le SQL V225 dans Supabase.
2. Déployer les deux Edge Functions:
   supabase functions deploy create-external-purchase-intent
   supabase functions deploy resolve-external-purchase-intent --no-verify-jwt
3. Commit/push, puis npx cap sync ios.
4. Augmenter le build Xcode, Archive, TestFlight.

Sécurité:
- le lien contient un jeton aléatoire à usage unique, valable 30 minutes ;
- seul son hash est stocké en base ;
- le jeton est invalidé dès la création de la session Stripe.
