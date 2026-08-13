# PATCH V337 — Clavier Carnet aligné sur la logique du Journal privé

Correctif ciblé des pages **Ma journée alimentaire** et **Adapter mon repas**.

## Problème corrigé
Safari réduisait `visualViewport` à l'ouverture du clavier. Le correctif global de l'app répercutait cette hauteur sur `.shell`, ce qui créait un très grand espace vide même lorsque la navbar était masquée.

## Nouvelle logique
- mémorise la hauteur de la page juste avant l'ouverture du clavier ;
- conserve cette hauteur pendant la saisie, comme la vue fixe du Journal privé ;
- masque la navbar pendant la saisie ;
- laisse iOS/Safari déplacer naturellement le champ actif ;
- aucun `scrollIntoView`, aucun spacer, aucun changement de padding ;
- au retrait du clavier, rend la gestion habituelle de la hauteur à `app.js`.

## Fichiers modifiés
- `scripts/food-core.js`
- `food-day.html`
- `food-meal.html`
- `food-adapter.html`
- miroirs correspondants dans `www/`

Aucun changement StoreKit, Stripe, achats, Supabase, CIQUAL, protocoles, préchargement ou service worker.
