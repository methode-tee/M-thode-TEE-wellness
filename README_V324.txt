PATCH V324 — JOURNAL VRAIMENT PLEIN ÉCRAN SUR iOS

Cause corrigée
Le formulaire Journal était rendu à l’intérieur du drawer « Mon parcours ».
Sur iOS/WKWebView, un élément position:fixed contenu dans un parent transformé
et scrollable n’est plus fixé à la fenêtre : il est découpé par le parent.
C’est pourquoi le formulaire s’ouvrait directement au milieu, même avec scrollTop=0.

Correction
- Le modal #jformModal est déplacé dans document.body au moment de l’ouverture.
- La sheet est alors réellement fixée au bas de tout l’écran.
- Le haut du journal (titre, date et humeurs) devient visible.
- Le défilement vertical reste fonctionnel.
- Les corrections V320–V323 et les détails du calendrier sont conservés.

Fichiers
- scripts/journal.js
- www/scripts/journal.js
- styles/style.css
- www/styles/style.css

Aucun changement Supabase, achats, protocoles ou performances.
