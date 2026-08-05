# PATCH V321 — Activités visibles dans le détail du calendrier

Ce patch corrige le détail d'une journée du calendrier.

Avant : une pastille Hydratation, Protocole, Sommeil, Routine ou Rituel pouvait apparaître dans le calendrier, mais l'ouverture du jour affichait « Aucune activité enregistrée ce jour-là ».

Cause : le test d'affichage du contenu ne considérait que Journal, Checklist, Tracker, Photo et Recette.

Après : toutes les activités reconnues par le calendrier sont également reconnues dans la fiche du jour :
- Protocole
- Hydratation
- Sommeil
- Routine
- Rituel
- Checklist
- Tracker
- Journal
- Photo
- Recette

Le patch conserve aussi les corrections V320 déjà intégrées dans ces fichiers (ouverture directe du journal et libellés neutres).

Fichiers modifiés uniquement :
- scripts/journal.js
- www/scripts/journal.js

Aucune modification de Supabase, des achats, du CSS, de la version iOS ou des performances générales.
