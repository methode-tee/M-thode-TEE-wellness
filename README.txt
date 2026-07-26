PATCH PROTOCOLES — AFFICHAGE IMMÉDIAT — BASE 284(4)

Fichiers à remplacer :
- scripts/app.js
- www/scripts/app.js

Modification strictement limitée à renderProtocolsPage / protocolCard :
- suppression de l'attente de 3 images jusqu'à 2,8 secondes ;
- requêtes protocoles et droits lancées en parallèle ;
- première image prioritaire, suivantes en lazy-loading.

Aucun SQL. Aucun changement de l'accueil, du Journal, de Stripe, de l'admin ou des déblocages.
