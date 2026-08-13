# PATCH V340 — consolidation propre après V338

Ce patch est conçu pour être **uploadé PAR-DESSUS un dépôt où V338 a déjà été installé**.
Il n'est pas nécessaire de décider manuellement quoi garder de V338 : les fichiers concernés sont remplacés par cette version consolidée.

## Ce que V340 retire de V338
- Le bloc « Mes repères personnalisés » n'est plus injecté dans **Mon parcours**.
- `personal-trackers.js` est neutralisé pour compatibilité ; il ne fait plus aucune requête et n'affiche plus rien.
- `index.html`, `library.html` et `dashboard.html` sont remis sur la structure saine du ZIP 321(1), avec seulement des versions de cache V340.

## Journal privé
V340 repart du moteur Journal du ZIP 321(1), celui dont le **premier affichage fonctionne**.
Le correctif est volontairement minimal : avant chaque reconstruction de Mon parcours, toute ancienne instance `#jformModal` détachée sous `<body>` est supprimée.
Mon parcours recrée ensuite exactement le formulaire normal, qui est de nouveau déplacé sous `<body>` par la logique iOS déjà existante.

Cela évite le doublon responsable de la croix inactive à la deuxième ouverture, sans transformer le Journal en nouveau singleton ni changer son rendu.

À tester :
1. Profil → Journal privé → fermer.
2. Ouvrir immédiatement Journal privé une deuxième fois → fermer.
3. Refaire plusieurs fois.
4. Répéter depuis Carnet.

## « + Ajouter un suivi »
Le bouton est maintenant dans **Carnet → Mes outils**, après « Trackers & checklists ».

Il ouvre les suivis avancés :
- Sommeil approfondi
- Confort digestif
- Reflux & aigreurs
- Équilibre alimentaire
- Évolution corporelle
- Peau
- Performance sportive
- Football
- Récupération
- Cycle menstruel
- Périménopause & ménopause
- Jeûne intermittent
- Réduction du sucre
- Changer une habitude

## Performance
`custom-trackers.js` n'est PAS présent dans le HTML initial.
Il est téléchargé uniquement au premier tap sur « + Ajouter un suivi ».
Avant ce tap :
- 0 lecture `user_tracker_preferences`
- 0 lecture `user_tracker_entries`
- 0 historique
- 0 Realtime
- aucune modification de `prewarm.js`

Le petit cache local ne contient que les suivis choisis.

## Supabase
Le SQL V338 déjà exécuté reste valable. Ne pas le rejouer si les tables existent déjà :
- `public.user_tracker_preferences`
- `public.user_tracker_entries`

## Fichiers à uploader/remplacer
- `index.html`
- `library.html`
- `dashboard.html`
- `scripts/journal.js`
- `scripts/v18-premium.js`
- `scripts/custom-trackers.js`
- `scripts/personal-trackers.js`
- et leurs miroirs dans `www/`

Aucun fichier n'a besoin d'être supprimé manuellement pour que V340 fonctionne.

## Non touché
- StoreKit 2
- Stripe
- Product IDs
- validation / restauration Apple
- achats Supabase
- déblocage protocoles
- CIQUAL
- moteur alimentaire
- `prewarm.js`
- service worker
