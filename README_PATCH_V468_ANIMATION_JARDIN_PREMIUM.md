# PATCH V468 — Animation premium · Ton jardin intérieur

Base : **M-thode-TEE-wellness-main 421.zip**.

## Correctif ciblé

La carte **Ton jardin intérieur** utilisait `reveal visible`, ce qui la rendait immédiatement visible au montage du Profil, contrairement aux sections situées dessous qui utilisent le reveal doux commun de Méthode Tee.

V468 :

- retire uniquement le `visible` forcé sur la carte du Jardin ;
- laisse le même `IntersectionObserver` que les autres éléments du Profil appliquer l'entrée douce existante : opacité + léger déplacement vertical ;
- conserve l'état visible lors d'une actualisation XP afin d'éviter qu'une carte déjà affichée clignote ou rejoue son entrée ;
- ne modifie ni les XP, ni les récompenses, ni Supabase, ni le contenu de la carte ;
- augmente seulement la version de cache de `app.js` dans `dashboard.html` pour que Safari/iPhone charge le correctif.

## Fichiers

- `scripts/app.js`
- `www/scripts/app.js`
- `dashboard.html`
- `www/dashboard.html`

Aucun SQL.
