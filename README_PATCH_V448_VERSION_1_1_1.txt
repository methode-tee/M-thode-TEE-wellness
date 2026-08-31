MÉTHODE TEE — PATCH V448 — VERSION 1.1.1
Base : M-thode-TEE-wellness-main 402(1).zip

Objectif
- Harmoniser la prochaine version publique à 1.1.1.
- Garder le profil utilisateur, les métadonnées internes et le projet iOS sur la même version.

Vérifié / corrigé
- Profil : Version 1.1.1.
- Xcode MARKETING_VERSION : 1.1.1 (Debug + Release).
- Xcode CURRENT_PROJECT_VERSION : 44 (Debug + Release).
- Métadonnée envoyée lors de la suppression de compte : app_version 1.1.1.
- En-tête du module HealthKit harmonisé en 1.1.1.
- Racine et www synchronisés.

Aucun SQL à exécuter pour ce patch.

Installation
1. Copier le contenu du patch à la racine du projet en conservant l'arborescence.
2. git add . && git commit -m "V448 version 1.1.1"
3. git pull --rebase origin main (résoudre tout conflit avant de poursuivre)
4. git push origin main
5. npx cap sync ios
6. open ios/App/App.xcworkspace
7. Dans Xcode, vérifier Version 1.1.1 et Build 44 avant l'Archive.
