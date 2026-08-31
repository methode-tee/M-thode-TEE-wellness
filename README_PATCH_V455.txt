PATCH V455 — Libellés publics sans clés techniques

Objectif
- Aucun identifiant technique interne ne doit apparaître dans l'interface utilisateur.
- Corrige notamment « beverages » et « daily activity » dans Adapter mon repas.

Modifications
1. Contexte alimentaire
   - beverages -> Boissons
   - daily_activity -> Activité quotidienne
   - food_meals -> Alimentation
   - healthkit -> Apple Santé
   - journal_entries -> Journal & ressentis
   - user_tracker_entries -> Suivis personnels
   - protocol/protocols -> Protocole(s) en cours
   - tous les trackers Méthode Tee connus utilisent leur vrai nom public.
   - un identifiant futur inconnu n'est jamais affiché brut : fallback « Suivi personnel » ou libellé humanisé sûr.
   - les doublons sont retirés : si « Cycle » est déjà affiché comme repère du jour, il n'est pas répété dans la ligne récapitulative.
   - « Suivis renseignés » devient « Repères pris en compte » quand cette ligne complémentaire est utile.

2. Journal / Mon évolution
   - les nouveaux flags has_* inconnus ne sont plus transformés automatiquement en clé technique visible.
   - ils reçoivent un libellé public connu ou « Repère personnel ».

3. Mon Équilibre
   - un tracker futur sans titre public ne peut plus afficher sa clé interne ; fallback « Suivi personnel ».

4. Protocoles
   - les badges de source passent par un filtre public.
   - toute valeur ressemblant à une clé SQL/RPC/snake_case interne est masquée derrière « Méthode Tee ».

5. Cache
   - cache-busters mis à jour sur les pages qui chargent ces modules.

Aucun SQL à exécuter.
