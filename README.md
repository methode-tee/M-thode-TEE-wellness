# Patch V6.4 — Cartes payantes lisibles

Ce patch corrige le problème du menu flottant qui cache le prix, la durée et les infos des cartes payantes.

À faire :
1. Upload `v6-4-fix.css` dans GitHub.
2. Dans chaque page HTML, ajoute cette ligne APRÈS `style.css` :

```html
<link rel="stylesheet" href="v6-4-fix.css">
```

Pages concernées :
- index.html
- protocols.html
- protocol.html
- library.html
- profile.html
- admin.html
- auth.html si tu veux, mais ce n’est pas nécessaire.

Option plus simple :
Copie tout le contenu de `v6-4-fix.css` à la toute fin de `style.css`.
