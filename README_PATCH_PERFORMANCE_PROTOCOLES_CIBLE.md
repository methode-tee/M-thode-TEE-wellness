# Correctif performance ciblé — Protocoles uniquement

Base : 284(2)

Fichiers à remplacer :
- scripts/app.js
- www/scripts/app.js

Aucun SQL à exécuter.

Ce correctif :
- supprime l'attente bloquante des trois premières images du catalogue Protocoles ;
- priorise uniquement la première image ;
- charge les autres images avec le lazy-loading natif ;
- ne modifie pas l'accueil, Recettes, Pharmacopée, prewarm.js ou supabaseClient.js.
