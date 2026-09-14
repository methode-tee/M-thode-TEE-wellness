# TEE PHOTO VISION LOCAL V1

## Ce patch fait quoi ?
- Reconnaissance photo 100 % locale sur iPhone avec Apple Vision.
- Aucun appel Gemini / OpenAI / serveur d'IA pour analyser la photo.
- Aucun coût par photo.
- La photo est analysée dans l'iPhone avec `VNClassifyImageRequest`.
- Une analyse de régions saillantes est également faite pour récupérer plusieurs éléments possibles d'une assiette.
- Les labels Apple ne sont JAMAIS enregistrés directement :
  ils sont convertis en pistes puis recherchés via `MTFood.searchFoods`, donc la bibliothèque TEE reste la vérité finale.
- Rien n'est ajouté sans confirmation de l'utilisateur.

## Limite assumée de V1
Apple Vision est un classifieur généraliste. Il sera surtout utile sur les aliments visuellement courants.
Les plats culturels/mélangés (attiéké, kenkey, ndolé, achu, etc.) peuvent ne pas être reconnus précisément en V1.
Le système échoue fermé : si TEE n'est pas sûre, elle n'invente rien et laisse l'utilisateur rechercher.

## Fichiers à remplacer
- ios/App/App/FoodVisionPlugin.swift (nouveau)
- ios/App/App/MainViewController.swift
- ios/App/App.xcodeproj/project.pbxproj
- scripts/food-meal.js
- www/scripts/food-meal.js
- food-meal.html
- www/food-meal.html

## Après upload GitHub
Depuis la racine du projet :
1. npm install (seulement si node_modules n'existe pas)
2. npx cap sync ios
3. npx cap open ios
4. Build / Run sur un vrai iPhone dans Xcode.

`npx cap sync ios` est nécessaire ici parce qu'on touche à la couche native iOS + au webDir `www`.

## Test
- Photographier une assiette simple : riz + poulet + brocoli.
- Vérifier que TEE affiche des propositions à confirmer.
- Ajouter une proposition.
- Vérifier qu'elle utilise une vraie fiche TEE et une portion modifiable.
- Tester une photo difficile : si la reconnaissance est faible, TEE doit dire qu'elle préfère ne rien inventer.
