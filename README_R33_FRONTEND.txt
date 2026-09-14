CP495R33 — FRONTEND FINAL (4 fichiers seulement)

Remplacer uniquement :
- scripts/food-adapter.js
- www/scripts/food-adapter.js
- food-adapter.html
- www/food-adapter.html

Ce patch part directement du ZIP courant « M-thode-TEE-wellness-main 500 2.zip ».
Il conserve R22/R31 et ajoute seulement :
- fallback global des états de cuisson/préparation si la bibliothèque ne trouve rien
  (brocoli rôti -> brocoli, courgette grillée -> courgette, etc.) ;
- cachebuster neuf cp495r33-final-priority pour forcer Safari à charger le JS courant.

La recherche exacte reste prioritaire : « saumon fumé » reste « saumon fumé »
si la bibliothèque sait déjà le reconnaître.
