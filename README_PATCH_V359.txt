PATCH V359 — Hydratation fluide, flexible et connectée
Base : M-thode-TEE-wellness-main 334.zip

CORRECTIONS
- Appuyer sur Hydratation n’ajoute plus automatiquement 25 cl.
- Une mini-feuille premium permet de choisir : +10, +15, +20, +25, +33 ou +50 cl.
- Une quantité personnalisée en cl peut être saisie (ex. 12 cl, 18 cl, etc.).
- L’ajout est optimiste : la valeur, la barre et l’état de la mission changent immédiatement.
- La sheet « Ton rituel du jour » n’est plus reconstruite après chaque ajout : aucun retour en haut, aucun flash de chargement.
- Même correction de stabilité pour le sommeil et les autres missions : leur validation ne remonte plus la sheet en haut.
- Hydratation est synchronisée avec daily_activity, Mon Équilibre, le calendrier/Carnet et les repères Profil via l’état quotidien partagé.
- has_hydration signifie désormais qu’une quantité > 0 a été renseignée ; la mission Hydratation n’est considérée terminée qu’à partir de 2 L.
- La lecture locale daily_activity suit bien le stockage privé par user_id introduit en V358.
- Le suivi peut conserver une quantité réelle au-delà de l’objectif 2 L (barre visuelle plafonnée à 100 %, donnée conservée jusqu’à 6 L).
- Aucun nouveau chargement historique, aucun Realtime, aucune nouvelle lecture Supabase lors d’un ajout d’eau.
- Cache-busting uniforme v359 sur les pages qui chargent app.js / styles/style.css.

AUCUN SQL À EXÉCUTER.

Fichiers modifiés :
- protocols.html
- protocol-journey.html
- protocol.html
- onboarding.html
- food-meal.html
- dashboard.html
- library.html
- admin.html
- page.html
- checkout.html
- auth.html
- food-day.html
- food-adapter.html
- index.html
- www/protocols.html
- www/protocol-journey.html
- www/protocol.html
- www/onboarding.html
- www/food-meal.html
- www/dashboard.html
- www/library.html
- www/admin.html
- www/page.html
- www/checkout.html
- www/auth.html
- www/food-day.html
- www/food-adapter.html
- www/index.html
- scripts/app.js
- scripts/journal.js
- styles/style.css
- www/scripts/app.js
- www/scripts/journal.js
- www/styles/style.css
