# PATCH V310 — Mon Équilibre Tee (final)

## Fichiers à remplacer

Remplacer uniquement :

- `scripts/tee-balance.js`
- `www/scripts/tee-balance.js`

Les deux fichiers sont volontairement identiques.

## Correctifs inclus

- correction de la logique du stress : seul un stress élevé peut désormais déclencher « Besoin de douceur » ;
- vocabulaire Méthode Tee :
  - « Besoin de douceur » ;
  - « Belle disponibilité » ;
  - « Rythme équilibré » ;
  - « Premiers repères » / « À découvrir » ;
- remplacement des symboles décoratifs de Mon Équilibre par l’étoile officielle `✶` ;
- affichage des pourcentages dans les trois anneaux ;
- conseils reformulés autour de l’énergie, de l’hydratation, des repas, de la digestion, du protocole, du rituel, du sommeil, de la marche calme et de l’infusion ;
- libellé hebdomadaire remplacé par « objectifs d’hydratation atteints » ;
- mention finale moins sportive et plus cohérente avec une lecture informative du quotidien ;
- version interne du cache incrémentée afin que les anciens textes ne restent pas affichés après le patch.

## Performance strictement conservée

Ce patch n’ajoute :

- aucune requête Supabase ;
- aucune lecture distante ;
- aucun nouveau script ;
- aucun nouveau cache ;
- aucune table SQL ;
- aucune dépendance ;
- aucune modification des paiements, protocoles ou déblocages.

Le bilan hebdomadaire reste chargé uniquement au clic, comme avant.

## Vérification effectuée

- syntaxe JavaScript validée avec `node --check` ;
- fichiers racine et `www` identiques ;
- anciens termes sportifs retirés ;
- ancienne condition inversée du stress retirée.
