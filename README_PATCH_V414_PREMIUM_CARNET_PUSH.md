# PATCH V414 — Carnet premium + clavier iOS + vraies notifications push

Base : ZIP utilisateur `M-thode-TEE-wellness-main 371(1).zip`.
Version app : 1.0.4 — build iOS 38.

## 1. Boissons de la journée
- Suppression du petit bouton latéral `+ Ajouter une boisson`.
- Nouveau CTA pleine largeur `+ Ajouter`, aligné visuellement sur les cartes repas.

## 2. Clavier iPhone / Safari / WKWebView
- Correction du flash avec grand espace vide à la fermeture du clavier.
- La page conserve l'ancre visuelle du champ pendant l'animation iOS.
- La navbar reste masquée pendant la transition et revient seulement après stabilisation réelle du viewport.
- Le scroll est recalé dans la même frame pour supprimer le rendu intermédiaire non premium.
- Le correctif est partagé par les pages Carnet avec saisie texte.

## 3. Notifications : vrai push natif iOS
Le bouton Notifications de l'app native n'active plus seulement un rappel local quotidien :
- ajout de `@capacitor/push-notifications` ;
- inscription APNs réelle ;
- token iPhone relié au compte Supabase ;
- ouverture de la bonne route lors d'un tap sur une notification ;
- les publications admin et rappels de protocoles sont envoyés à la fois aux abonnés Web Push et aux appareils iOS natifs ;
- les rappels locaux éditoriaux existants restent compatibles.

### Installation native
Après application du patch :
```bash
npm install
npx cap sync ios
```

### Supabase — une seule fois
Exécuter :
`supabase/V414_NATIVE_PUSH_PREMIUM.sql`

Puis déployer :
```bash
supabase functions deploy send-push-notifications
supabase functions deploy send-protocol-reminders
```

### Secrets APNs — une seule fois
Créer une clé Apple Push Notification service (.p8) dans Apple Developer, puis configurer les secrets Supabase :
- `APNS_KEY_ID`
- `APNS_TEAM_ID`
- `APNS_PRIVATE_KEY` (contenu complet du .p8)
- `APNS_BUNDLE_ID=com.methodetee.app`
- `APNS_ENV=production`

Le patch ajoute les entitlements `aps-environment`, la capability Xcode et les callbacks AppDelegate requis par Capacitor 8.

## Vérifications effectuées
- syntaxe JS : OK (`food-core`, `pwa-push`, `app`, `protocol-journey`, `food-day`)
- JSON : OK (`package.json`, `capacitor.config.json`)
- entitlements plist : OK
- copies racine / `www` synchronisées pour les fichiers concernés
- build Xcode Debug + Release : 38
