# PATCH V425 — Studio alimentaire administrable + Admin restructuré

Base de travail : `M-thode-TEE-wellness-main 382(2).zip`
Version applicative conservée : 1.1.0 · build 43

## Objectif

Cette version remplace l'idée d'un recours nécessaire à une IA par un moteur Méthode Tee enrichissable directement depuis l'Admin. Aucun appel Gemini n'est nécessaire pour utiliser V425.

## 1. Admin restructuré

Le Studio Admin n'est plus une longue succession de cartes. Les modules sont maintenant regroupés dans des rubriques repliables avec un sommaire horizontal :

- Aujourd'hui & communauté
- Posts & pages
- Protocoles
- Nutrition & recettes
- Bibliothèque
- Clients & accès
- Outils & réglages si nécessaire

Les formulaires existants sont conservés : la modification est surtout structurelle et visuelle.

## 2. Dictionnaire alimentaire enrichi

Dans Admin → Nutrition & recettes → Dictionnaire alimentaire, Tee peut désormais :

- ajouter un aliment ou un plat ;
- ajouter ses synonymes et sa culture/origine ;
- relier une référence nutritionnelle interne existante ;
- OU saisir directement des valeurs pour 100 g / 100 ml ;
- renseigner calories, protéines, glucides, lipides, fibres et sel ;
- renseigner facultativement fer, calcium, magnésium, potassium, zinc, vitamine C, B9, B12, D et oméga-3 ;
- préciser la source des valeurs et marquer les données comme vérifiées.

Quand une valeur manuelle est renseignée dans le Studio, elle devient calculable dans le Carnet. L'app recalcule automatiquement les valeurs selon la quantité réellement renseignée par l'utilisatrice.

Exemple : 12 g de protéines / 100 g → une portion de 150 g = 18 g de protéines.

## 3. Plats composés, « À prévoir » et conseils

Chaque fiche du dictionnaire peut maintenant contenir :

- un « À prévoir » général ;
- un « À prévoir » différent pour Équilibre, Digestion, Énergie, Nourrir & construire, Retrouver de la légèreté ;
- un Conseil Tee ;
- une Préparation courte préférée ;
- un Choix de Tee ;
- un mode « compléter le moteur » ou « prioritaire pour ce plat ».

Ces données sont lues par :

- Adapter mon repas ;
- Inspiration / Composer avec Tee.

Les règles enregistrées dans l'Admin passent avant les conseils génériques lorsqu'elles correspondent exactement au plat. Le moteur actuel reste le socle et continue de prendre le relais si aucun réglage manuel n'existe.

## 4. Calcul nutritionnel

Un aliment du Studio peut être calculé même sans référence externe existante. `food_meal_items` mémorise désormais aussi son `food_dictionary_id`, ce qui permet au résumé journalier de compter les macros et micronutriments enregistrés par Tee.

Un aliment sans valeurs renseignées reste reconnu comme plat/aliment, mais l'app n'invente toujours aucun chiffre.

Les éléments uniquement proposés dans « À prévoir » ne sont jamais comptés dans le repas tant que l'utilisatrice ne les a pas réellement ajoutés.

## 5. Gemini / IA

V425 ne nécessite aucun branchement Gemini. Les écrans modifiés ici utilisent uniquement le moteur Méthode Tee, le dictionnaire administrable et les règles enregistrées par Tee.

Si un ancien dossier de fonction Gemini existe dans le projet parce qu'un patch précédent a été copié, il n'est pas sollicité par V425 tant qu'aucune intégration n'est activée. Il n'est pas nécessaire pour cette version.

## Installation

### Étape 1 — appliquer les fichiers du patch

Copier le contenu du patch à la racine du projet en conservant l'arborescence.

### Étape 2 — SQL obligatoire une fois

Dans Supabase → SQL Editor, exécuter entièrement :

`supabase/V425_STUDIO_ALIMENTAIRE_ADMIN.sql`

Ce SQL est idempotent et peut être relancé.

### Étape 3 — iOS

```bash
npx cap sync ios
npx cap open ios
```

## Tests conseillés avant soumission

1. Ouvrir Admin et vérifier le nouveau sommaire.
2. Aller dans Nutrition & recettes → Dictionnaire alimentaire.
3. Créer un aliment test avec valeurs pour 100 g et un « À prévoir ».
4. Le rechercher dans Carnet → repas, renseigner une quantité et vérifier le recalcul.
5. Tester le même nom dans Adapter mon repas.
6. Tester le même nom dans Composer avec Tee.
7. Modifier la fiche depuis l'Admin et vérifier que le nouveau conseil remonte sans nouvelle version de l'app.

Aucun nouveau secret, aucune clé API et aucun service IA ne sont requis pour V425.
