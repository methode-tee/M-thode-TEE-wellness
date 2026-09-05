# PATCH V476 — Correctif 429 + apprentissage individuel dès 15 observations + version 1.1.3

Base exacte : **M-thode-TEE-wellness-main 429.zip**.

Ce patch est celui à utiliser après l'upload accidentel de `PATCH_V475_1_SECURISATION_HOLISTIQUE_SUR_V428.zip`.
Il est rebâti directement sur la **429 actuelle**, donc il ne revient pas à une ancienne base et conserve les connexions V475 :
trackers de protocoles ↔ cerveau global, Périménopause & ménopause ↔ Fringales & envies, calendrier, alimentation, Mon parcours, routines et missions.

## 1. Apprentissage individuel dès 15 observations

Le seuil fixe de 30 observations est supprimé.

Le moteur peut maintenant commencer à laisser un modèle individuel influencer une priorité à partir de **15 observations**, mais pas avec la même force qu'un historique de 30 jours :

- 15 à 19 observations : score interne ≥ 65/100, au moins 2 prédicteurs actifs, couverture moyenne ≥ 65 %, R² ≥ 0,20 et erreur standardisée ≤ 1,10 ;
- 20 à 29 observations : score ≥ 62/100, couverture ≥ 55 %, R² ≥ 0,10 ;
- 30 observations et plus : score ≥ 60/100 avec les garde-fous habituels.

Sous 30 observations, la pénalisation ridge est automatiquement renforcée. Côté application, le poids réel du modèle est aussi réduit progressivement :
environ 25 % à 15 observations, 50 % vers 20, 75 % vers 25 et 100 % à partir de 30.

Donc **15 observations peuvent déjà personnaliser**, mais un petit historique ne peut pas prendre le contrôle du raisonnement aussi fortement qu'un historique mature.

## 2. Effet d'une intervention

L'estimation d'un levier peut commencer plus tôt si les journées sont réellement comparables :

- minimum 5 jours appliqués documentés ;
- minimum 10 jours pré-intervention comparables ;
- minimum 5 jours appariés.

Avec peu de jours, l'effet estimé est mathématiquement **rétréci vers zéro**. Il n'est utilisé par l'application qu'avec une fiabilité ≥ 70/100 et, pour conclure favorable/défavorable, l'intervalle d'incertitude doit rester du même côté de zéro.

Une absence de preuve nette reste `uncertain`, pas « ça ne marche pas ».

## 3. Correctif Fringales ↔ dernier repas

La requête SQL du délai entre l'heure d'une fringale et le dernier repas utilise la sous-requête scalaire sûre.
Le SQL V476 redéfinit directement la fonction serveur concernée, donc le correctif est appliqué même si le SQL V475.1 n'avait pas encore été lancé.

## 4. Connexions V475 conservées

Le patch conserve explicitement :

- `Fringales & envies` ↔ alimentation / horaires des repas / protéines / fibres / sommeil / stress / activité / récupération / cycle / jeûne ;
- trackers intégrés aux protocoles ↔ `user_reference_daily_facts` ;
- priorité aux saisies personnelles de Mes suivis / Journal / Carnet ;
- Périménopause & ménopause ↔ bouffées de chaleur / sueurs nocturnes / sommeil / énergie / fringales ;
- routines, missions, Mon parcours et Notre journée ensemble comme contexte de régularité uniquement ;
- aucun texte libre transformé en signal physiologique ;
- aucune modification énergétique automatique.

## 5. Version 1.1.3

La version active est harmonisée partout où elle est réellement utilisée :

- Profil : **1.1.3** ;
- suppression de compte : `app_version = 1.1.3` ;
- module Apple Santé : 1.1.3 ;
- Xcode Debug + Release : `MARKETING_VERSION = 1.1.3` ;
- build Xcode : **46**.

Les anciens README historiques ne sont pas réécrits : ils décrivent les versions qu'ils accompagnaient à l'époque.

## 6. SQL À EXÉCUTER

Dans Supabase → SQL Editor, exécuter **uniquement** :

`supabase/V476_CORRECTIF_429_APPRENTISSAGE_15_VERSION_1_1_3.sql`

Il est prévu pour une base où V474/V475 sont déjà installés. Il peut être exécuté même si le SQL V475.1 a déjà été lancé : les fonctions sont remplacées proprement et les modèles en cache sont invalidés pour être recalculés.

**Ne relance pas V474 ni le gros V475 cumulatif après V476.**

## 7. Fichiers importants remis dans ce patch

Le patch remet aussi les fichiers critiques V475 depuis la 429 actuelle afin d'éliminer tout doute après l'upload du ZIP prévu pour V428 :

- `custom-trackers.js`
- `v18-premium.js`
- `protocol-journey.js`
- `personal-reference.js`
- `adaptive-reference.js`

Les miroirs `scripts/` et `www/scripts/` restent identiques.

## 8. Vérifications avant Archive

1. Dans Profil, vérifier `Version 1.1.3`.
2. Dans Xcode, vérifier `Version 1.1.3` et `Build 46`.
3. Tester `Marquer comme fait` sur un contenu de protocole.
4. Enregistrer Fringales & envies.
5. Enregistrer un tracker directement dans un protocole puis rouvrir le jour.
6. Tester le protocole Périménopause & ménopause quand il devient visible.
7. Vérifier qu'une journée isolée ne produit pas de conclusion forte.
8. Après 15 journées bien documentées, un modèle peut devenir utilisable seulement s'il passe les critères de qualité ci-dessus.

## Important

Un modèle à 15 observations reste plus incertain qu'un modèle à 30 ou 90 observations. V476 ne prétend pas supprimer cette limite statistique :
il permet de commencer plus tôt **en compensant par davantage de régularisation, des critères de qualité plus stricts et une influence réduite**.
