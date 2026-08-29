# PATCH V433 — Accueil : retour en haut stable
Base : `M-thode-TEE-wellness-main 390.zip` · Version 1.1.0 · build 43

Correctif volontairement minimal pour le retour occasionnel de l'Accueil vers une ancienne position (feed / Notre journée ensemble).

## Ce qui change
- Un **appui explicite sur Accueil** sans deep-link réouvre toujours l'Accueil en haut.
- Une ancienne destination de notification restée en attente est nettoyée lors de ce clic explicite.
- Safari/iOS reçoit une restauration de scroll temporairement neutralisée uniquement pendant ce retour Accueil.
- Les vrais deep-links (`mt_post`, `mt_route`, hash) restent inchangés et continuent d'ouvrir leur contenu précis.
- Cache de `scripts/app.js` forcé en `v433-home-top-r1`.

## Ce qui n'a pas été touché
Aucune modification des suivis V432, jauges Mon Équilibre, Apple Santé, calendrier, protocoles, clavier/zoom iOS, notifications, moteur alimentaire, Supabase ou SQL.

## Installation
Aucun SQL.
Après upload GitHub :
```bash
cd ~/methode-tee-capacitor
git status
git pull origin main
npx cap sync ios
npx cap open ios
```

## Test conseillé
Depuis Carnet / Recettes / Profil, faire plusieurs fois **Accueil** : arrivée en haut. Vérifier ensuite qu'une vraie notification/deep-link vers un post continue à ouvrir le post/feed concerné.
