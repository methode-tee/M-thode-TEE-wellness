PATCH V444 — MES TENDANCES · WORDING PREMIUM
Base : M-thode-TEE-wellness-main 399.zip

Objectif
- Ne change pas le moteur, les seuils, le SQL, les agrégats ni le cached egress.
- Rend uniquement les textes de « Mes tendances » plus naturels et premium.

Changements
1. État vide 28 jours / 3 mois
Ancien :
« Il faut encore quelques données comparables avant d’afficher une tendance personnelle suffisamment prudente. »
Nouveau :
« Il faut encore quelques journées comparables avant de faire apparaître une tendance personnelle fiable. Continue simplement à renseigner ce qui t’est utile. »

2. Avertissement méthodologique visible
Nouveau :
« Les tendances montrent des associations dans tes données, pas des causes certaines. Seules les journées suffisamment renseignées sont comparées. »

3. Cartes de corrélation
La formulation technique « Association observée ≠ relation de cause à effet » est remplacée par une formulation utilisateur plus naturelle :
« Les tendances montrent des associations dans tes données, pas des causes certaines. »

4. Cache-busting
- custom-trackers.js -> v444-tendances-wording
- v18-premium.js sur library.html -> v444-tendances-wording

Fichiers
- library.html
- scripts/v18-premium.js
- scripts/custom-trackers.js
- www/library.html
- www/scripts/v18-premium.js
- www/scripts/custom-trackers.js

Installation
Remplacer les fichiers en conservant exactement l’arborescence.
Aucun SQL à exécuter.
