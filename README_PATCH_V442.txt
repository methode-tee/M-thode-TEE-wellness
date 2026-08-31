MÉTHODE TEE — PATCH V442 · PROFIL + REPÈRES ADAPTATIFS + GARDE-FOUS
Base ciblée : M-thode-TEE-wellness-main 397(3)

ORDRE
1. Si V441 n'a jamais été exécuté dans Supabase, exécuter d'abord :
   supabase/V441_REPERES_PERSONNELS_EVOLUTIFS.sql (présent dans le projet de base).
2. Exécuter ensuite :
   supabase/V442_PROFIL_REPERES_ADAPTATIFS_GARDE_FOUS.sql
3. Copier le reste du patch en conservant strictement l'arborescence.

CE QUI CHANGE
- Profil > Gérer mon espace : « Mon profil » devient la première carte, avant Confiance & Confidentialité.
- Le tracker Évolution corporelle n'est plus obligatoire pour amorcer les repères.
- Mon profil contient : date de naissance, taille, poids de départ, profil affiché, donnée physiologique facultative pour l'équation adulte, activité principale, déplacements, fréquence/durée sportive et intention actuelle.
- IMC calculé automatiquement à partir du poids et de la taille uniquement. Pas de classement rouge/vert ni d'interprétation simpliste.
- Dépense au repos adulte estimée avec Mifflin–St Jeor lorsque les données nécessaires existent.
- Niveau d'activité initial construit à partir du quotidien déclaré ; les pas/activités observés peuvent ensuite l'affiner sans additionner une seconde fois les calories Apple Santé.
- Les profils mineurs ne reçoivent aucun calcul énergétique/protéique basé sur les formules adultes.
- Une donnée nutritionnelle inconnue reste inconnue : plus de faux 0 ni de conclusion « sous le repère » à partir de valeurs non connues.
- Une seule saisie alimentaire ne peut plus être interprétée comme une journée complète pour le recalibrage.
- Recalibrage énergétique : uniquement avec >=10 journées strictement éligibles + plusieurs mesures de poids de part et d'autre + estimation théorique adulte existante. L'observé ne peut jamais créer seul une cible calorique.
- « Adapter mon repas » conserve toujours les propositions culinaires du moteur. Le contexte personnel ne peut plus remplacer les 3 propositions par des conseils généraux ; il peut seulement en modifier l'ordre et ajouter une justification contextuelle.
- Protocoles : « Après » n'apparaît que lorsqu'une fin réelle est enregistrée (certificat ou totalité des jours validés). Une interruption ne crée plus artificiellement une période « Après ».
- Cached egress : aucune nouvelle lecture brute longue. Les 28 jours restent sur les faits quotidiens compacts, les 3 mois sur les agrégats mensuels. V442 invalide seulement le cache serveur une fois pour reconstruire les indicateurs de complétude côté Supabase.
- Politique de confidentialité mise à jour pour les nouvelles données facultatives de profil.

GARDE-FOUS NUTRITION
- « nutrition_days » = journées avec énergie réellement connue.
- « recalibration_days » = journées avec au moins 2 repas enregistrés, tous avec énergie connue et total plausible.
- Les moyennes utilisées pour recalibrer l'énergie utilisent « avg_food_kcal_recalibration », jamais la moyenne d'une journée partielle.
- Une journée sans nutrition connue n'affiche aucune comparaison calorique/protéique/fibres.
- Une journée avec seulement un repas calculé peut afficher son résumé, mais ne déclenche pas de message « tu es sous ton repère ».

FICHIERS MODIFIÉS
- dashboard.html
- food-day.html
- food-adapter.html
- library.html
- privacy.html
- protocol-journey.html
- scripts/app.js
- scripts/food-day.js
- scripts/personal-reference.js
- styles/style.css
- supabase/V442_PROFIL_REPERES_ADAPTATIFS_GARDE_FOUS.sql
- miroirs www/ correspondants

TESTS STATIQUES EFFECTUÉS
- node --check : app.js, personal-reference.js, food-day.js, food-adapter.js, protocol-journey.js
- parité racine / www sur tous les fichiers modifiés
- tests synthétiques : données nutritionnelles inconnues, journée à un seul repas, profil mineur, conservation des 3 propositions culinaires sous signaux multiples.

IMPORTANT
Le SQL n'a pas été exécuté sur ta base Supabase depuis cet environnement. Il doit être appliqué dans ton projet Supabase avant de tester la synchronisation distante des nouveaux champs de profil et les nouveaux garde-fous d'agrégation.
