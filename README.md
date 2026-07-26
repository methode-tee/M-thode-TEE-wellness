# Patch admin — suppression des photos d’un post

Base : ZIP 285.

## Fichiers à remplacer
- admin.html
- scripts/admin.js
- www/admin.html
- www/scripts/admin.js

## Fonctionnement
1. Dans Admin > Gérer les posts, cliquer sur Modifier.
2. Les médias actuels apparaissent avec une miniature.
3. Cliquer sur Retirer sur la photo à enlever.
4. Sélectionner éventuellement une nouvelle photo.
5. Cliquer sur Sauvegarder le post.

Le retrait enlève la photo du post et met automatiquement à jour l’image de couverture avec la première image restante. Aucun SQL n’est nécessaire.
