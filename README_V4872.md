# V487.2 — TEE+ prix RNM + Composer + Sécurité dans Carnet

## Visible dans Profil
Toujours seulement :
- 🥗 Planifier ma semaine
- 🛡 Sécurité plantes

Aucune carte TEE Pro / Recherche.

## Couche prix
Nouvelle couche légère :
- RNM FranceAgriMer au stade détail comme source officielle
- prix administrés Méthode TEE pour les trous
- aucun appel RNM au runtime
- aucun prix manquant remplacé par zéro
- coût recette calculé seulement avec les ingrédients structurés + quantités existantes

## Planifier ma semaine
Le budget intervient réellement quand des prix sont documentés :
- priorité au placard
- exclusions
- restes
- restaurant
- coût documenté des achats manquants
- couverture prix
- liste « À prévoir » avec quantité et coût quand disponibles

## Composer avec TEE
Après une proposition :
- affiche les repères prix disponibles pour « À prévoir »
- bouton « Planifier avec ces aliments »
- les ingrédients déjà saisis sont transférés au placard du planificateur

Composer n'affiche pas de faux total : ses compléments n'ont pas encore de quantité précise.

## Sécurité plantes dans Carnet
La fonction reste dans Profil mais Carnet > Mes outils comporte aussi :
« Sécurité plantes ».
Les deux ouvrent exactement le même moteur / le même profil de garde-fous.

## SQL
Exécuter :
1. V4872_TEE_PLUS_PRIX_RNM_SANS_API_PAYANTE.sql
2. V4872_QA_LECTURE_SEULE.sql

Puis envoie les résultats QA avant validation du frontend.
