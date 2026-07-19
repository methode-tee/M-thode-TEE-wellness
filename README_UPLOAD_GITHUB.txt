PATCH V236 — TRANSACTIONS APPLE INACHEVÉES

Ce ZIP est construit directement à partir de « M-thode-TEE-wellness-main 233.zip ».

Sur GitHub, remplace uniquement ces trois fichiers en conservant exactement leurs chemins :

1. ios/App/App/InAppPurchasePlugin.swift
2. scripts/app.js
3. www/scripts/app.js

Le patch ajoute :
- Transaction.unfinished au lancement ;
- Transaction.updates pendant l’utilisation ;
- une file locale persistante ;
- une nouvelle tentative après reconnexion ;
- finish() uniquement après validation.unlocked === true.

Après le commit GitHub, sur le Mac :

cd ~/Desktop/M-thode-TEE-wellness
git status

Si « working tree clean » :

git pull --rebase origin main
npx cap sync ios
npx cap open ios

Tester sur l’iPhone avant d’archiver le build 21.
