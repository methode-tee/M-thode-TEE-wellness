# V235 — iOS Apple IAP uniquement

Ce patch retire du build iOS :
- `SKExternalPurchaseCustomLinkRegions` ;
- le parcours External Purchase / Safari / Stripe dans la WebView ;
- les appels aux fonctions Supabase external depuis l’application ;
- les feuilles et styles d’achat externe ;
- les pages de checkout Stripe du bundle Capacitor.

Le paiement Stripe reste intact pour le site web (fichiers racine).
Le natif iOS utilise uniquement StoreKit 2 via `InAppPurchasePlugin.swift`.

Après mise à jour GitHub :
```bash
cd ~/Desktop/M-thode-TEE-wellness
git pull --rebase origin main
npx cap sync ios
npx cap open ios
```

Dans Xcode : vérifier `In-App Purchase`, `StoreKit Configuration = None`, puis Clean Build Folder et Archive.
