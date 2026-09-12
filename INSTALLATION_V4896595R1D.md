# V4896595R1D — WEB ONLY

Aucun SQL à exécuter.

Base attendue : V4896595R1C déjà auditée avec 3794/3794 profils et 0 fuite critique.

## Remplacer uniquement ces 6 fichiers

- `food-adapter.html`
- `scripts/food-adapter.js`
- `styles/food.css`
- `www/food-adapter.html`
- `www/scripts/food-adapter.js`
- `www/styles/food.css`

## Ce que ce patch change

1. Après « Continuer avec ce repère » / « Obtenir mes ajustements », une animation premium s'affiche immédiatement :
   - voile léger,
   - anneau animé,
   - texte d'étape (« identifie les profils », « vérifie la structure », « finalise »),
   - bouton lui-même en état de chargement.
2. Tous les aliments explicitement confirmés par l'utilisateur sont conservés dans la décision déterministe, même si le RPC n'en renvoie qu'un sous-ensemble dans `selected_items`.
3. Si les aliments confirmés couvrent déjà `protein + starch + vegetable`, Adapter n'ajoute plus de quatrième aliment. Exemple attendu : `Poulet + riz + courgette` => « Garde ton repas comme prévu ».

## Tests rapides

- Macaroni => proposition protéine + végétal.
- Alloco => proposition protéine + végétal.
- Pâtes + poulet + feuilles de salade => aucun autre végétal ajouté si les 3 rôles sont confirmés.
- Poulet + riz + courgette => aucun gnocchi / autre féculent ajouté.
- Sur chaque clic d'analyse/continuer : animation visible immédiatement puis disparition automatique à la question ou au résultat.
