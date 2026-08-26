# PATCH V399 — Cumulatif « Inspire-moi avec ce que j’ai »

Base : ZIP 362 fourni par Tee.
Version app : 1.0.4.
Build iOS : 34.
Aucun SQL Supabase.

Ce ZIP est un **patch uniquement** : il ne contient que les fichiers à remplacer dans le projet existant.

## Fichiers à remplacer
- `food-inspiration.html`
- `scripts/food-inspiration.js`
- `styles/food.css`
- `www/food-inspiration.html`
- `www/scripts/food-inspiration.js`
- `www/styles/food.css`
- `ios/App/App.xcodeproj/project.pbxproj`

## Correctifs cumulatifs inclus
- « Une autre idée » produit de vraies variantes au lieu de répéter la même idée.
- Les idées enregistrées sont cliquables et rouvrent leur fiche ; correction du collage visuel du titre avec « Équilibre ».
- Les nouvelles idées enregistrées conservent leurs détails complets.
- Reconnaissance renforcée des catégories alimentaires et synonymes : protéines, féculents, légumes, feuilles fraîches, fruits, yaourts, laits végétaux, etc.
- Reconnaissance de nombreux poissons et produits de la mer, dont dorade/daurade, tilapia, bar, merlu, sole, truite, capitaine, vivaneau, crevettes, moules, calamars, poulpe, crabe, etc.
- Reconnaissance de bases moins classiques : manioc, igname, plantain, fonio, attiéké, nouilles, wraps, etc.
- Saisie libre renforcée : virgules, `+`, et certaines saisies sans séparateur explicite.
- « À prévoir » évite de reproposer un ingrédient déjà présent et reste utile selon l’intention.
- Cas sucrés avec lait végétal + fruits : compléments cohérents selon l’intention et vraies variantes (chia, smoothie bowl, overnight oats, esquimaux, etc.).
- Combinaisons culinaires reconnues : poulet + citron + moutarde, curry + coco, soja + gingembre, tomate + oignon, citron + herbes, etc.
- Feuilles fraîches (salade, laitue, roquette, mâche, romaine, sucrine, mesclun, jeunes pousses…) ajoutées au bon moment et non cuites par erreur.
- Corrections grammaticales sur les groupes pluriels comme « morceaux de poulet », « blancs de poulet », « feuilles de salade ».
- Cache-busting mis à jour pour forcer le chargement des nouveaux JS/CSS sur iOS.
- Build iOS passé de 32 à 34, version marketing conservée à 1.0.4.

## Exemples vérifiés
- `lait de coco + framboise + myrtille`
- `yaourt grec + fraise + framboise`
- `laitue + riz + steak haché`
- `manioc + dorade + gombo`
- `dorade + tomates + oignon`
- `blancs de poulet + citron jaune + moutarde`
- `pâtes + morceaux de poulet + feuilles de salade`
- `farine de blé noir + œufs + lait + beurre`
- `pâtes + thon + tomates`
- `pommes de terre + saumon + brocoli`
- `pain + avocat + œuf`
- `lentilles + carottes + oignon`
- `pois chiches + concombre + tomates + feta`
- `plantain + poisson + salade`
- `nouilles + tofu + pak choï`

## Application
Copier le contenu de ce patch **par-dessus le projet existant**, en conservant exactement les chemins ci-dessus et en remplaçant les fichiers existants.
