PATCH V371 — TON JARDIN INTÉRIEUR · PROGRESSION GLOBALE + VRAIES RÉCOLTES

Base : M-thode-TEE-wellness-main 345.zip

IMPORTANT
AUCUNE animation du Jardin n'a été modifiée.
Le patch touche uniquement la logique XP, les niveaux, les récompenses, leur délivrance et leur visibilité.

SQL À EXÉCUTER AVANT LE PATCH
supabase/V371_JARDIN_INTERIEUR_GLOBAL_RECOLTES.sql

1. NIVEAUX
0 XP      Semence
250 XP    Racines
500 XP    Pousse
1 500 XP  Feuillage
4 000 XP  Floraison
8 000 XP  Alchimiste

2. LE JARDIN REPRÉSENTE MAINTENANT TOUTE L'ACTIVITÉ MÉTHODE TEE
- Journal privé du jour : +5 XP, une fois par jour
- Objectif hydratation 2 L atteint : +5 XP, une fois par jour
- Au moins un suivi personnel renseigné : +3 XP, une fois par jour
- Notre journée ensemble entièrement terminée : +5 XP, une fois par jour
- Journée de protocole validée : +10 XP
- Contenu de protocole terminé : utilise réellement xp_points de l'admin ; fallback 5 XP
- Série de 7 jours : +50 XP
- Protocole réellement terminé : +100 XP

Un ledger garden_xp_events empêche de gagner plusieurs fois les mêmes XP en répétant une action.
Les vérifications importantes sont faites côté Supabase, pas seulement dans l'interface.

3. CORRECTION IMPORTANTE DU PROTOCOLE TERMINÉ
Le bonus +100 XP et le certificat ne sont plus déclenchés simplement parce que current_day atteint le dernier jour.
Ils demandent maintenant que le nombre de journées réellement validées atteigne la durée totale.

4. RÉCOMPENSES REFAITES
250 XP — RACINES
Secret du Jardin — fiche Pharmacopée exclusive
→ vraie fiche privée ajoutée à Bibliothèque.

500 XP — POUSSE
Rituel signature TEE
→ vrai rituel privé ajouté à Bibliothèque.

1 500 XP — FEUILLAGE
Mini-protocole exclusif · 3 jours
→ vrai protocole « 3 jours pour retrouver ton rythme » débloqué définitivement.
→ invisible du catalogue avant récolte.
→ après récolte : badge ✶ Récolte du Jardin, Protocoles débloqués, Mon protocole en cours.

4 000 XP — FLORAISON
Collection privée — L'Herbier de Tee
→ 4 contenus réellement ajoutés à Bibliothèque : plante, assiette, récupération, bilan.

8 000 XP — ALCHIMISTE
Le choix de l'Alchimiste
→ ouvre un sélecteur de protocoles payants que la personne ne possède pas encore.
→ le protocole choisi est réellement inséré dans user_protocols et reste acquis.
→ si tous les protocoles actuels sont déjà possédés, la récolte reste disponible pour un futur protocole.

5. « RÉCLAMER » DEVIENT « RÉCOLTER »
Les XP ne sont jamais dépensés.
Une récompense n'est marquée Récoltée qu'après une vraie délivrance Supabase.
Les anciens faux claimed_rewards ne privent personne des nouvelles vraies récompenses : V371 utilise garden_claimed_rewards + garden_reward_claims.

6. MINI-PROTOCOLE EXCLUSIF
Le SQL crée un vrai protocole de 3 jours géré par les tables protocols / protocol_contents :
Jour 1 — Revenir à soi
Jour 2 — Nourrir son rythme
Jour 3 — Ancrer ce qui fait du bien

Il est donc compatible avec le moteur actuel, Mon protocole en cours, la progression V370 et les contenus admin.

7. BIBLIOTHÈQUE
Une petite lecture RPC garden_my_rewards() est faite uniquement quand Carnet/Bibliothèque est ouvert.
Les récoltes 250 / 500 / 4 000 apparaissent dans une étagère : « Mes récoltes du Jardin » et dans leurs catégories normales.
Aucun chargement global supplémentaire au démarrage de l'app.

8. PERFORMANCE / SUPABASE
- Aucun Realtime ajouté.
- XP quotidiens : RPC seulement au moment d'une action éligible.
- Anti-double gain local + contrainte unique côté DB.
- Bibliothèque : 1 RPC compact uniquement sur cette page pour restaurer les récoltes entre appareils.
- Récompenses et XP sont persistants par compte.

9. ANIMATIONS
Aucune fonction d'animation n'a été réécrite ou supprimée.
Les animations existantes restent intactes.

CACHE
Tous les scripts concernés passent en v371-jardin-global.
custom-trackers.js dynamique passe aussi en v371-jardin-global.

VÉRIFICATIONS
- node --check OK sur les 12 fichiers JS root/www.
- copies root/www identiques.
- cache-busting synchronisé.
- récompenses réelles côté Supabase.
