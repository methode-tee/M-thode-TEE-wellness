# Patch V463 — Bibliothèque alignée et version 1.1.2

Base : `M-thode-TEE-wellness-main 416(2).zip`.

## Ce que corrige ce patch

- Les cartes côte à côte de la Bibliothèque ont une hauteur commune.
- Le séparateur inférieur et l’action « Ouvrir » sont alignés sur une même ligne, même lorsque le titre ou l’extrait de gauche est plus court.
- Le correctif reste limité aux rangées horizontales de la Bibliothèque et ne change aucune donnée, aucun achat, aucun protocole et aucune table Supabase.
- La version affichée dans le Profil passe de `1.1.1` à `1.1.2`.
- La version transmise lors d’une suppression de compte passe à `1.1.2`.
- La version native iOS passe à `1.1.2`, build `45`, en Debug et en Release.
- Les références d’assets de la Bibliothèque et du Profil sont renouvelées afin d’éviter l’ancien cache après le déploiement.

## Installation

Décompresser l’archive à la racine du dépôt GitHub et accepter le remplacement des fichiers existants en conservant l’arborescence. Aucun SQL n’est nécessaire.

Après l’upload sur GitHub, lancer le déploiement habituel puis reconstruire/synchroniser le projet iOS avant l’envoi App Store.

## Vérifications effectuées

- Syntaxe JavaScript validée pour `app.js` et `healthkit.js`.
- Copies racine et `www/` strictement identiques.
- Version iOS vérifiée : `MARKETING_VERSION = 1.1.2` et `CURRENT_PROJECT_VERSION = 45` pour les deux configurations.
- Cache-busting vérifié sur `library.html` et `dashboard.html`, racine et `www/`.

