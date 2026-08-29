# V429 — App Store HealthKit + diagnostic push

Correctif ciblé basé sur le ZIP 384(2). Aucun autre comportement de l'app n'est modifié.

## 1. Diagnostic notifications
Les deux erreurs SQL visibles venaient du même point : `native_push_tokens` ne possède pas de colonne `disabled_at`. Son état est stocké dans `enabled boolean`.

Le fichier `supabase/V429_DIAGNOSTIC_NOTIFICATIONS.sql` contient les requêtes correctes. Il est en lecture seule et ne modifie aucune donnée.

## 2. Upload App Store / HealthKit
Apple rejetait l'archive à la validation car `NSHealthUpdateUsageDescription` manquait dans `ios/App/App/Info.plist` alors que le binaire référence des API HealthKit pouvant déclencher cette exigence statique.

La clé a été ajoutée. Le texte reste cohérent avec le fonctionnement de Méthode Tee : l'app ne crée ni ne modifie de données Apple Santé et utilise HealthKit pour synchroniser les repères autorisés par l'utilisateur.

## Après upload Git
```bash
cd ~/methode-tee-capacitor
git status
git pull origin main
npx cap sync ios
npx cap open ios
```

Dans Xcode : Product > Archive, puis refaire la distribution.

Aucun SQL de migration n'est nécessaire pour V429. Le fichier SQL fourni est uniquement un diagnostic.
