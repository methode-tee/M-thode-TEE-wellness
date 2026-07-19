MÉTHODE TEE — PATCH V241 TOUT-EN-UN SUR BASE SAINE

BASE OBLIGATOIRE
Ce patch s'applique uniquement après restauration du ZIP sain :
M-thode-TEE-wellness-b75c8ffc06372d1ad736394ee4c0704c22da41b3.zip

CONTENU
- Apple In-App Purchase StoreKit 2 uniquement dans l'app iOS.
- Validation serveur Supabase avec tentative Sandbox puis Production.
- Déblocage automatique : status=active et unlocked=true.
- Reprise des transactions Apple inachevées, file locale et restauration sécurisée.
- Suppression du flash « Restaurer mes achats Apple » sur Safari/PWA.
- Suivi Sommeil / repos et centrage desktop du parcours.
- Stripe web racine conservé.
- Checkout Stripe neutralisé uniquement dans le bundle www de l'app iOS.
- Aucun dossier de patch imbriqué, aucun www_build incomplet, aucun fichier poubelle.

À SUPPRIMER MANUELLEMENT DANS GITHUB
- ios/App/App/ExternalPurchaseLinkPlugin.swift

NE PAS SUPPRIMER
- ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/IDEWorkspaceChecks.plist
- ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme

INSTALLATION
1. Décompresser ce ZIP.
2. Copier son contenu à la racine du dépôt GitHub en conservant les chemins.
3. Supprimer uniquement ios/App/App/ExternalPurchaseLinkPlugin.swift.
4. Commit : "V241 Apple IAP recovery on stable premium base"
5. Push origin.

SUPABASE
1. Exécuter une seule fois supabase/V237_IAP_ACCESS_UNLOCK_FIX.sql si ce correctif n'a pas déjà été exécuté.
2. Exécuter une seule fois supabase/V238_sleep_tracking.sql si absent.
3. Déployer supabase/functions/validate-apple-iap/index.ts.
4. Conserver les secrets APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID, APPLE_IAP_PRIVATE_KEY et APPLE_BUNDLE_ID.

MAC / XCODE
cd ~/Desktop/M-thode-TEE-wellness
git pull --rebase origin main
npx cap sync ios
npx cap open ios

Dans Xcode :
- vérifier la capability In-App Purchase ;
- vérifier l'absence de StoreKit External Purchase Link ;
- StoreKit Configuration = None pour le test Sandbox réel ;
- Product > Clean Build Folder ;
- tester achat, restauration et relance avant Archive.
