# PATCH V438 — Scanner premium séparé + connexions conservées

Patch cumulatif à appliquer sur Méthode Tee 391(3), reprenant V437.

## Correction UX du code-barres
- La recherche alimentaire reste l'action principale et conserve son rendu.
- **Scanner un produit** ne demande plus jamais de saisir des chiffres : dans l'app iOS il appelle uniquement le scanner caméra natif.
- Sur le web/Safari, si le scanner natif n'est pas disponible, une indication discrète invite à utiliser **Saisir un code**.
- **Saisir un code** est une action séparée et ouvre une feuille Méthode Tee crème/vert/doré, sans `prompt()` système.
- Aucun nom de référentiel nutritionnel ou de service externe n'est affiché à l'utilisatrice.

## Connexions vérifiées
- Sauvegarde d'un suivi -> `daily_activity.has_tracker` + rafraîchissement Carnet/Calendrier + événements `mt:custom-trackers-changed` et `mt:daily-state-changed`.
- Mon Équilibre écoute les changements de suivi et recharge les données du jour de façon ciblée.
- Stress & régulation transmet stress, charge mentale, humeur, énergie, sommeil contextuel et repères HealthKit pertinents.
- Cycle transmet phase/jour/événement et données HealthKit disponibles au résumé quotidien.
- Carnet alimente les analyses nutritionnelles et peut fournir un contexte volontaire aux suivis digestion/reflux/jeûne.
- Mes tendances reste volontairement à la demande et borné afin de préserver le cached egress.
- Le scanner n'ajoute aucune table Supabase et met uniquement en cache local les produits consultés.

## Egress
Aucun SQL, aucune nouvelle table, aucun polling et aucun catalogue externe répliqué dans Supabase.
