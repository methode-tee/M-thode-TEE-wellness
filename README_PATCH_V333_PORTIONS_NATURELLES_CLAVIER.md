# PATCH V333 — Portions naturelles + clavier mobile

Base : `M-thode-TEE-wellness-main 317.zip`

## Corrections

### 1. Quantités alimentaires compréhensibles
CIQUAL reste utilisé uniquement comme moteur nutritionnel en arrière-plan. L'interface ne force plus `100 g` pour tous les aliments.

Exemples pris en charge dans cette première couche :
- burger / hamburger → `1 burger` (conversion interne vers un poids de référence pour le calcul) ;
- œuf → `1 œuf` ;
- banane → `1 banane` ;
- avocat → `½ avocat` par défaut ;
- yaourt / yogourt / skyr → `1 pot` ;
- pain de mie / toast → `1 tranche` ;
- pomme / orange / kiwi → unité naturelle ;
- lait, boisson, jus, eau, soda, café, thé → `ml` ;
- aliments pour lesquels le gramme reste naturel → `g`.

Les portions unitaires sont signalées par `≈` pour les calories, car la conversion vers un poids moyen est une estimation. Les grammes restent la valeur enregistrée dans la base afin de ne modifier aucun schéma Supabase existant.

### 2. Résultats de recherche cohérents
Le résultat de recherche n'affiche plus systématiquement `kcal / 100 g` :
- burger → calories approximatives pour `1 burger` ;
- avocat → calories approximatives pour `½ avocat` ;
- liquide → repère en ml ;
- grammes → repère en g.

### 3. Clavier mobile / Safari
Quand l'utilisateur ouvre un champ de saisie texte sur `Ajouter un repas`, la barre de navigation basse est temporairement masquée. Elle réapparaît automatiquement à la fermeture du clavier / sortie du champ. Cela évite qu'elle remonte au-dessus du clavier sur iPhone Safari/PWA.

## Fichiers modifiés
- `scripts/food-core.js`
- `scripts/food-meal.js`
- `styles/food.css`
- `food-meal.html`
- miroirs équivalents dans `www/`

## Non modifié
- StoreKit / IAP
- Stripe
- validation/restauration Apple
- Product IDs
- architecture achats/déblocages Supabase
- protocoles
- recettes marketplace
- `prewarm.js`
- service worker
- schéma SQL V331

## Test rapide
1. Ouvrir Carnet → Ma journée alimentaire → Ajouter un repas.
2. Chercher `burger` : après sélection, vérifier `1 burger`, pas `100` ni `100 g`.
3. Chercher `avocat` : vérifier `½ avocat` par défaut.
4. Chercher `lait` : vérifier une quantité en `ml`.
5. Chercher `chocolat` : vérifier une quantité en `g`.
6. Toucher la barre de recherche ou le champ « Qu’as-tu mangé ? » : la navbar du bas doit disparaître pendant la saisie puis revenir après fermeture du clavier.
