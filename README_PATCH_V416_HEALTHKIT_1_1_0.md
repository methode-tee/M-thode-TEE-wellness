# MÉTHODE TEE — PATCH V416 · APPLE SANTÉ / HEALTHKIT · VERSION 1.1.0

Base : ZIP 373 / version iOS 1.0.4 build 39  
Sortie : **version iOS 1.1.0 build 40**

## Objectif
Introduire Apple Santé / HealthKit comme connexion native iPhone, en lecture seule, sans créer un nouvel univers parallèle dans l'app. HealthKit alimente les suivis existants du Carnet lorsqu'ils sont compatibles.

## Position dans Profil
Dans **Mon suivi personnel → Observer mon évolution**, une nouvelle entrée **Apple Santé** est placée après Mon Équilibre et avant Mes repères visuels.

États :
- non connectée : `Connecter →` ;
- activée : résumé des catégories autorisées + dernière lecture ;
- version web/PWA : indique que la connexion est disponible dans l'app iPhone.

## Connexion Apple Santé
Une feuille dédiée permet de choisir séparément :
- **Sommeil** : durée, horaires, réveils et stades disponibles ;
- **Activité & entraînements** : pas, distance marche/course, énergie active, entraînements ;
- **Évolution corporelle** : poids, tour de taille, masse grasse et masse maigre lorsqu'ils existent dans Apple Santé.

Option : **Préremplir automatiquement**. Elle est activée par défaut après connexion et ne complète que les champs encore vides.

### Principe de confidentialité
- intégration **lecture seule** ;
- aucune écriture dans Apple Santé ;
- aucun historique HealthKit brut envoyé automatiquement à Supabase ;
- la lecture se fait localement sur l'iPhone ;
- une valeur HealthKit ne devient une donnée du Carnet que lorsque l'utilisateur enregistre explicitement le repère ;
- désactiver Apple Santé dans Méthode Tee arrête les lectures ; les autorisations iOS restent gérées par Apple Santé.

## Intégration aux suivis existants
### Sommeil approfondi
À l'ouverture du suivi, Apple Santé peut préremplir :
- heure de sommeil détectée ;
- heure de réveil ;
- durée réelle de sommeil ;
- réveils détectés ;
- temps éveillé ;
- sommeil profond / Core / REM disponibles comme repères HealthKit.

La qualité ressentie, l'état au réveil, le stress, les écrans et les autres champs subjectifs restent toujours manuels.

L'historique premium peut afficher la moyenne de sommeil profond lorsque des données HealthKit existent.

### Activité & récupération
HealthKit peut apporter :
- pas ;
- distance marche/course ;
- énergie active ;
- nombre d'entraînements ;
- durée totale des entraînements ;
- distance compatible avec le champ de la pratique lorsqu'il existe.

Ces données objectives ne remplissent jamais automatiquement l'intensité ressentie, la fatigue, la récupération, le plaisir ou la disponibilité.

L'historique peut afficher une moyenne de pas Apple Santé lorsque disponible.

### Évolution corporelle
HealthKit peut préremplir uniquement une mesure réellement datée du jour consulté :
- poids ;
- tour de taille ;
- masse grasse ;
- masse maigre.

Une ancienne mesure n'est jamais recopiée comme si elle avait été prise aujourd'hui.

Le suivi Évolution corporelle gagne aussi le repère **Masse maigre**, distinct de « Masse musculaire » pour ne pas confondre les deux notions.

## Lecture native
Nouveau bridge Capacitor natif : `HealthKitPlugin.swift`.

Méthodes :
- `isAvailable` ;
- `requestAuthorization` ;
- `authorizationRequestStatus` ;
- `readDailySummary`.

Le plugin utilise directement le framework Apple `HealthKit` : aucune dépendance npm ou plugin tiers HealthKit n'est ajouté.

## Données HealthKit demandées
Lecture seulement :
- `sleepAnalysis` ;
- `stepCount` ;
- `distanceWalkingRunning` ;
- `activeEnergyBurned` ;
- workouts ;
- `bodyMass` ;
- `bodyFatPercentage` ;
- `leanBodyMass` ;
- `waistCircumference`.

Aucune donnée clinique, dossier médical, fréquence cardiaque, glycémie ou donnée non nécessaire n'est demandée dans cette V1.

## iOS / Xcode
Ajout du capability HealthKit dans le projet et dans les entitlements Debug + Release :
- `com.apple.developer.healthkit = true`

Ajout dans `Info.plist` :
- `NSHealthShareUsageDescription`

Aucune clé d'écriture HealthKit n'est ajoutée car l'app n'écrit aucune donnée dans Apple Santé.

Version :
- `MARKETING_VERSION = 1.1.0`
- `CURRENT_PROJECT_VERSION = 40`

Le capability Push Notifications V414 reste présent.

## Politique de confidentialité
La page `privacy.html` est mise à jour pour détailler :
- les catégories Apple Santé éventuellement lues ;
- le caractère facultatif et lecture seule ;
- le préremplissage local ;
- la différence entre historique HealthKit local et repère Méthode Tee enregistré ;
- l'absence d'usage publicitaire ou marketing des données HealthKit.

## Supabase
**AUCUN SQL À EXÉCUTER.**

Les valeurs que l'utilisateur décide d'enregistrer sont conservées dans la structure JSONB déjà utilisée par :
- `user_tracker_entries` ;
- `user_tracker_preferences`.

Aucune table `healthkit_*` n'est créée et aucun historique brut HealthKit n'est aspiré côté serveur.

## À FAIRE APRÈS UPLOAD GITHUB
### 1. Apple Developer
Dans **Certificates, Identifiers & Profiles → Identifiers → com.methodetee.app**, vérifier/activer le capability **HealthKit**, puis enregistrer.

Ne pas activer Health Records ni Background Delivery pour cette version.

### 2. Mac / Capacitor
Depuis le projet local :

```bash
cd ~/methode-tee-capacitor
git pull origin main
npx cap sync ios
npx cap open ios
```

Aucun `npm install` supplémentaire n'est requis par HealthKit.

### 3. Xcode
Target **App → Signing & Capabilities** : vérifier :
- HealthKit ;
- Push Notifications ;
- Bundle Identifier `com.methodetee.app` ;
- Version `1.1.0` ;
- Build `40`.

Si Xcode affiche une erreur de provisioning après l'ajout HealthKit, vérifier en priorité que HealthKit est bien activé sur l'App ID Apple Developer puis laisser Automatic Signing régénérer le profil.

### 4. Test iPhone
Tester de préférence sur un iPhone physique contenant déjà des données dans Apple Santé.

Parcours :
1. Profil → Apple Santé ;
2. choisir les catégories ;
3. Connecter Apple Santé ;
4. accepter les autorisations iOS souhaitées ;
5. ouvrir Carnet → Sommeil approfondi / Activité & récupération / Évolution corporelle ;
6. vérifier le préremplissage ;
7. modifier éventuellement une valeur ;
8. enregistrer le repère ;
9. vérifier l'historique 7 / 28 / 90 jours.

Important : pour protéger la confidentialité, iOS ne dit pas à l'app si l'utilisateur refuse spécifiquement la lecture d'un type HealthKit. Dans ce cas, Méthode Tee voit simplement qu'aucune donnée n'est disponible pour ce type.

## App Store Connect avant soumission 1.1.0
Vérifier la fiche **App Privacy / Confidentialité de l'app** pour que les catégories Santé/Forme réellement enregistrées dans le compte soient déclarées conformément au fonctionnement de l'app.

Dans les notes de review, il est utile d'indiquer :
> Apple Santé est facultatif et en lecture seule. Méthode Tee l'utilise uniquement pour préremplir des suivis personnels choisis par l'utilisateur ; aucun usage publicitaire et aucune écriture dans HealthKit.

## Fichiers principaux
- `scripts/healthkit.js`
- `www/scripts/healthkit.js`
- `scripts/custom-trackers.js`
- `www/scripts/custom-trackers.js`
- `scripts/app.js`
- `www/scripts/app.js`
- `ios/App/App/HealthKitPlugin.swift`
- `ios/App/App/MainViewController.swift`
- `ios/App/App/Info.plist`
- `ios/App/App/App.entitlements`
- `ios/App/App/AppRelease.entitlements`
- `ios/App/App.xcodeproj/project.pbxproj`
- `privacy.html` + `www/privacy.html`
- pages chargeant le module Carnet, pour exposer le bridge HealthKit partout où les suivis peuvent être ouverts.

## Vérifications réalisées sur le patch
- syntaxe JS avec `node --check` : OK ;
- parsing Swift des fichiers modifiés : OK ;
- `Info.plist`, entitlements et `project.pbxproj` : OK avec `plutil` ;
- copies racine / `www` synchronisées ;
- version Debug + Release : 1.1.0 build 40 ;
- aucun nouveau secret, aucune clé API, aucun SQL ;
- aucun plugin tiers HealthKit.

La compilation/signature iOS complète doit naturellement être validée dans Xcode sur macOS avec le compte Apple Developer, car le capability HealthKit dépend du provisioning Apple.
