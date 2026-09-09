# Historique du planificateur restauré dans le dépôt

Le ZIP 445 ne contenait pas toutes les migrations qui ont construit l'état actuellement présent dans Supabase. Cette archive réintègre les fichiers historiques exacts disponibles dans la session :

1. `V4885_PONT_PLANIFICATEUR_UNIFIE_STRICT.sql`
2. `V48862_SANS_STAGE_RELATION.sql`
3. `V4887_LOT1_PLATS_CULTURELS_STRICTS.sql`
4. `V4888_CULTURES_LOT2_AFRIQUE_MAGHREB_STRICT.sql`

**Production actuelle : ne pas les réexécuter.** Elles sont conservées comme source de vérité/reconstruction et pour qu'un futur audit du dépôt ne dépende plus uniquement de l'état vivant de Supabase.

Pour une nouvelle base vide, elles doivent être replacées dans leur ordre chronologique, après leurs prérequis historiques respectifs. V489.0 exige que l'état V488.8.x soit déjà présent.
