MÉTHODE TEE — PATCH V449
Repères personnels visibles + retour immédiat à l'enregistrement d'un repas
Base : M-thode-TEE-wellness-main 403.zip

CE PATCH CORRIGE
1) « Mes repères personnels » sous « Résumé de ma journée »
- Le bloc n'est plus masqué silencieusement si le RPC des repères est temporairement indisponible.
- Si le moteur répond, le comportement normal reste identique : texte personnalisé + ouverture du sheet détaillé.
- Si le moteur ne répond pas, une entrée compacte reste visible avec « Actualiser mes repères ».
- Le bloc reste réservé à la journée d'aujourd'hui : les journées historiques ne déclenchent pas de lecture serveur supplémentaire.

2) Enregistrer un repas après « Récents / Favoris »
- Le premier tap est désormais immédiatement visible : les deux boutons passent à « Enregistrement… ».
- Protection anti-double lancement : un second tap pendant l'écriture est ignoré.
- iOS dispose de deux frames pour peindre l'état occupé avant les écritures Supabase.
- En cas d'erreur, le bouton retrouve son libellé initial et redevient cliquable.
- En cas de succès, le retour vers la journée alimentaire reste inchangé.

3) Cache-busters
- food-day.js / personal-reference.js / food-meal.js utilisent désormais v449-reperes-save-feedback-r1.
- Cela évite de servir un ancien JS sur le web ou dans un bundle Capacitor après les derniers patchs.

SQL V447 INCLUS POUR COMMODITÉ
Le fichier supabase/V447_CORRECTIF_ENREGISTREMENT_REPAS_100_ARGUMENTS.sql est inclus car il corrige la cause serveur critique :
« cannot pass more than 100 arguments to a function ».
- Si V447 n'a PAS encore été exécuté dans Supabase, exécute-le avant le test final.
- S'il a déjà été exécuté, aucune nouvelle migration SQL n'est nécessaire pour V449.

FICHIERS À REMPLACER
- food-day.html
- food-meal.html
- scripts/food-day.js
- scripts/food-meal.js
- www/food-day.html
- www/food-meal.html
- www/scripts/food-day.js
- www/scripts/food-meal.js

VALIDATIONS EFFECTUÉES
- node --check sur les 4 fichiers JS racine/www.
- Parité racine/www vérifiée pour les deux JS modifiés.
- Cache-busters contrôlés.
- Aucun changement du design du bloc Résumé de ma journée.
- Aucun nouveau polling / realtime / historique brut : pas d'augmentation du cached egress liée à V449.
