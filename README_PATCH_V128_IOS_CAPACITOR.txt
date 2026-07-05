PATCH V128 — iOS Capacitor safe-area + scroll + navbar

Fichiers à remplacer dans le repo GitHub :
- scripts/app.js
- styles/style.css

Objectif :
- corriger le logo/header qui passe sous l'heure / Dynamic Island dans le simulateur iOS ;
- rétablir le scroll dans la WebView Capacitor ;
- rendre la navbar visible au-dessus de la safe-area du bas ;
- ne rien modifier côté Stripe, Supabase, déblocage, contenus ou logique d'achat.

Après upload GitHub :
1. Sur le Mac, dans le dossier du projet :
   cd ~/Desktop/M-thode-TEE-wellness
2. Récupérer les derniers fichiers GitHub si besoin.
3. Lancer :
   npx cap sync ios
4. Dans Xcode : Product > Clean Build Folder, puis Run.

Important :
Ce patch détecte Capacitor iOS et n'applique les corrections natives qu'avec la classe CSS mt-capacitor-ios.
Le rendu web GitHub Pages / Safari reste protégé.
