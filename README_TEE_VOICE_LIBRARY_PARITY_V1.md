# MÉTHODE TEE — VOICE LIBRARY PARITY V1

Base utilisée : état 500 5 + patch « Photo = pièce jointe uniquement ».

## Objectif
Voice utilise maintenant la MÊME recherche alimentaire que :
- Ma journée alimentaire
- Adapter mon repas

La dictée / RPC Voice reste utile uniquement pour :
- découper la phrase en aliments,
- comprendre les quantités,
- conserver le contexte oral.

L'identité finale des aliments passe par :
`MTFood.searchFoods()` -> `search_foods_v4` puis fallback v3/v2,
exactement comme la recherche du Carnet.

## Comportement utilisateur
Exemple :
« J’ai mangé deux œufs, deux tartines de pain complet et un demi-avocat »

- TEE extrait les 3 éléments.
- Pour chaque élément ambigu, TEE affiche « Lequel ? » avec les résultats de la bibliothèque TEE.
- Une fiche exacte unique peut être sélectionnée automatiquement.
- Le bouton ↔ utilise lui aussi `MTFood.searchFoods()`.
- Aucun aliment différent n'est substitué silencieusement.
- La fiche finale envoyée au Carnet porte le vrai `dictionary_id` / `ciqual_code`.

## Portions naturelles
La quantité parlée est conservée :
- grammes/ml prononcés = exacts ;
- unités naturelles compatibles avec le profil de portion de la fiche = converties ;
- « deux tartines de pain complet » utilise un repère estimatif de tranche de pain (30 g / tranche) au lieu d'exiger arbitrairement des grammes ;
- « deux œufs » et « un demi-avocat » utilisent le profil de portion de la fiche TEE ;
- si aucune conversion fiable n'est possible, TEE demande encore une quantité au lieu d'inventer.

Le repère pain/tranche est aussi ajouté dans `food-core.js`, donc la recherche manuelle du Carnet et Voice partagent la même présentation de portion.

## Fichiers
8 fichiers uniquement.

## Aucun SQL
Ce patch ne nécessite aucun nouveau SQL.

## Après upload GitHub
```bash
git pull --rebase origin main
npx cap sync ios
npx cap open ios
```

Puis relancer Xcode.

## Test principal
Dire :
« J’ai mangé deux œufs, deux tartines de pain complet et un demi-avocat. »

Attendu :
- 3 aliments détectés ;
- si une identité est ambiguë : « Lequel ? » depuis la bibliothèque TEE ;
- aucune quantité en grammes exigée pour les deux tartines si une fiche pain compatible est choisie ;
- la fiche finale est la même que celle qui serait choisie dans Ma journée alimentaire.
