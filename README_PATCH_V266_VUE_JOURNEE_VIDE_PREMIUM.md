# PATCH V266 — Vue « Notre journée ensemble » vide premium

Base utilisée : `M-thode-TEE-wellness-main 265(1).zip`.

## Correctifs

- Masque entièrement la zone membres/progression lorsque la journée ne contient aucun rendez-vous réel : plus de `0 / 0 gestes réalisés`.
- Remplace l’unique grande carte générique « Moment libre » par six cartes compactes correspondant à : Réveil, Matin, Déjeuner, Après-midi, Soir et Nuit.
- Ces six cartes sont purement éditoriales : elles ne se valident pas et ne comptent jamais dans la progression.
- Réaffirme la police serif premium, le poids et l’espacement du titre de la feuille.
- Réduit et adoucit la croix de fermeture.
- Allège les textes des quatre cartes libres sur l’accueil pour éviter les répétitions visuelles.
- Ne modifie aucune requête Supabase, aucun cache, aucun timer et aucun système de paiement/protocole.

## Fichiers à uploader

- `index.html`
- `scripts/daily-journey.js`
- `styles/style.css`
- `www/index.html`
- `www/scripts/daily-journey.js`
- `www/styles/style.css`

Aucun SQL supplémentaire n’est nécessaire.
