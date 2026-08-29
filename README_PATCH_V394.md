# Patch V394 — ordre d’installation

## 1. GitHub

Téléverser tous les fichiers du patch en conservant exactement leurs chemins.

## 2. Supabase SQL Editor

Exécuter `supabase/V394_SECURITE_PUSH_NUTRITION_VERIFIEE.sql`.

## 3. Secret interne des notifications

Créer une valeur aléatoire dans le Terminal :

```bash
openssl rand -hex 32
```

Copier cette valeur, puis configurer le secret de l’Edge Function :

```bash
npx supabase secrets set MT_PUSH_INTERNAL_SECRET="COLLE_ICI_LA_VALEUR" --project-ref tyuvlmmmyygqqhuetwoe
```

Dans Supabase SQL Editor, conserver la même valeur dans Vault :

```sql
select vault.create_secret(
  'COLLE_ICI_LA_MEME_VALEUR',
  'mt_push_internal_secret',
  'Secret interne des notifications Méthode Tee'
);
```

Si ce nom existe déjà, le supprimer dans **Project Settings → Vault**, puis recréer le secret avec la nouvelle valeur.

## 4. Redéployer les deux fonctions sécurisées

```bash
npx supabase functions deploy send-push-notifications --project-ref tyuvlmmmyygqqhuetwoe --no-verify-jwt
npx supabase functions deploy send-protocol-reminders --project-ref tyuvlmmmyygqqhuetwoe --no-verify-jwt
```

## 5. iOS

Après le téléversement GitHub :

```bash
npx cap sync ios
open ios/App/App.xcworkspace
```

Le changement HealthKit et le nouveau texte caméra nécessitent une nouvelle compilation iOS.

## Contrôles rapides

- Carnet → **Mes suivis** : « Mes tendances » apparaît avant « + Ajouter un suivi ».
- Scanner : un produit sans fibres n’est plus rejeté ; « fibres non renseignées » est affiché.
- Scanner : si l’emballage fournit une portion, l’app propose cette portion ou la base 100 g / 100 ml.
- Cycle : un flux Apple Santé continu n’ajoute qu’un seul premier jour et corrige automatiquement le calendrier dès sa lecture.
- Push manuel : une session administratrice est désormais obligatoire.
- Studio alimentaire : une nutrition personnalisée non vérifiée ne participe plus aux calculs.
