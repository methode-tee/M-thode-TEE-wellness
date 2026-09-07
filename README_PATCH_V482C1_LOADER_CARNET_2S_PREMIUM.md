# PATCH V482C.1 — Loader carnet premium · 2 secondes minimum

Cette version remplace V482C si elle n'a pas encore été appliquée.

## Ajustement demandé
- Le loader reste visible **au minimum 2 secondes** même si l'analyse Supabase répond immédiatement.
- Si l'analyse prend plus de 2 secondes, le loader reste affiché jusqu'au résultat réel.
- L'animation d'écriture et la plume sont légèrement ralenties pour que le mouvement soit réellement perceptible.
- Aucun changement SQL, nutrition, Carnet, protocole, progression ou sauvegarde.

## Fichiers à remplacer
- `index.html`
- `www/index.html`
- `scripts/home-smart-cards.js`
- `www/scripts/home-smart-cards.js`

Cache-busting : `v482c1-loader-carnet-2s-r1`.
