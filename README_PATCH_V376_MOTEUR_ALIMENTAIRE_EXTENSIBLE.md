# MÉTHODE TEE — PATCH V376
## Moteur alimentaire extensible

Base : `M-thode-TEE-wellness-main 353.zip`

## Ordre d’installation

1. Exécuter `supabase/V376_MOTEUR_ALIMENTAIRE_EXTENSIBLE.sql` dans Supabase SQL Editor.
2. Attendre `Success. No rows returned`.
3. Uploader ensuite les fichiers du patch en conservant leurs dossiers.

Le SQL est idempotent : il peut être relancé sans dupliquer le catalogue.

## Ce que cette version change

- `ciqual_foods` reste la source des valeurs nutritionnelles.
- `food_dictionary` devient la source de compréhension des aliments et plats.
- toutes les anciennes lignes `TEE-*` ou `METHODE_TEE` déjà présentes uniquement dans `ciqual_foods` sont migrées automatiquement vers le dictionnaire et conservent leur code nutritionnel ;
- La recherche utilise `search_foods_v2` avec classement métier et normalisation.
- « Qu’as-tu mangé ? » utilise `resolve_food_text` sans modifier le texte saisi.
- « Adapter mon repas » donne la priorité aux lignes réelles de `food_meal_items`, puis au dictionnaire, puis au lexique local de secours.
- Les plats à composition variable ne reçoivent aucune composition inventée.
- Les petits-déjeuners et collations sucrés ne reçoivent plus automatiquement une suggestion de légumes.
- Les redondances sont détectées, notamment plusieurs sources protéinées.
- Un plat reconnu mais non relié à CIQUAL ne reçoit aucune macro inventée.

## Admin

Nouvelle rubrique « Dictionnaire alimentaire » :

- ajout et modification ;
- activation / désactivation ;
- alias, pays, région et culture ;
- lien vers un code CIQUAL ou `TEE-*` ;
- catégories, contextes et composants ;
- composants certains / facultatifs ;
- profil Adapter ;
- prévisualisation de recherche et d’adaptation ;
- détection des doublons par nom normalisé.

Après V376, un nouveau plat correctement renseigné dans l’admin devient disponible sans rebuild iOS.

Les anciens plats ajoutés par SQL dans `ciqual_foods` n'ont pas besoin d'être recréés : le SQL V376 les récupère automatiquement. Les plats déjà documentés dans V376 gardent leur profil détaillé ; les autres reçoivent un profil prudent « composition variable » qui évite les affirmations et les suggestions automatiques de légumes, puis peuvent être précisés depuis l'admin.

## Performances

- aucune utilisation de Realtime ;
- aucun téléchargement global du dictionnaire ;
- recherche à partir de 3 caractères, debounce 350 ms, 10 résultats maximum ;
- description libre stabilisée 500 ms ;
- une seule résolution compacte au clic sur Adapter ;
- cache de session non personnel ;
- aucun résultat vide n'est mis en cache et les connaissances expirent après 5 minutes, afin que les ajouts admin apparaissent rapidement sans rebuild ;
- aucune table de recherches sans résultat activée.

## Fichiers modifiés

- `food-meal.html` et `www/food-meal.html`
- `food-adapter.html` et `www/food-adapter.html`
- `admin.html` et `www/admin.html`
- `scripts/food-core.js` et `www/scripts/food-core.js`
- `scripts/food-meal.js` et `www/scripts/food-meal.js`
- `scripts/food-adapter.js` et `www/scripts/food-adapter.js`
- `scripts/admin.js` et `www/scripts/admin.js`
- `supabase/V376_MOTEUR_ALIMENTAIRE_EXTENSIBLE.sql` et sa copie `www`

## Conservé à l’identique

- calculs actuels des repas et portions ;
- photos de repas ;
- ressentis facultatifs ;
- « Ajustement adopté » ;
- Carnet, Mon parcours et Mon Équilibre ;
- V373 Feed, V374 Offert par Tee et V375 Bibliothèque épurée ;
- style général, navbar et animations.
