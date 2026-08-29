# MÉTHODE TEE — PATCH V419 FINAL
## Suivis analytiques + courbes + Pas & marche + HealthKit enrichi + Nutrition végétale & micronutriments

**Base d’application du patch :** `M-thode-TEE-wellness-main 378(1).zip`  
**Version iOS conservée :** `1.1.0`  
**Build :** `43`  
**Bundle :** `com.methodetee.app`

Ce patch est cumulatif par rapport au ZIP 378(1) transmis. Il ne remplace pas l’architecture existante : il enrichit `Mes suivis`, HealthKit, le Carnet, Mon Équilibre et le moteur CIQUAL déjà présents.

---

# 1. CE QUI EST LIVRÉ

## 1.1 Jauges ET courbes réellement visibles dans les suivis

Les **14 suivis** disposent maintenant d’analytics adaptés. Les jauges et mini-courbes ne sont plus seulement accessibles derrière un écran secondaire : à l’ouverture de **Saisir aujourd’hui**, un bloc **« Aperçu de mon évolution »** charge de façon bornée les 7 derniers jours et affiche directement les cartes et courbes disponibles avant le formulaire.

La vue complète reste disponible avec :

- 7 jours ;
- 28 jours ;
- 90 jours ;
- Depuis le début.

Les jours sans donnée restent absents des courbes : ils ne sont jamais transformés en zéro.

Les graphiques SVG ont un `role="img"` et un `aria-label` qui décrit le minimum, le maximum, la dernière donnée et la période. L’information ne repose pas uniquement sur la couleur.

## 1.2 Analytics spécifiques aux 14 suivis

### Sommeil approfondi
- durée : plage + moyenne ;
- heure moyenne de coucher ;
- heure moyenne de réveil ;
- variabilité des horaires ;
- réveils ;
- temps éveillé ;
- Deep / REM quand Apple Santé les fournit ;
- qualité ressentie ;
- état au réveil ;
- régularité de durée ;
- courbes dédiées.

### Confort digestif
- confort ;
- ballonnements ;
- douleurs ;
- lourdeur ;
- gaz ;
- fréquence des journées avec inconfort ;
- transit / régularité digestive ;
- contexte, taille et vitesse des repas ;
- courbes.

### Reflux & aigreurs
- fréquence ;
- intensité ;
- moment des épisodes ;
- durée ;
- délai repas → coucher ;
- position après repas ;
- contextes épicé/gras/acide/caféine ;
- courbes.

### Équilibre alimentaire
- diversité ;
- protéines ;
- végétaux ;
- fibres lorsqu’elles sont disponibles ;
- satiété ;
- hydratation ;
- plaisir ;
- restriction ressentie ;
- courbes.

### Évolution corporelle
- poids en **plage neutre**, jamais en score moral ;
- tour de taille ;
- hanches ;
- poitrine ;
- cuisse ;
- bras ;
- masse grasse ;
- masse maigre / musculaire si renseignée ;
- confort corporel ;
- vêtements ;
- ballonnements ;
- rétention d’eau ;
- courbes séparées.

Aucune notion de poids « bon/mauvais » n’est créée.

### Peau
- imperfections ;
- réactivité / rougeurs ;
- sécheresse ;
- démangeaisons ;
- sébum ;
- texture ;
- jours réactifs ;
- sommeil / stress renseignés ;
- courbes.

### Activité & récupération
- récupération ;
- disponibilité ;
- intensité / charge ;
- fatigue ;
- énergie ;
- temps de pratique ;
- fréquence / régularité ;
- pas, distance et énergie active HealthKit quand disponibles ;
- courbes.

### Cycle & rythme hormonal
- symptômes ;
- énergie ;
- sommeil ;
- douleurs ;
- stress ;
- humeur ;
- appétit ;
- ballonnements ;
- peau ;
- disponibilité au mouvement ;
- flux ;
- courbes descriptives.

Aucun score de fertilité, aucune jauge « bonne/mauvaise ».

### Périménopause & ménopause
- sommeil ;
- énergie ;
- humeur ;
- stress ;
- concentration ;
- articulations ;
- digestion ;
- jours avec bouffées de chaleur ;
- nuits avec sueurs nocturnes ;
- courbes.

### Jeûne intermittent
- durée en plage descriptive ;
- faim ;
- énergie ;
- hydratation ;
- maux de tête ;
- étourdissements ;
- confort de rupture ;
- satiété / digestion après rupture ;
- jours de pause ;
- courbes.

La durée du jeûne n’est pas transformée en score moral.

### Réduction du sucre
- intensité des envies ;
- journées sans sucres ajoutés renseignées ;
- alternatives utilisées ;
- utilité perçue ;
- moment / déclencheur ;
- satisfaction ;
- courbes.

### Changer une habitude
- petits pas réalisés ;
- confiance ;
- difficulté ;
- impulsion ;
- déclencheurs ;
- alternatives / réponses ;
- courbes.

### Nutrition végétale & micronutriments
Voir section 3.

### Pas & marche
Voir section 2.

---

# 2. PAS & MARCHE — VERSION ANALYTIQUE COMPLÈTE

Le suivi reste distinct de **Activité & récupération**.

## Configuration

Trois modes :

1. **Observer sans objectif** ;
2. **Construire mon repère personnel** ;
3. **Fixer mon propre objectif**.

Aucun objectif de 10 000 pas n’est appliqué par défaut.

Quand Apple Santé est disponible, Méthode Tee lit les **28 jours précédents**, calcule :

- médiane ;
- moyenne ;
- nombre de journées disponibles ;
- proposition douce d’environ +10 % par rapport à la médiane.

La proposition n’est **jamais appliquée automatiquement**. Il faut appuyer explicitement sur **« Utiliser la proposition comme objectif »**.

## Données HealthKit prises en charge

- pas ;
- distance marche/course ;
- longueur de pas ;
- vitesse de marche ;
- étages montés ;
- énergie active ;
- entraînements ;
- temps d’entraînement Marche / Randonnée ;
- nombre d’entraînements Marche / Randonnée ;
- répartition horaire des pas.

## Données manuelles / web

- pas ;
- distance ;
- temps de marche ;
- longueur de pas ;
- vitesse ;
- étages ;
- énergie active ;
- aisance ;
- énergie après marche ;
- gêne ;
- type de marche ;
- terrain ;
- contexte.

## Analytics

- carte de rythme personnel 28 jours ;
- comparaison de la journée au rythme personnel ;
- plage ;
- moyenne ;
- médiane ;
- régularité ;
- distance ;
- longueur de pas ;
- vitesse ;
- énergie active ;
- étages ;
- temps marche/randonnée ;
- nombre d’entraînements ;
- objectif personnel uniquement s’il a été choisi ;
- distribution horaire ;
- courbes pas / distance / vitesse / énergie active.

Une période sans pas n’est jamais appelée automatiquement **« sédentaire »**.

## Historique HealthKit

Le plugin natif fournit `readActivityHistory` avec une période bornée à **366 jours par demande**. L’historique brut est fusionné **en mémoire** avec les entrées du suivi. Il n’est pas copié en masse vers Supabase.

Un cache mémoire court de 5 minutes évite de relire HealthKit inutilement.

---

# 3. NUTRITION VÉGÉTALE & MICRONUTRIMENTS

Le suivi lit les repas réellement enregistrés dans le Carnet. Il ne demande pas de ressaisir les aliments.

## Configuration

### Mode alimentaire
- Végane ;
- Végétarien ;
- Majoritairement végétal ;
- Flexitarien ;
- Omnivore — je souhaite surtout observer mes micronutriments ;
- Je ne souhaite pas préciser.

### Repères sélectionnables
- protéines ;
- fibres ;
- fer ;
- calcium ;
- zinc ;
- iode ;
- magnésium ;
- phosphore ;
- potassium ;
- sélénium ;
- vitamines B1, B2, B3, B6, B9, B12 ;
- vitamine C ;
- vitamine D ;
- vitamine E ;
- oméga-3 ;
- diversité végétale.

### Repères complémentaires
- aliments enrichis / fortifiés ;
- supplémentation B12 renseignée ;
- supplémentation vitamine D renseignée ;
- supplémentation oméga-3 renseignée.

Aucune dose n’est demandée ni prescrite.

## Lecture automatique du Carnet

Pour une date donnée, une seule RPC bornée `food_day_micronutrition_summary(date)` renvoie :

- repas renseignés ;
- repas calculables ;
- aliments quantifiés ;
- protéines ;
- glucides ;
- lipides ;
- fibres ;
- micronutriments réellement disponibles ;
- nombre de nutriments documentés ;
- aliments sources ;
- principaux contributeurs **avec leur contribution calculée** ;
- qualité des données.

### Qualité des données

Les états sont distincts :

- aucun repas ;
- repas non calculable ;
- lecture partielle ;
- données largement exploitables.

`0`, `null`, champ absent, aliment non quantifié et donnée CIQUAL indisponible ne sont pas confondus.

## Micronutriments

Les cartes affichent, quand elles existent :

- quantité calculée ;
- sources alimentaires principales ;
- contribution de chaque source ;
- évolution sur la période choisie.

Exemple de rendu possible :

> Fer · 7,8 mg calculés  
> Sources : lentilles · 3,2 mg · graines de courge · 2,1 mg

L’app ne dit jamais **« tu es carencée »**. Une absence de valeur est affichée comme **non documentée / donnée insuffisante / aucune source calculable renseignée**.

## Champs subjectifs facultatifs

- énergie après les repas ;
- satiété ;
- digestion ;
- faim ;
- impression de variété ;
- aliment fortifié aujourd’hui ;
- supplémentation prise aujourd’hui ;
- remarque libre.

---

# 4. CIQUAL RÉEL — PAS DE VALEURS INVENTÉES

Le SQL V419 :

- conserve `ciqual_foods` ;
- crée / met à niveau `ciqual_food_nutrients` ;
- ajoute `updated_at` ;
- ajoute les snapshots `micronutrients_100g` et `micronutrients` aux items de repas ;
- expose `search_foods_v3` ;
- expose `food_day_micronutrition_summary(date)` ;
- garde les calculs journaliers bornés.

Les snapshots rendent les anciens repas stables même si la base CIQUAL évolue ensuite.

## Source officielle

Source documentée : **Anses — Table de composition nutritionnelle des aliments Ciqual 2025**, version publiée le 19/11/2025, fichier `Table Ciqual 2025_FR_2025_11_03.xlsx`.

Le dépôt 378 contient déjà le CSV V419 pour les nutriments qui avaient été importés auparavant. Le patch ajoute la prise en charge de **phosphore, B1, B2, B3, B6 et E** et fournit :

- `qa/build_ciqual_micronutrients.py` ;
- `qa/update_ciqual_2025_full.sh`.

Le script télécharge le fichier officiel et régénère `supabase/CIQUAL_2025_MICRONUTRIENTS_V419.csv` à partir des **en-têtes officiels**. Les valeurs comme `ND`, traces ou valeurs qualifiées ne sont jamais converties arbitrairement en nombres.

**Important :** les nouveaux nutriments ne sont affichés avec une quantité que lorsqu’une valeur réelle a été importée. Avant cela, l’interface dit **« Non documenté »**. C’est volontaire.

---

# 5. APPLE SANTÉ / HEALTHKIT

HealthKit reste **strictement en lecture seule** :

```swift
requestAuthorization(toShare: [], read: readTypes)
```

Aucune donnée n’est écrite dans Apple Santé.

## Autorisations existantes

Une personne qui avait déjà connecté la catégorie Activité avant l’ajout des nouveaux types voit dans Profil → Apple Santé :

**« Autoriser les nouveaux repères de marche »**

Cette action redemande explicitement les autorisations de lecture pour la catégorie activité enrichie et mémorise localement que la demande a été faite.

## Card Profil

Déconnectée :

> Apple Santé  
> Préremplis sommeil, activité & marche et évolution corporelle.  
> Connecter →

Connectée :

> Apple Santé · Activée · sommeil · activité & marche · corps

## Synchronisation

- les champs vides d’un suivi compatible peuvent être préremplis ;
- rien n’est sauvegardé dans un suivi tant que la personne ne valide pas **Enregistrer ce repère** ;
- l’historique HealthKit brut reste local ;
- les événements `mt:healthkit-daily-data` enrichissent Mon Équilibre sans attendre une sauvegarde Supabase.

---

# 6. TOUT COMMUNIQUE — SANS CAUSALITÉ INVENTÉE

Les nouveaux signaux sont réutilisés par :

- Mon Équilibre ;
- le Carnet / Mon parcours ;
- l’historique journalier ;
- les lectures transversales.

Pour la marche, `Pas & marche` est prioritaire afin de ne pas additionner les mêmes pas une deuxième fois via `Activité & récupération`.

Des associations transversales peuvent être affichées seulement avec **au moins 4 journées comparables**. Exemples actuellement prévus :

- Pas & marche ↔ énergie renseignée ;
- sommeil ↔ énergie / récupération ;
- fibres calculées ↔ confort digestif.

Le wording reste :

> association personnelle à observer, jamais une preuve de causalité.

---

# 7. CACHED EGRESS / PERFORMANCE

Le correctif est conservé et renforcé :

- pas de lecture globale de 500/1000 entrées à l’ouverture d’un formulaire ;
- vue inline : 7 jours seulement ;
- périodes standards bornées ;
- `Depuis le début` uniquement sur action explicite, pagination par blocs de 200 ;
- croisement inter-suivis borné à 240 lignes sélectionnées ;
- requêtes nutritionnelles par **une seule date** ;
- `search_foods_v3` limite le nombre de résultats ;
- cache court côté connaissances alimentaires et HealthKit ;
- aucun chargement des milliers de lignes CIQUAL pour calculer une journée ;
- aucun envoi massif de l’historique Apple Santé vers Supabase.

Cache-busting runtime :

`v419-full-analytics-r3`

Le correctif clavier Safari/iOS **V418 reste intact** ; seul le query-string de cache du fichier a été renouvelé pour forcer le navigateur à charger cette version.

---

# 8. CONFIDENTIALITÉ

`privacy.html` et `www/privacy.html` indiquent désormais explicitement :

- HealthKit facultatif et en lecture seule ;
- pas, distance, longueur de pas, vitesse, étages, énergie active et entraînements quand autorisés ;
- historique brut HealthKit non synchronisé automatiquement ;
- nutrition calculée uniquement à partir des aliments et quantités renseignés et des données CIQUAL disponibles ;
- absence de diagnostic de carence ;
- absence de prescription automatique de supplémentation.

---

# 9. INSTALLATION DU PATCH SUR LA BASE 378(1)

Le ZIP du patch contient un dossier racine nommé :

`PATCH_Methode_TEE_V419_SUIVIS_ANALYTIQUES_HEALTHKIT_MICRONUTRITION_1.1.0_build43`

## A. Vérifier Git AVANT de copier le patch

Dans ton projet :

```bash
cd ~/Desktop/M-thode-TEE-wellness-main
git status
```

Si tu as des modifications locales importantes, sauvegarde-les avant `git pull` :

```bash
git stash push -u -m "sauvegarde avant V419 final"
git pull origin main
```

Si ton `git status` était déjà propre :

```bash
git pull origin main
```

## B. Appliquer le ZIP

Exemple si le ZIP est dans Téléchargements :

```bash
rm -rf /tmp/tee_v419_final
mkdir -p /tmp/tee_v419_final
unzip -o ~/Downloads/PATCH_Methode_TEE_V419_SUIVIS_ANALYTIQUES_HEALTHKIT_MICRONUTRITION_1.1.0_build43.zip -d /tmp/tee_v419_final
cp -R /tmp/tee_v419_final/PATCH_Methode_TEE_V419_SUIVIS_ANALYTIQUES_HEALTHKIT_MICRONUTRITION_1.1.0_build43/. .
git status
```

## C. Supabase

Dans **Supabase → SQL Editor**, exécuter :

`supabase/V419_MICRONUTRITION_ANALYTICS.sql`

Ensuite, pour régénérer le CSV avec tous les constituants nouvellement supportés à partir du fichier officiel Anses :

```bash
./qa/update_ciqual_2025_full.sh
```

Si Python indique que `openpyxl` manque :

```bash
python3 -m pip install openpyxl
./qa/update_ciqual_2025_full.sh
```

Importer ensuite le CSV généré :

`supabase/CIQUAL_2025_MICRONUTRIENTS_V419.csv`

vers :

`public.ciqual_food_nutrients`

avec upsert sur la clé composite :

`(ciqual_code, nutrient_key)`.

## D. Capacitor / iOS

```bash
npm install
npx cap sync ios
npx cap open ios
```

Dans Xcode vérifier :

- Version `1.1.0` ;
- Build `43` ;
- Bundle `com.methodetee.app` ;
- HealthKit présent ;
- Push Notifications présent ;
- In-App Purchase présent.

Ne pas recréer de clé APNs et ne pas modifier les secrets existants.

---

# 10. TEST HEALTHKIT SUR IPHONE PHYSIQUE

## Autorisations

1. Ouvrir Méthode Tee → Profil → Apple Santé.
2. Si Apple Santé était déjà activée avant le patch, toucher **Autoriser les nouveaux repères de marche**.
3. Autoriser les types souhaités dans iOS.

## Pas

1. Garde l’iPhone sur toi.
2. Marche 100–200 pas.
3. Vérifie Santé → Activité → Pas.
4. Ouvre Méthode Tee → Pas & marche → Saisir aujourd’hui.
5. Vérifie pas + distance et les autres repères disponibles.

## Longueur / vitesse / étages

Ils ne doivent apparaître que si Apple Santé possède réellement une donnée autorisée.

## Poids

Ajoute un poids daté d’aujourd’hui dans Santé puis ouvre Évolution corporelle avec le champ vide. Une ancienne mesure ne doit pas être recopiée comme si elle avait été faite aujourd’hui.

## Sommeil

Ajoute une période de sommeil pour la nuit précédente dans Santé ou utilise une vraie nuit enregistrée, puis ouvre Sommeil approfondi.

---

# 11. QA TECHNIQUE EFFECTUÉE DANS L’ENVIRONNEMENT DE GÉNÉRATION

Contrôles effectués :

```bash
node --check scripts/app.js
node --check scripts/custom-trackers.js
node --check scripts/healthkit.js
node --check scripts/v419-analytics.js
node --check scripts/tee-balance.js
node --check scripts/journal.js
python -m py_compile qa/build_ciqual_micronutrients.py
swiftc -frontend -parse ios/App/App/HealthKitPlugin.swift
```

Parité vérifiée pour les fichiers runtime root / `www` concernés.

Vérifications statiques :

- `toShare: []` conservé ;
- V418 clavier toujours présent dans `scripts/app.js` ;
- version 1.1.0 / build 43 ;
- aucune clé `.p8` ajoutée au patch ;
- pas de `.limit(500)` / `.limit(1000)` dans les chemins analytiques V419 ;
- cache-busting renouvelé.

**Ce qui doit obligatoirement être testé sur ton Mac/iPhone :** compilation Xcode complète, autorisations réelles HealthKit et rendu sur iPhone physique. Le conteneur de génération ne remplace pas Xcode ni un iPhone.

---

# 12. APP STORE — NOTE DE REVIEW

> Apple Santé est entièrement facultative et utilisée en lecture seule. Méthode Tee peut lire les données autorisées de sommeil, activité/marche et certains repères corporels afin de préremplir ou enrichir les suivis personnels. Aucune donnée n’est écrite dans Apple Santé et l’historique brut HealthKit n’est pas envoyé automatiquement aux serveurs. Activity data may include steps, walking/running distance, walking step length, walking speed, flights climbed, active energy and workouts when available and authorized.

---

# 13. FICHIERS LIVRÉS / VÉRIFIÉS

Le patch contient les versions complètes nécessaires, notamment :

- `scripts/custom-trackers.js` + miroir `www/` ;
- `scripts/healthkit.js` + miroir `www/` ;
- `scripts/v419-analytics.js` + miroir `www/` ;
- `scripts/tee-balance.js` + miroir `www/` ;
- `scripts/journal.js` + miroir `www/` ;
- `scripts/app.js` + miroir `www/` ;
- `scripts/v18-premium.js` + miroir `www/` ;
- `scripts/food-core.js`, `food-meal.js`, `food-day.js` + miroirs ;
- `ios/App/App/HealthKitPlugin.swift` ;
- `ios/App/App.xcodeproj/project.pbxproj` ;
- `supabase/V419_MICRONUTRITION_ANALYTICS.sql` + miroir `www/` ;
- `supabase/CIQUAL_2025_MICRONUTRIENTS_V419.csv` ;
- `qa/build_ciqual_micronutrients.py` ;
- `qa/update_ciqual_2025_full.sh` ;
- `privacy.html` + miroir `www/` ;
- les pages HTML root/`www` dont le cache-busting devait être renouvelé ;
- ce README.

