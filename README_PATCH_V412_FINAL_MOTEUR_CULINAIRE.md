# PATCH V412 FINAL — Moteur culinaire Méthode Tee

Base cible : ZIP `M-thode-TEE-wellness-main 366(1).zip`.
Version iOS : **1.0.4**. Build : **36**.
Aucun SQL Supabase à exécuter.

## Ce que ce patch remplace

Il remplace le moteur d'inspiration du build 35 par une architecture hybride :
- règles précises conservées pour les associations culinaires fortes ;
- moteur structurel pour les combinaisons inconnues ;
- classification par rôles culinaires (protéine, féculent, végétal, feuille fraîche, matière grasse, sauce, boisson, dessert, etc.) ;
- index local CIQUAL déjà présent dans le projet ;
- base de connaissances culinaire et index culturel local Afrique/Asie/Maghreb/Méditerranée ;
- compléments pouvant contenir 1 à 3 éléments lorsqu'un vrai plat complet le nécessite ;
- variation selon les 6 intentions ;
- validation anti-contradictions avant affichage ;
- préférences apprises uniquement à partir des actions positives/favoris, pas des simples affichages ;
- explications et variantes moins répétitives.

## Corrections importantes

- feuilles fraîches (sucrine, laitue, roquette, mâche, iceberg...) non cuites par erreur ;
- `pâte feuilletée/brisée/sablée` distinguée des pâtes alimentaires ;
- fromage de chèvre distingué de la viande de chèvre ;
- pinsa/panini/bruschetta/focaccia et pains spécifiques reconnus ;
- burrata, Saint Môret, ricotta, coquillettes, morceaux précis de viande/poisson reconnus ;
- attiéké, manioc, plantain, chikwangue, fonio, gombo et autres bases culturelles gardent leur identité dans les titres ;
- eau pétillante + citron + menthe reste une boisson, jamais un dessert ;
- mozzarella + tomate + basilic devient une famille caprese ;
- `pâtes + lardons + tomates` et `pinsa + Saint Môret + crème` ont désormais de vraies variantes distinctes sur plusieurs clics ;
- « Une autre idée » change réellement la forme, le titre, la préparation et les compléments ;
- les idées enregistrées conservent leur snapshot complet et restent rouvrables.

## QA effectuée

- syntaxe Node validée sur les 8 fichiers JS racine/www concernés ;
- fichiers JS racine et `www/` identiques ;
- matrice de variété : 180 générations (10 familles × 6 intentions × 3 variantes) : **0 invalide, 0 collision de titre, 0 répétition d'explication** ;
- régressions ciblées validées : eau pétillante/citron/menthe, plantain/poulet/poivron/oignon, caprese, pâtes/lardons/tomates, pinsa/Saint Môret/crème, attiéké/poulet/salade, manioc/dorade/gombo, chikwangue/poisson/feuilles de manioc.

## Fichiers à remplacer/ajouter

- `food-inspiration.html`
- `scripts/food-inspiration.js`
- `scripts/food-universal-engine.js`
- `scripts/food-inspiration-kb.js` **(nouveau)**
- `scripts/food-cultural-index.js` **(nouveau)**
- `www/food-inspiration.html`
- `www/scripts/food-inspiration.js`
- `www/scripts/food-universal-engine.js`
- `www/scripts/food-inspiration-kb.js` **(nouveau)**
- `www/scripts/food-cultural-index.js` **(nouveau)**
- `ios/App/App.xcodeproj/project.pbxproj`

Les fichiers `food-ciqual-index.js` ne sont pas inclus parce qu'ils sont déjà présents dans le ZIP 366(1) et ne sont pas modifiés par ce patch.
