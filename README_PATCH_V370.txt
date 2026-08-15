PATCH V370 — MON PROTOCOLE EN COURS · PROGRESSION RÉELLE

Base : M-thode-TEE-wellness-main 344.zip

OBJECTIF
Clarifier définitivement :
- Mon parcours = chronologie personnelle
- Mon protocole en cours = protocole réellement suivi
- Reprendre ma lecture = dernier contenu consulté dans Bibliothèque

1) « CONTINUER MON PARCOURS » → « MON PROTOCOLE EN COURS »
Ancien :
- Continuer mon parcours
- Reprendre là où tu t’es arrêtée

Nouveau :
- Mon protocole en cours
- Reprendre là où tu en étais ✶

Le wording est désormais neutre et ne donne plus l’impression que ce bloc est
la rubrique calendrier « Mon parcours ».

2) PLUS DE FAUX 14 % AVANT D’AVOIR COMMENCÉ
Avant :
current_day / total_days

Donc jour 1 sur 7 pouvait afficher 14 % même sans aucune journée validée.

Maintenant :
nombre de completed_days uniques / durée totale

Exemples :
- protocole 7 jours, 0 journée validée = 0 %
- protocole 7 jours, 1 journée validée = 14 %
- protocole 14 jours, 4 journées validées = 29 %
- protocole 14 jours, 14 journées validées = 100 %

Le jour courant reste affiché pour situer la personne dans le protocole,
mais il n'est plus utilisé comme pourcentage d'accomplissement.

3) « PRÊT À COMMENCER » À 0 %
Un protocole débloqué mais sans vraie journée validée affiche :
- Prêt à commencer ✶
- 0 %
- 0 journée complétée sur X
- bouton « Commencer »

Une simple ouverture du protocole ne suffit donc plus à faire croire qu'il est commencé.

4) CHOIX DU PROTOCOLE À REPRENDRE
Suppression complète de la priorité donnée à :
  mt_last_protocol_<user>

Le dernier protocole simplement ouvert sur l'appareil ne choisit plus la carte.

Priorité maintenant :
- protocoles avec vraie progression ;
- tri par last_validated_at ;
- le plus récemment VALIDÉ est repris.

Donc ouvrir un autre protocole quelques secondes « par curiosité » ne remplace plus
le protocole réellement suivi.

5) PROTOCOLE TERMINÉ
Un protocole est considéré terminé si :
- certificate_unlocked = true
OU
- completed_days atteint la durée totale.

Un protocole terminé ne reçoit plus de bouton « Continuer ».
Si un autre protocole est réellement en cours, celui-ci est proposé.
S'il n'y a plus rien à reprendre ni à commencer, le bloc n'affiche aucun faux CTA.

6) SUPABASE / CACHED EGRESS
Ancien :
  protocol_progress.select("*")

Nouveau :
  select(
    protocol_id,
    current_day,
    total_days,
    completed_days,
    last_validated_at,
    updated_at,
    certificate_unlocked
  )

Aucune nouvelle requête.
Aucun Realtime.
Aucun SQL.
Moins de colonnes téléchargées.

7) BIBLIOTHÈQUE
Ancien rayon :
  « Continuer mon parcours »
  « Reprends là où tu t’es arrêtée… »

Nouveau :
  « Reprendre ma lecture »
  « Retrouve le dernier contenu consulté, sans le rechercher dans toute la bibliothèque. »

Ainsi, le dernier contenu consulté ne se confond plus avec la progression d'un protocole.

CACHE
- app.js → v370-protocole-en-cours
- v18-premium.js → v370-protocole-en-cours

SQL
AUCUN SQL À EXÉCUTER.

VÉRIFICATIONS
- Syntaxe Node OK.
- root/www identiques.
- Cache-busting synchronisé sur toutes les pages actives concernées.
- Scénarios 0 %, 14 %, 29 % et 100 % vérifiés.
