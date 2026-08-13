# PATCH V331 — CARNET ALIMENTAIRE COMPLET

Base stricte : `M-thode-TEE-wellness-main 315(5).zip`

## Ce que V331 ajoute

### 1. Biblio devient Carnet
Le rendu premium V330 est conservé :
- kicker `CARNET PERSONNEL` ;
- grand titre serif `Mon carnet & mes repères` ;
- fond crème, vert profond, doré discret ;
- aucun losange, aucun trait décoratif ajouté au hero.

### 2. Ma journée alimentaire
Nouvelle vraie page `food-day.html` :
- Petit-déjeuner / Déjeuner / Collation / Dîner ;
- date précédente / suivante ;
- repas renseignés ;
- photo du repas si l'utilisateur en a ajouté une ;
- résumé kcal/protéines/fibres en second niveau ;
- énergie / digestion / satiété ;
- historique des 60 derniers jours ;
- accès direct `Adapter ce repas`.

### 3. Ajouter / modifier un repas
Nouvelle page `food-meal.html` :
- moment du repas ;
- heure ;
- description libre ;
- photo facultative ;
- recherche d'aliments ;
- quantités ;
- énergie / digestion / satiété ;
- modification et suppression.

**CIQUAL n'est jamais affiché dans l'interface.** La base CIQUAL reste uniquement la source technique de calcul.

### 4. Photos privées
Migration `supabase/V331_CARNET_ALIMENTAIRE.sql` :
- bucket privé `food-media` ;
- chemin : `{user_id}/{date}/{meal_id}-....webp` ;
- compression WebP avant upload ;
- 1 seule image stockée et réutilisée dans Ma journée alimentaire / Adapter mon repas / historique ;
- RLS : un utilisateur ne peut lire/modifier/supprimer que ses propres fichiers.

Les photos et repas restent liés au compte Supabase : ils sont retrouvés après fermeture, réinstallation ou changement d'iPhone dès que la personne se reconnecte.

### 5. Adapter mon repas
Nouvelle page `food-adapter.html` :
- description libre du repas ;
- photo facultative ou réutilisation de la photo d'un repas existant ;
- intention facultative : Équilibre / Digestion / Énergie / Prise de masse / Perte de poids / Autre ;
- moteur déterministe local (aucune IA payante) ;
- maximum 2 à 3 ajustements ;
- ne supprime jamais automatiquement l'élément central ;
- privilégie ajout/substitution avant suppression ;
- enregistre le résultat et la décision `J'adopte` / `Je garde mon repas`.

Le moteur reconnaît notamment protéines, féculents, légumes, fromages, charcuteries, sauces, fritures, boissons sucrées, fruits et sources de lipides. Pour les formulations ambiguës, il ne prétend pas faire une analyse médicale.

### 6. Recettes existantes
Le système actuel de recettes/favoris reste intact.

Dans une recette déjà accessible, un bouton discret est ajouté :
`J'ai mangé cette recette`

Il ouvre `food-meal.html?recipe_id=...` et préremplit le repas. La recette reste enregistrée dans la Bibliothèque/Favoris : on ne la déplace ni ne la supprime.

### 7. Mon Équilibre aujourd'hui
La migration crée la fonction compacte :
`food_day_balance_summary(date)`

`tee-balance.js` récupère uniquement ce résumé du jour :
- nombre de repas renseignés ;
- protéines/fibres agrégées ;
- énergie/digestion/satiété moyennes.

Le bloc `Alimentation` est ajouté aux repères de Mon Équilibre, mais **aucun quatrième anneau n'est créé** et l'historique alimentaire complet n'est jamais chargé dans Mon Équilibre.

## Performance — règles respectées

- `prewarm.js` est strictement inchangé.
- aucun CIQUAL complet n'est chargé sur l'iPhone ;
- recherche après 3 caractères ;
- debounce 350 ms ;
- 10 résultats maximum ;
- pages alimentaires séparées, donc chargées uniquement quand elles sont ouvertes ;
- historique chargé uniquement si l'utilisateur appuie sur Historique ;
- images compressées avant upload ;
- images d'historique en `loading=lazy` ;
- Mon Équilibre lit un résumé RPC compact.

## Architecture interdite — inchangée

V331 ne modifie pas :
- StoreKit 2 ;
- Stripe ;
- validation Apple ;
- restauration Apple ;
- Product IDs ;
- tables d'achats ;
- déblocage des protocoles ;
- recettes liées aux protocoles ;
- `prewarm.js` ;
- service worker.

Deux micro-modifications volontaires sont faites dans `scripts/app.js` :
1. déclarer les 3 nouvelles pages comme pages privées ;
2. afficher `J'ai mangé cette recette` dans une recette accessible.

## Installation Supabase obligatoire

1. Ouvrir Supabase > SQL Editor.
2. Exécuter `supabase/V331_CARNET_ALIMENTAIRE.sql`.
3. Importer ensuite le fichier officiel CIQUAL dans `public.ciqual_foods`.

Le patch contient `supabase/CIQUAL_IMPORT_TEMPLATE.csv` avec les colonnes attendues :
`code,name,search_text,kcal_100g,protein_100g,fat_100g,carbs_100g,fiber_100g,salt_100g`

**Le dataset CIQUAL complet n'est pas inclus dans le ZIP.** Il doit provenir de la source officielle. Sans cet import, la description libre, les photos, l'historique et Adapter mon repas fonctionnent, mais la recherche d'aliments ne renverra aucun résultat.

## Tests à faire avant App Store

1. Carnet s'ouvre sans délai supplémentaire.
2. Biblio actuelle et contenus débloqués sont toujours présents.
3. Ajouter un déjeuner sans photo.
4. Ajouter un repas avec photo puis fermer/réouvrir l'app.
5. Vérifier la photo dans Ma journée alimentaire.
6. Adapter ce repas et vérifier que la même photo est réutilisée.
7. Ouvrir Historique et revenir sur un ancien jour.
8. Ouvrir une recette > `J'ai mangé cette recette`.
9. Vérifier Mon Équilibre > repère `Alimentation`.
10. Tester iPhone + iPad.
11. Vérifier achats Apple / restauration par non-régression, sans toucher au code StoreKit.
