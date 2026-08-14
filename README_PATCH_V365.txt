PATCH V365 — MON ÉQUILIBRE AUJOURD’HUI · CALCULS FIABLES

Base : M-thode-TEE-wellness-main 340.zip

IMPORTANT — SQL À EXÉCUTER AVANT DE TESTER
Exécuter une seule fois :
  supabase/V365_MON_EQUILIBRE_CALCULS_FIABLES.sql

1) Alimentation : plus de faux pourcentage
- Un repas saisi uniquement en texte/photo reste un repas renseigné.
- Mais il ne produit plus de score nutritionnel tant qu’il ne contient pas au moins un food_meal_item.
- Le RPC compact renvoie calculated_meal_count.
- Protéines/fibres sont nulles quand aucun repas n’est réellement calculé, au lieu de 0.
- Mon Équilibre affiche alors « repères non calculés », jamais « équilibre XX % ».
- Le suivi personnel « Équilibre alimentaire » peut toujours nourrir la lecture globale,
  mais il n’est plus présenté comme un calcul CIQUAL.

2) Aucun nombre de repas idéal
- Suppression totale de la logique nombre_de_repas / 3.
- 1, 2, 3 ou 4 repas ne donnent ni bonus ni malus par principe.
- Compatible avec jeûne intermittent, rythmes sportifs et habitudes individuelles.
- Le nombre de repas reste uniquement descriptif.

3) Régularité stabilisée
- Suppression des éléments qui entraient dans le dénominateur seulement après avoir été renseignés
  (repas, actions carnet, suivis personnels).
- Hydratation et journal sont présents dans la base du calcul dès le départ.
- Routine/protocole/missions/journée collective entrent parce qu’ils sont configurés/actifs,
  pas parce que l’utilisateur vient de les compléter.
- Ajouter 25 cl d’eau ou réaliser un repère ne peut donc plus faire chuter la jauge simplement
  parce qu’un nouveau facteur vient d’apparaître.
- Si aucun vrai geste de régularité n’est encore renseigné, la jauge affiche « — / À construire »
  plutôt qu’un faux 0 %.

4) Comparaison hebdomadaire mathématiquement cohérente
- « Aujourd’hui par rapport à toi » compare désormais les vrais snapshots Vitalité / Équilibre intérieur /
  Régularité enregistrés par le même moteur.
- Plus aucune reconstitution simplifiée des jours précédents avec une autre formule.
- Seuls les snapshots V15 sont utilisés : les comparaisons fiables se construiront à partir du déploiement V365.
- Aucun appel Supabase supplémentaire : tee_balance_snapshot est ajouté à la lecture hebdomadaire déjà existante,
  qui reste déclenchée uniquement au clic sur « Voir mon empreinte de la semaine ».

5) Formulations corrigées
- Suppression de « journée alimentaire plus riche ».
- Suppression de « plus basse que ton repère habituel » quand aucune comparaison historique n’a été faite.

PERFORMANCE
- Aucun Realtime.
- Aucun historique chargé au démarrage.
- Aucun nouvel appel réseau pour l’empreinte hebdomadaire.
- Le RPC alimentaire reste une seule lecture compacte.
- Cache Mon Équilibre passé en VERSION 15 et cache-busting V365.

FICHIERS
- scripts/tee-balance.js
- www/scripts/tee-balance.js
- dashboard.html
- www/dashboard.html
- library.html
- www/library.html
- supabase/V365_MON_EQUILIBRE_CALCULS_FIABLES.sql
