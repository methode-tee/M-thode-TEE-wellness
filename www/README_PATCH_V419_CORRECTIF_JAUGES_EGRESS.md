# MÉTHODE TEE — V419 CORRECTIF JAUGES + EGRESS

**Base réelle utilisée :** `M-thode-TEE-wellness-main 377(2).zip`  
**Version marketing :** `1.1.0`  
**Build iOS :** `43`

Ce correctif reprend la V419 déjà présente dans le ZIP 377 et termine les éléments qui n'étaient pas réellement visibles/fonctionnels dans l'interface.

## Ce qui est corrigé

### 1. Jauges analytiques adaptatives réellement visibles

Dans chaque suivi, une carte **« Mes jauges et mon évolution »** est maintenant accessible directement depuis la saisie. L'écran d'évolution affiche les cartes analytiques **avant la courbe**.

Les cartes ne sont pas une jauge générique copiée partout. Elles utilisent selon le suivi :
- plages personnelles ;
- moyennes / médianes ;
- notes ressenties ;
- fréquences ;
- régularité ;
- progression vers un objectif personnel ;
- répartition horaire des pas.

Les 14 suivis couverts sont : Sommeil approfondi, Confort digestif, Reflux & aigreurs, Équilibre alimentaire, Évolution corporelle, Peau, Activité & récupération, Cycle & rythme hormonal, Périménopause & ménopause, Jeûne intermittent, Réduction du sucre, Changer une habitude, Pas & marche, Nutrition végétale & micronutriments.

Périodes disponibles : **7 jours / 28 jours / 90 jours / depuis le début**. Les jours sans saisie ne sont jamais transformés en zéro.

### 2. Pas & marche + Apple Santé

Le suivi conserve la lecture HealthKit déjà intégrée dans la base 377 :
- pas ;
- distance marche/course ;
- temps de marche ;
- étages ;
- longueur de pas ;
- vitesse de marche ;
- répartition horaire quand disponible.

Les jauges Pas & marche utilisent ces vraies données et l'objectif reste personnel. Aucun objectif automatique de 10 000 pas n'est imposé.

### 3. Nutrition végétale & micronutriments

La configuration initiale est maintenant persistante : le mode alimentaire et les micronutriments à observer ne sont plus redemandés tous les jours.

Le pont Carnet → CIQUAL ne remplace plus les données inconnues par `0`. Le résumé SQL distingue :
- repas renseignés ;
- repas calculables ;
- données complètes / partielles / non calculables ;
- valeur réellement documentée versus donnée absente.

Une donnée absente reste **non documentée** et ne peut jamais être présentée comme une carence.

### 4. Correctif cached egress / lectures Supabase

Les principales lectures excessives ont été supprimées :
- l'ouverture d'un suivi ne récupère plus jusqu'à 1000 lignes d'historique ;
- 7 / 28 / 90 jours utilisent une requête bornée sur la période et un plafond réduit ;
- « depuis le début » est chargé uniquement à la demande, par pages ;
- la suppression d'une entrée ne recharge qu'une ligne pour retrouver le dernier repère, puis la période affichée ;
- `Mon Équilibre` ne charge plus un catalogue global de 500 aliments ; son petit catalogue analytique est limité à **48 candidats ciblés** ;
- si l'empreinte hebdomadaire est déjà en cache, aucune lecture catalogue n'est déclenchée.

### 5. Correctifs de stabilité

- correction du crash possible dans la configuration Pas & marche lié à une référence `FormData` inexistante ;
- invalidation correcte des caches 7/28/90/tout après modification ou suppression ;
- parité stricte des fichiers racine et `www/` ;
- cache-busting V419 remplacé par `v419-jauges-egress-fix` afin d'éviter que Safari/PWA conserve les anciens scripts.

## Fichiers principaux modifiés

- `scripts/custom-trackers.js`
- `scripts/v419-analytics.js`
- `scripts/tee-balance.js`
- `scripts/v18-premium.js`
- `supabase/V419_MICRONUTRITION_ANALYTICS.sql`
- `index.html`
- `dashboard.html`
- `protocol-journey.html`
- `food-meal.html`
- mêmes fichiers sous `www/`

Les fichiers HealthKit/iOS présents dans le patch sont conservés depuis la V419 de la base 377 et ont été vérifiés pour le suivi Pas & marche.

## Installation

1. Copier le contenu du patch à la racine du projet 377 en conservant les dossiers.
2. Dans Supabase SQL Editor, exécuter `supabase/V419_MICRONUTRITION_ANALYTICS.sql` pour mettre à jour la fonction de résumé micronutritionnel.
3. Si la table micronutritionnelle n'a jamais été alimentée, utiliser la procédure/CSV V419 déjà fournie (`CIQUAL_2025_MICRONUTRIENTS_V419.csv`) sans inventer de valeurs manquantes.
4. Pour iOS : exécuter `npx cap sync ios`, puis ouvrir Xcode et reconstruire. Le projet reste en **1.1.0 (43)**.
5. Sur l'iPhone, fermer complètement l'ancienne PWA/app avant de retester afin de forcer le nouveau cache-busting.

## Vérifications effectuées avant empaquetage

- `node --check` : OK sur tous les JS modifiés, racine + `www/` ;
- aucune occurrence de `.limit(1000)` dans `custom-trackers.js` ;
- aucune occurrence de `.limit(500)` dans `tee-balance.js` ;
- aucune ancienne référence `v419-analytics-health` dans les pages concernées ;
- fichiers racine / `www/` identiques pour les éléments modifiés ;
- version iOS `1.1.0`, build `43` confirmés dans le projet Xcode.

