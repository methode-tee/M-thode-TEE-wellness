# PATCH V260.4 — Moments libres sur l’accueil

Base utilisée : `M-thode-TEE-wellness-main 260(2).zip`.

## Comportement ajouté

- La grille d’accueil conserve toujours exactement 4 cards en 2 × 2.
- Les rendez-vous publiés occupent leurs cards normales.
- Les emplacements restants deviennent des cards discrètes « Moment libre ».
- Si la journée est entièrement vide, les 4 cards affichées sont :
  - Matin libre
  - Déjeuner libre
  - Après-midi libre
  - Soirée libre
- Les cards libres ne comptent jamais dans la progression.
- Aucun `0 / 0 gestes réalisés` n’est affiché quand aucun rendez-vous réel n’existe.
- Le compteur communauté et la progression sont masqués quand la journée est entièrement vide.
- Les cards « Moment libre » ouvrent la page détaillée au clic.
- Aucun SQL supplémentaire n’est nécessaire.

## Fichiers à uploader

- `scripts/daily-journey.js`
- `www/scripts/daily-journey.js`
- `style.css`
- `www/style.css`
- `www/styles/style.css`

## Systèmes non modifiés

Aucun changement sur StoreKit 2, Stripe, Apple IAP, restaurations, Product IDs, protocoles, recettes, `user_protocols`, déblocages quotidiens, authentification ou notifications natives.
