PATCH V318 — Profil iPad, chemins CSS corrigés

Cause trouvée :
- index.html charge styles/style.css
- www/index.html charge styles/style.css
- le patch V317 modifiait style.css et www/style.css, qui ne sont pas les feuilles utilisées par l'application.

Fichiers à remplacer :
- styles/style.css
- www/styles/style.css

Protection :
- règles uniquement dans @media (min-width: 768px)
- aucun HTML, JavaScript, Supabase ou paiement modifié
- iPhone inchangé
