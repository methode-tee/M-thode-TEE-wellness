# V335 — Carnet : ajustement signature + intentions premium + liens Profil + clavier

Base : ZIP `M-thode-TEE-wellness-main 318.zip` fourni par l’utilisatrice.

## Corrections

### 1. Adapter mon repas — « Le choix de Tee »
Les ajustements simples existants sont conservés.
Une recommandation prioritaire supplémentaire est ajoutée sous forme d’un bloc premium « Le choix de Tee ».
Elle est adaptée au type de repas reconnu et à l’intention sélectionnée, avec des propositions concrètes qui gardent le plat central et cherchent à le rendre plus agréable / cohérent plutôt qu’à l’interdire.
Exemples gérés : burger, pâtes, pizza, riz + protéine, salade, absence de végétal ou de protéine.
La recommandation signature est également conservée dans `parsed_items.tee_signature` de `food_adaptations`, sans nouvelle table ni migration SQL.

### 2. Intentions — vocabulaire Méthode Tee
Aucune clé de données n’est modifiée ; seules les formulations visibles changent :
- `prise_masse` → « Nourrir & construire »
- `perte_poids` → « Retrouver de la légèreté »
- `autre` → « Autre intention »
Les anciens termes ne sont plus affichés dans les explications visibles.

### 3. Carnet → Journal privé / Trackers & checklists
Le bug venait du fait que `library.html` n’embarque pas `journal.js`, alors que le Profil (`dashboard.html`) l’embarque.
Le Carnet ne tente plus d’ouvrir le moteur Parcours sur la mauvaise page.
Il redirige maintenant vers `dashboard.html`, puis ouvre automatiquement le même moteur que celui du Profil :
- Journal privé → Mon parcours directement en mode Journal
- Trackers & checklists → Mon parcours normal
Cela réutilise le moteur existant au lieu de le dupliquer.

### 4. Clavier mobile
La navbar est masquée pendant la saisie texte.
Le champ actif est recentré doucement après ouverture du clavier afin d’éviter la grande zone vide observée sur Safari iOS.
Aucune hauteur `visualViewport` n’est forcée.

## Non touché
- StoreKit / IAP
- Stripe
- validation/restauration Apple
- Product IDs
- architecture d’achats Supabase
- déblocages protocoles / recettes
- `prewarm.js`
- service worker
- structure CIQUAL / tables SQL

## Fichiers
- `scripts/food-adapter.js`
- `scripts/food-meal.js`
- `scripts/v18-premium.js`
- `styles/food.css`
- copies équivalentes sous `www/`

## Tests conseillés
1. Carnet → Adapter mon repas → « burger frites » : vérifier les ajustements + « Le choix de Tee ».
2. Vérifier les boutons « Nourrir & construire » et « Retrouver de la légèreté ».
3. Carnet → Journal privé : doit ouvrir le Journal via le moteur Profil sans rester sur « Chargement de ton parcours… ».
4. Carnet → Trackers & checklists : doit ouvrir Mon parcours complet.
5. Ajouter un repas → focus sur description puis recherche : navbar masquée pendant saisie et retour normal après fermeture du clavier.
