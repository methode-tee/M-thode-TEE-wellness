# Méthode Tee V419 — Suivis analytiques, Apple Santé et protocoles

Correctif SQL du 29 août 2026 : le résumé journalier additionne les colonnes réelles `protein` et `fiber` de `food_meal_items`.

Base : ZIP 376(3). Version iOS : **1.1.0 (43)**.

## Ce patch ajoute

- `Pas & marche` dans Mes suivis : pas, distance, temps de marche, étages, longueur moyenne du pas, vitesse, ressenti et contexte ;
- trois modes de repère : observer sans objectif, construire un repère personnel, ou fixer son propre objectif ; aucun objectif de 10 000 pas n’est imposé ;
- lecture Apple Santé strictement locale et en lecture seule : historique journalier, répartition horaire, longueur du pas, vitesse et étages ;
- `Nutrition végétale & micronutriments`, relié aux repas et quantités réellement enregistrés ;
- 23 869 valeurs nutritionnelles exactes transformées depuis la Table Ciqual 2025 fournie ; les valeurs `<`, traces et données non numériques ne sont pas inventées ;
- instantanés micronutritionnels dans chaque aliment enregistré afin qu’une mise à jour future de la bibliothèque ne réécrive pas l’histoire ;
- courbe et plages 7/28/90 jours/depuis le début dans les 14 suivis ;
- courbe `Vitalité · Équilibre intérieur · Régularité` calée sur les jours 1 à N de chaque protocole, juste avant `Rituel · Jour par jour` ;
- connexion des nouveaux signaux au Carnet, à Mon Équilibre et aux instantanés quotidiens.

Une absence de donnée est toujours présentée comme **non documentée**. L’application ne conclut jamais à une carence, ne transforme jamais un jour vide en zéro et ne présente jamais une corrélation personnelle comme une causalité.

## Installation Supabase — ordre obligatoire

1. Exécuter `supabase/V419_MICRONUTRITION_ANALYTICS.sql` dans SQL Editor.
2. Ouvrir Table Editor → `ciqual_food_nutrients` → Import CSV.
3. Importer `supabase/CIQUAL_2025_MICRONUTRIENTS_V419.csv` en conservant les en-têtes.
4. Vérifier :

```sql
select count(*) as lignes_importees,
       count(distinct ciqual_code) as aliments,
       count(distinct nutrient_key) as nutriments
from public.ciqual_food_nutrients;
```

Le nombre de lignes attendu est **23 869**. Le script de transformation reproductible est conservé dans `qa/build_ciqual_micronutrients.py`.

## Upload GitHub puis terminal

Uploader les fichiers du patch en conservant exactement leurs dossiers, puis :

```bash
cd ~/Desktop/M-thode-TEE-wellness-main
git status
git add .
git commit -m "V419 suivis analytiques HealthKit et micronutrition"
git push origin main
npx cap sync ios
open ios/App/App.xcodeproj
```

## Test Apple Santé sans montre

1. Dans Santé → Activité → Pas, noter la valeur, marcher 100 à 200 pas avec l’iPhone, puis vérifier qu’elle augmente.
2. Dans Méthode Tee → Carnet → Mes suivis, activer `Pas & marche`, choisir `Construire mon repère personnel`, puis ouvrir `Saisir aujourd’hui`.
3. Connecter Apple Santé si nécessaire et autoriser Activité. Les pas et la distance doivent apparaître. La longueur du pas, la vitesse et les étages n’apparaissent que si Santé possède ces mesures.
4. Pour Évolution corporelle, ajouter dans Santé un poids daté d’aujourd’hui puis rouvrir le suivi avec le champ vide. Une ancienne mesure n’est jamais recopiée comme si elle avait été prise aujourd’hui.
5. Pour le sommeil, ajouter une période pour la nuit précédente dans Santé ou attendre une nuit mesurée.
6. Les données de test peuvent ensuite être supprimées dans Santé.

## Test micronutrition

1. Dans Ma journée alimentaire, enregistrer un repas avec au moins un aliment CIQUAL et une quantité.
2. Ouvrir `Nutrition végétale & micronutriments` pour la même date.
3. Vérifier le nombre de repas calculés, protéines, fibres et uniquement les micronutriments documentés.
4. Tester un repas sans quantité ou un plat culturel sans correspondance CIQUAL : aucune quantité micronutritionnelle ne doit être inventée.

## Test courbe de protocole

- ouvrir un protocole possédé ;
- renseigner ou modifier des données pendant deux journées du protocole ;
- revenir dans le protocole : la courbe apparaît avant `Rituel · Jour par jour` ;
- vérifier qu’un jour sans donnée crée une rupture et non un point à zéro.

## Vérifications effectuées

- syntaxe JavaScript de tous les fichiers modifiés ;
- parité racine / `www` ;
- génération déterministe du CSV depuis le fichier CIQUAL fourni ;
- HealthKit reste `toShare: []` et ne demande aucune autorisation d’écriture ;
- build iOS porté à 43.

Le widget d’écran d’accueil vu dans la capture nécessite une cible WidgetKit, un App Group et une nouvelle capacité de signature Apple. Il n’est pas activé silencieusement dans ce patch, afin de ne pas casser la signature Xcode Cloud de l’application principale. Les données et instantanés nécessaires sont maintenant structurés pour cette extension dédiée.
