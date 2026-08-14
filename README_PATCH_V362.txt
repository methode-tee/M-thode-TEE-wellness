PATCH V362 — Mes suivis : 2 ajustements de cohérence

1. Activité & récupération
- Le menu « Ta pratique aujourd’hui » est désormais adapté à la discipline configurée.
- Yoga / Pilates / marche / mobilité / fitness n’affichent plus « Match / compétition ».
- Football, basketball, tennis, boxe, course, natation et cyclisme conservent des choix compétitifs adaptés.
- Musculation / Autre n’affichent une option compétition que si le rythme configuré est « Compétition ».
- Les anciennes valeurs restent lisibles lors de la consultation d’un ancien jour.

2. Changer une habitude
- « Habitude à faire évoluer » est choisie UNE FOIS lors de l’activation/configuration du suivi.
- Elle est enregistrée dans user_tracker_preferences.settings (JSON existant) : aucun SQL requis.
- Chaque jour, la personne ne renseigne plus que l’état du jour, impulsion, déclencheur, réponse, petite victoire, etc.
- L’habitude suivie reste affichée discrètement en haut du formulaire quotidien.
- Elle peut être modifiée ensuite depuis « Gérer » > « Configurer ».
- Les anciennes entrées restent compatibles.

Technique
- Aucun nouveau tableau Supabase.
- Aucun historique supplémentaire.
- Aucun Realtime.
- Cache-busting V362 pour custom-trackers.js et v18-premium.js.

AUCUN SQL À EXÉCUTER.
