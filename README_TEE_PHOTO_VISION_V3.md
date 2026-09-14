# TEE PHOTO VISION V3 — groupes visuels + choix exacts bibliothèque

Base : `M-thode-TEE-wellness-main 500 4.zip`.

Cette version remplace V2 côté photo.

## Ce qui change
- correction native : suppression de `imageCropAndScaleOption` sur `VNClassifyImageRequest`;
- aucune substitution silencieuse `matches[0]`;
- Apple Vision ne choisit plus une fiche exacte : il produit des groupes visuels prudents;
- chaque groupe interroge `MTFood.searchFoods(..., 10)`, la même recherche que le carnet;
- pour chaque aliment détecté, l'utilisateur voit « Lequel ? » et choisit la fiche exacte;
- exemple : `yogurt` => groupe `Yaourt` => variantes de la bibliothèque TEE;
- groupes culturels prudents : manioc => manioc / attiéké / gari, etc., toujours présentés comme hypothèses;
- opt-in facultatif pour relier la photo déjà enregistrée du repas aux aliments confirmés et préparer un futur corpus d'entraînement; aucune duplication de l'image;
- ce corpus ne réentraîne PAS automatiquement Apple Vision.

## Fichiers GitHub à remplacer
- ios/App/App/FoodVisionPlugin.swift
- scripts/food-meal.js
- www/scripts/food-meal.js
- food-meal.html
- www/food-meal.html
- styles/food.css
- www/styles/food.css

## SQL
Exécuter séparément `TEE_PHOTO_VISION_V3_SQL_A_EXECUTER.sql` pour le feedback et le corpus opt-in. La reconnaissance et les propositions restent utilisables même si ce SQL n'est pas encore installé.

## Après upload
Depuis le projet Mac :
`git pull --rebase origin main`
`npx cap sync ios`
`npx cap open ios`
Puis compiler sur un vrai iPhone.
