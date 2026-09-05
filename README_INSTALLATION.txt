PATCH V477 — PRÉSENTATION DE PREMIÈRE VISITE
Base : Méthode TEE Wellness V432

INSTALLATION

1. Décompresser ce ZIP.
2. Envoyer tous les fichiers et dossiers contenus dans le patch à la racine du dépôt GitHub.
3. Accepter le remplacement des six fichiers existants.
4. Attendre le déploiement habituel de l’application.

AUCUN SQL À EXÉCUTER.

CE QUE LE PATCH AJOUTE

- Une présentation premium en quatre étapes, affichée sur l’Accueil.
- Une explication simple du rôle des espaces de l’application.
- Une explication de la manière dont les informations renseignées se relient.
- La précision qu’Apple Santé est un complément facultatif.
- Un accès direct au protocole gratuit « Premiers Pas — La Méthode Tee ».

QUI VERRA LA PRÉSENTATION ?

- Seulement une personne qui crée un nouveau compte après l’installation de ce patch.
- Les comptes déjà existants ne la verront pas.
- Les visiteurs non connectés ne la verront pas.
- Elle ne s’affiche qu’une fois par compte.
- Fermer ou passer la présentation la marque comme déjà vue.

CE QUI N’EST PAS MODIFIÉ

- Aucun écran, carte, menu, couleur ou composant existant.
- Aucun protocole, achat, point, progression ou historique.
- Aucune table Supabase et aucune politique de sécurité.
- Aucun contenu du protocole « Premiers Pas ».

TEST CONSEILLÉ

Un compte existant ne doit rien afficher. Pour tester la présentation, créer un compte de test entièrement nouveau après le déploiement du patch, puis arriver sur l’Accueil.

FICHIERS DU PATCH

- auth.html
- index.html
- scripts/app.js
- www/auth.html
- www/index.html
- www/scripts/app.js
