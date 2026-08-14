PATCH V364 — Adapter mon repas : polish complet

Base : M-thode-TEE-wellness-main 339.zip

CORRECTIONS

1. Adoption réellement persistante et visible
- Quand l'utilisateur choisit « J’adopte ces changements », la décision est enregistrée comme avant,
  mais elle devient maintenant visible sur la carte du repas dans « Ma journée alimentaire ».
- Badge discret : « ✶ Ajustement adopté ».
- Lien « Revoir » pour rouvrir exactement les recommandations enregistrées.
- La page de relecture affiche clairement l'état adopté et permet de revenir à la journée
  ou de créer un nouvel ajustement.
- Une nouvelle adaptation ne modifie PAS automatiquement les kcal ni les aliments du repas :
  adopter une suggestion ne veut pas dire que l'utilisateur l'a déjà réellement mangée.

2. Bouton global « Adapter mon repas »
- S'il y a un seul repas : ouverture directe de ce repas.
- S'il y en a plusieurs : mini-sheet premium pour choisir le repas concerné.
- S'il n'y a aucun repas : l'app invite d'abord à enregistrer le repas.
=> Les adaptations créées depuis la journée alimentaire restent reliées au bon repas.

3. « Autre intention » clarifiée
- Le libellé devient « Sans intention particulière ».
- Pas de faux champ libre que le moteur déterministe ne saurait interpréter correctement.

4. Photo clarifiée
- Mention explicite : la photo est un repère visuel.
- Les recommandations reposent sur la description écrite ; aucune fausse promesse d'analyse photo.

5. Reconnaissance burger durcie
- Le moteur ne déduit plus « burger » à partir d'un simple pain + protéine + fromage/sauce.
- Il faut désormais un indice explicite de type burger / hamburger / cheeseburger / bun.
- Évite les faux « Garde ton burger » sur des sandwichs, wraps ou autres repas.

TECHNIQUE / SUPABASE
- Aucun SQL à exécuter.
- Aucun Realtime.
- Pas de nouvelle requête séparée sur « Ma journée alimentaire » :
  le statut d'adaptation est embarqué dans la lecture food_meals existante via la relation FK.
- La relecture détaillée d'une adaptation ne charge ses données que lorsque l'utilisateur appuie sur « Revoir ».
- Cache-busting V364 sur food-day et food-adapter.

FICHIERS
- scripts/food-adapter.js
- www/scripts/food-adapter.js
- scripts/food-day.js
- www/scripts/food-day.js
- styles/food.css
- www/styles/food.css
- food-adapter.html
- www/food-adapter.html
- food-day.html
- www/food-day.html
