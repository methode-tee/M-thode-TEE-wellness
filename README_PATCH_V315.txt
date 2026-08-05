PATCH V315 — Bouton Apple sous Notifications + version 1.0.1

Fichiers à remplacer :
- scripts/app.js
- www/scripts/app.js
- ios/App/App.xcodeproj/project.pbxproj

Modifications :
- « Restaurer mes achats Apple » est déplacé sous Notifications et juste au-dessus de la version.
- L'ancien emplacement sous « Gérer mes accès » est supprimé.
- La version affichée dans le Profil passe de 1.0.0 à 1.0.1.
- MARKETING_VERSION iOS passe de 1.0 à 1.0.1.
- CURRENT_PROJECT_VERSION iOS passe de 28 à 29.

Aucun changement sur StoreKit, Supabase, les paiements ou les performances.
