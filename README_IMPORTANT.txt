MÉTHODE TEE — PATCH CONSOLIDÉ IAP + REPRISE DES TRANSACTIONS
BASE VISUELLE PROTÉGÉE : ZIP sain avec rendu premium des protocoles.

OBJECTIF
- Réintégrer les modifications Apple IAP pertinentes des patchs V235 et V236.
- Conserver strictement tout le rendu premium existant de l’application.
- Aucun fichier CSS n’est inclus ni modifié.
- Aucun fichier HTML de protocole, aucune police et aucun style global ne sont touchés.

FICHIERS À REMPLACER / AJOUTER SUR GITHUB
1. scripts/app.js
2. www/scripts/app.js
3. ios/App/App/InAppPurchasePlugin.swift   (nouveau fichier)
4. ios/App/App/Info.plist
5. ios/App/App.xcodeproj/project.pbxproj
6. www/checkout.html
7. www/checkout-return.html

FICHIER À SUPPRIMER SUR GITHUB
- ios/App/App/ExternalPurchaseLinkPlugin.swift

IMPORTANT
Ne remplace surtout PAS :
- style.css
- styles/style.css
- www/styles/style.css
- protocol-journey.html
- styles/journey.css
- scripts/protocol-journey.js

Ces fichiers restent ceux du ZIP sain afin de protéger le rendu premium.

CE PATCH CONSERVE / AJOUTE
- Apple In-App Purchase uniquement dans l’app iOS.
- Suppression du Custom External Purchase Link du build iOS.
- Paiement Stripe conservé sur le site web racine.
- Validation Supabase avant de terminer une transaction Apple.
- Transaction.unfinished au lancement.
- Transaction.updates pendant l’utilisation.
- File locale persistante des transactions non terminées.
- Nouvelle tentative après reconnexion ou retour du réseau.
- finish() uniquement après confirmation validation.unlocked === true.
- Restauration des achats Apple sécurisée.

APRÈS L’UPLOAD GITHUB
Sur le Mac :
cd ~/Desktop/M-thode-TEE-wellness
git pull --rebase origin main
npx cap sync ios
npx cap open ios

Dans Xcode :
- Target App > Signing & Capabilities : vérifier « In-App Purchase ».
- Vérifier que « StoreKit External Purchase Link » n’est plus présent.
- Product > Clean Build Folder.
- Tester sur l’iPhone avec un compte Sandbox Apple avant l’archive.
