# PATCH V320 — Journal direct et humeurs neutres

Ce patch applique uniquement deux corrections ciblées :

1. La carte « Écrire aujourd’hui » ouvre directement le journal privé, sans afficher brièvement le calendrier de « Mon parcours ».
2. Les humeurs sont reformulées avec des noms neutres : Sérénité, Énergie, Joie, Fragilité et Fatigue.

Les clés enregistrées en base restent inchangées afin de préserver la compatibilité avec les anciennes entrées.

Fichiers modifiés :
- scripts/app.js
- scripts/journal.js
- styles/style.css
- www/scripts/app.js
- www/scripts/journal.js
- www/styles/style.css

Aucune modification de Supabase, des achats, des protocoles, du numéro de version ou des performances de démarrage.
