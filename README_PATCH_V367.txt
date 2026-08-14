PATCH V367 — MON PARCOURS · COHÉRENT & OPTIMISÉ

Base : M-thode-TEE-wellness-main 342.zip

1) ALIMENTATION ALIGNÉE AVEC MA JOURNÉE ALIMENTAIRE + MON ÉQUILIBRE
- Le nombre de repas est uniquement descriptif.
- Suppression totale de l’ancienne logique « nombre de repas / 3 ».
- Un repas texte/photo sans food_meal_items affiche « Repères nutritionnels : Non calculés ».
- Plus de « protéines encore peu renseignées » ou d’appréciation nutritionnelle lorsque rien n’a été calculé.
- Si seulement certains repas contiennent des aliments structurés, le détail indique clairement « Partiel · X sur Y ».
- Les protéines/fibres ne sont agrégées que sur les repas réellement calculés.
- La satiété reste un ressenti et peut être affichée même si les nutriments ne sont pas calculés.
- La petite lecture nutritionnelle éventuelle suit la philosophie V365 :
  protéines 45 %, fibres 40 %, satiété 15 %, sans bonus lié au nombre de repas.

2) SOMMEIL = REPÈRE, PAS MISSION
- Suppression de « / 7 h », « Objectif 7 h » et de la coche automatique à 7 h.
- Le Profil / Mon parcours affiche simplement la durée réellement renseignée, ex. « 7 h ».
- Si rien n’est renseigné : « À renseigner ».
- Dans « Ton rituel du jour », le sommeil devient « Durée réellement dormie » sans barre de réussite.
- Aucun seuil universel n’est présenté comme une mission accomplie.

3) ROUTINE DU MATIN
- Suppression du faux compteur « 2 rituels restants / 2 restantes ».
- Tant que la routine n’est pas terminée : « À compléter ».
- Une fois validée : « Complétée ».
- Aucun nombre n’est inventé tant que la routine ne possède pas de sous-étapes réellement comptabilisées.

4) CACHED EGRESS — CALENDRIER MON PARCOURS
- Le chargement mensuel de daily_activity ne fait plus select("*").
- Il demande uniquement les colonnes nécessaires au calendrier.
- tee_balance_snapshot n’est donc plus téléchargé inutilement par Mon parcours.
- Le détail d’un jour reste chargé uniquement lorsqu’on ouvre cette date.
- Aucun Realtime ajouté.
- Aucune nouvelle requête séparée.

5) CACHE-BUSTING
- app.js : v367-parcours-coherent
- journal.js : v367-parcours-coherent
- Toutes les pages actives concernées ont été synchronisées root/www.

SQL
- AUCUN SQL À EXÉCUTER.
- Le SQL V365 déjà en place reste inchangé.

VÉRIFICATIONS
- Syntaxe Node OK sur app.js et journal.js.
- Copies root/www identiques.
- Aucun « / 7 h » ou faux « 2 rituels restants » dans le nouvel app.js.
- Aucune logique repas/3 dans Mon parcours.
- Aucun select("*") sur daily_activity dans le chargement mensuel.
