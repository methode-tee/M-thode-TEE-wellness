# PATCH V311 — Bouton « Restaurer mes achats Apple »

## Correction appliquée

Le bouton « Restaurer mes achats Apple » n'est plus déclaré dans la page d'accueil.

Il est maintenant créé directement dans la section Profil → Gérer mon espace, juste après la carte « Gérer mes accès ».

## Fichiers à remplacer

- `index.html`
- `scripts/app.js`
- `www/index.html`
- `www/scripts/app.js`

## Ce qui change

- suppression du bloc Apple dans `index.html` et `www/index.html` ;
- ajout du bloc directement dans le HTML dynamique du Profil ;
- suppression du déplacement DOM vers le Profil ;
- conservation de la détection iOS native et de la fonction de restauration existante ;
- le bouton reste caché hors de l'application iOS native.

## Performance

- aucune requête Supabase ajoutée ;
- aucun script ajouté ;
- aucun cache ajouté ;
- aucun changement sur les paiements ou StoreKit ;
- moins de manipulation DOM au chargement qu'avant.

## Vérifications effectuées

- syntaxe de `scripts/app.js` validée ;
- syntaxe de `www/scripts/app.js` validée ;
- aucun bloc `data-mt-apple-restore` restant dans les deux pages d'accueil.
