# Appliquer le patch V489.5

Copier le contenu de l’archive à la racine du dépôt en conservant les dossiers, puis remplacer les fichiers demandés.

Ensuite :

```bash
npm install
node qa/test_v4895_budget_variety_ux.js
npx cap sync ios
```

Ce patch ne contient aucune migration SQL.
