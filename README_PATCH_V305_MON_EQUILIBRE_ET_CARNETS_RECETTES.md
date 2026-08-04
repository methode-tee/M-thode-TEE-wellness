# Patch V305 — Mon Équilibre Tee + carnets recettes

Base : M-thode-TEE-wellness-main 304(3).zip

## Ajouts
- Carte quotidienne Mon Équilibre Tee dans Profil, après Écrire aujourd’hui.
- Vitalité, Équilibre intérieur et Régularité calculés uniquement avec les données disponibles.
- Cache local daté, une lecture groupée du journal du jour, aucun polling.
- Drawer détaillé et actions vers les écrans existants.
- Actualisation événementielle après sommeil, missions, journal et Notre journée ensemble.
- Visionneuse recettes : titre réel, bouton Enregistrer en bas, icône Partager en haut.
- Lecture du carnet distincte de l’enregistrement et du partage.

## Fichiers modifiés
- dashboard.html / www/dashboard.html
- scripts/app.js / www/scripts/app.js
- scripts/journal.js / www/scripts/journal.js
- scripts/community-journey.js / www/scripts/community-journey.js
- styles/style.css / www/styles/style.css

## Fichiers ajoutés
- scripts/tee-balance.js / www/scripts/tee-balance.js

## Zones non touchées
StoreKit 2, Stripe, Product IDs, restaurations, user_protocols, authentification, déblocages quotidiens et recettes liées aux protocoles.
