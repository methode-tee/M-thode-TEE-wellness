PATCH V236 — REPRISE AUTOMATIQUE DES TRANSACTIONS APPLE INACHEVÉES

Ce patch modifie uniquement :
- ios/App/App/InAppPurchasePlugin.swift
- scripts/app.js

UTILISATION

1. Décompresse ce ZIP.
2. Place apply_v236_unfinished_iap.py dans :
   ~/Desktop/M-thode-TEE-wellness

3. Dans Terminal :

cd ~/Desktop/M-thode-TEE-wellness
python3 apply_v236_unfinished_iap.py

4. Reconstruis www avec la commande rsync déjà validée.
5. Lance :
   npx cap sync ios
   npx cap open ios

Le patch ajoute :
- Transaction.unfinished au lancement ;
- Transaction.updates pendant l’utilisation ;
- une file locale persistante ;
- une nouvelle tentative après reconnexion ;
- validate-apple-iap avant transaction.finish().
