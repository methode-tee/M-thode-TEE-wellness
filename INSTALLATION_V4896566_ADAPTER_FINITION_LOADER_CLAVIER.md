# V4896566 — Adapter mon repas : finitions + chargement journée + clavier iOS stable

Appliquer ce patch par-dessus le ZIP 473 / l'état courant après V4896565.

## Correctifs inclus

### Adapter mon repas
- Une salade générique décrite explicitement par ses composants (ex. salade + tomate + concombre) n'est plus traitée comme un repas complet par simple effet du mot « salade ».
- Pour un déjeuner/dîner de ce type, TEE conserve la base et propose seulement la protéine manquante si elle n'est pas réellement renseignée.
- Une collation simple comme une pomme n'est plus affichée comme « Description trop générale » : elle peut être reconnue comme « Aliment reconnu ».
- Pour une collation, l'ajout protéiné devient facultatif : « La compléter si tu en as besoin » au lieu d'une injonction à corriger la collation.
- Les libellés internes comme « Alimentation day » sont humanisés (« Alimentation du jour »).
- Les formulations de contexte trop techniques (« réordonne », « moteur alimentaire ») sont remplacées par un langage utilisateur.
- Le contexte des repas déjà mangés reste pris en compte pour éviter de reproposer automatiquement la même protéine.

### Ma journée alimentaire
- Le simple texte « Lecture de ta journée… » est remplacé par une transition premium avec jauge/barre animée.
- Cette transition reste visible au minimum 750 ms pour éviter l'effet flash / bug.
- L'historique utilise la même logique de transition.

### Clavier iPhone / Safari
- Suppression du second réajustement de scroll global sur les pages alimentaires après fermeture du clavier.
- food-core.js reste responsable de la visibilité du champ pendant la saisie.
- Résultat attendu : après avoir fermé le clavier, la page ne doit plus « remonter » toute seule 100–220 ms plus tard.

## Non modifié
- aucun SQL
- aucun paiement / checkout / Apple IAP
- aucun déblocage / droit premium
- aucun moteur voix / photo / scan

## Vérifications effectuées
- `node --check scripts/food-adapter.js`
- `node --check scripts/food-day.js`
- `node --check scripts/app.js`
- miroirs root / `www` strictement identiques pour les fichiers modifiés
- `www/scripts/food-day.js` reste complet et non vide

## Test rapide
1. Ouvrir Ma journée alimentaire : la jauge doit être visible environ 0,75 s puis les repas apparaissent.
2. Saisir `Pomme` comme collation puis Adapter : « Aliment reconnu » et conseil facultatif attendu.
3. Saisir `Salade + tomate + concombre` comme dîner : TEE ne doit plus dire « Ne change presque rien » si aucune protéine n'est renseignée.
4. Dans Ajouter/Modifier un repas, ouvrir le clavier sur « Qu'as-tu mangé ? », saisir du texte puis fermer le clavier : aucune remontée retardée de la page ne doit se produire.
