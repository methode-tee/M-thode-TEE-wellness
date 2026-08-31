PATCH V443 — Correctif affichage mobile « Mon profil »
Base : M-thode-TEE-wellness-main 398(1).zip

But
- Corriger le panneau « Mon profil » qui pouvait dépasser au-dessus de l'écran sur iPhone lorsque son contenu est plus haut que la fenêtre visible.

Changements
- Le panneau conserve le même design et le même contenu.
- Hauteur maximale bornée à la hauteur dynamique de l'écran (100dvh lorsque disponible, fallback 100vh).
- Prise en compte des safe areas iOS en haut et en bas.
- Défilement vertical interne du panneau avec inertie iOS.
- Aucun contenu du formulaire supprimé ou raccourci.
- Le bouton « Enregistrer mon profil » reste accessible en faisant défiler le panneau.
- Cache-buster CSS du dashboard mis à jour afin d'éviter que Safari conserve l'ancienne feuille de style.
- Racine et dossier www synchronisés.

Fichiers à remplacer
- dashboard.html
- styles/style.css
- www/dashboard.html
- www/styles/style.css

SQL
- Aucun SQL à exécuter pour V443.
- Ne pas réexécuter V441/V442 uniquement pour ce correctif visuel.
