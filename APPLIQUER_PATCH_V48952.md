# MÉTHODE TEE — V489.5.2

Correctif frontend uniquement. Aucun SQL.

## Corrige
- Budget équilibré : second passage beaucoup plus large si la première semaine reste sous 78 % du budget.
- Le passage de sauvetage explore jusqu'à 220 candidats et conserve davantage de trajectoires de dépense ; il élimine les états qui ne peuvent mathématiquement plus atteindre le plancher.
- Familles protéiques animales : maximum 2 repas sources par famille, même si le moteur relâche d'autres contraintes de variété. Les restes explicitement demandés restent une exception et ne comptent pas comme une nouvelle recette source.
- Orientation UX : dès le clic sur « Construire ma semaine », Safari/iOS est dirigé vers la zone résultat avec double recalcul de scroll et focus accessible.
- Chargement : animation légère « assiette qui se compose » avec vapeur et ingrédients, dans les codes vert/or de Méthode TEE. Respecte prefers-reduced-motion.

## Fichiers à remplacer
- tee-next.html
- www/tee-next.html
- scripts/tee-next.js
- www/scripts/tee-next.js
- styles/tee-next.css
- www/styles/tee-next.css

## QA synthétique
- 45 € équilibré : 39,65 € ; floor 35,10 € ; 2 poulets max.
- 30 € équilibré : 26,70 € ; floor 23,40 €.
- JS syntax OK ; miroirs HTML/JS/CSS identiques.

## Important
Si aucune semaine respectant simultanément budget, fiabilité et contraintes culinaires n'atteint réellement 78 %, TEE peut encore retourner la meilleure semaine plus basse au lieu d'inventer ou de dégrader les repas.
