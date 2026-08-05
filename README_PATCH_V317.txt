PATCH V317 — Profil iPad uniquement, iPhone inchangé

Fichiers à remplacer :
- style.css
- www/style.css

Correction :
- les titres « Mes contenus », « Observer mon évolution » et « Gérer mon espace » prennent toute la largeur sur iPad ;
- les cartes ne se retrouvent plus décalées à côté des titres ;
- les cartes du suivi personnel se placent naturellement en deux colonnes ;
- les cartes de réglages ne sont plus étirées artificiellement ;
- le bouton Apple et le bloc Version restent à leur emplacement logique en bas.

Protection iPhone :
- toutes les nouvelles règles sont enfermées dans @media (min-width: 768px) ;
- aucun HTML ni JavaScript n'a été modifié ;
- le rendu iPhone (< 768 px) reste strictement régi par le CSS existant.

Performance :
- aucune requête ;
- aucun script ;
- aucun cache ;
- CSS responsive uniquement.
