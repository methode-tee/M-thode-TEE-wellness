# Patch V386 — Bilan de Mon Équilibre

Base : ZIP 357.

## Ajout

- Deux périodes dans `Carnet → Mon Équilibre → Voir mon empreinte de la semaine` :
  - `Cette semaine` ;
  - `Depuis 28 jours`.
- Le bilan 28 jours affiche séparément la vitalité, l’équilibre intérieur et la régularité.
- Les courbes apparaissent seulement à partir de trois journées comparables.
- Le bilan reprend aussi l’hydratation, le sommeil, les routines et le nombre de jours où un contenu de protocole a déjà été validé.
- Une observation prudente et une priorité pour la suite sont affichées sans diagnostic ni causalité affirmée.

## Protection des protocoles

- Aucun changement du déblocage à 7 h.
- Aucun changement de la progression, des achats ou du statut terminé.
- Le bilan lit les validations existantes mais ne les modifie jamais.

## Performance et cached egress

- Aucun chargement au démarrage de l’application.
- Chargement uniquement à l’ouverture volontaire du bilan.
- La requête compacte 28 jours déjà utilisée par l’empreinte hebdomadaire est réutilisée.
- Aucun appel Supabase supplémentaire lors du passage de 7 à 28 jours.
- Résultat conservé localement pendant 10 minutes.
- Aucune donnée CIQUAL, image ou contenu complet de protocole n’est chargé.

## Installation

Décompresser à la racine du projet et remplacer les fichiers en conservant les dossiers.
Aucune migration SQL n’est nécessaire.
