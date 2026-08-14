PATCH V369 — JOURNAL PRIVÉ UNIFIÉ

Base : M-thode-TEE-wellness-main 343.zip
Ce patch REMPLACE / SUPPLANTE V368. Si V368 n'a pas encore été appliqué,
il suffit d'utiliser V369 + son SQL.

IMPORTANT — SQL
Exécuter une seule fois :
  supabase/V369_JOURNAL_UNIFIE.sql

Le SQL est idempotent : il fonctionne aussi si le SQL V368 a déjà été exécuté.

1) UNE SEULE EXPÉRIENCE « JOURNAL PRIVÉ »
- Le stockage journal quotidien / ressentis de protocole reste séparé techniquement
  pour empêcher les écrasements.
- Côté utilisateur, tout fait désormais partie du Journal de la même journée.
- Ouvrir Journal privé depuis Carnet charge :
  • l'écriture personnelle ;
  • l'état / humeur ;
  • les repères 1–10 réellement renseignés ;
  • les ressentis écrits dans les protocoles ce même jour.
- Les ressentis de protocole apparaissent sous l'espace personnel dans une section
  « Mes ressentis de protocole ».
- Chaque bloc conserve son origine :
  « ✶ Ressenti du protocole · Jour X », nom du protocole, puis nom du contenu.
- Aucun texte personnel n'est recopié ou fusionné dans un autre champ.

2) MON PARCOURS
- Plus de badge donnant l'impression qu'il existe un second journal.
- Une seule entrée « Journal » résume les contributions de la journée.
- Dans la section Journal privé, les ressentis de protocole apparaissent après
  l'écriture personnelle.
- Mention « Fait partie de ton journal du jour ».
- Si la personne n'a écrit que dans un protocole, le bouton devient
  « Compléter mon journal ».

3) ORIGINE DU PROTOCOLE
- Les nouvelles sauvegardes mémorisent séparément :
  • protocol_title
  • journal_title
  • protocol_day
- Exemple d'affichage :
  ✶ Ressenti du protocole · Jour 4
  Jeûne intermittent
  Apprivoiser la faim

4) MON ÉQUILIBRE : RESSENTIS DE PROTOCOLE UTILES
- Mon Équilibre peut maintenant utiliser un ressenti de protocole UNIQUEMENT
  lorsqu'il s'agit d'un signal réellement exploitable.
- Aucun texte libre n'est analysé.
- Pour être utilisé, il faut :
  • une question clairement liée à Stress, Énergie, Digestion, Sommeil ou Humeur ;
  • une réponse strictement numérique de 1 à 10 / « X/10 ».
- Les questions ambiguës ou inversées (douleur, fatigue, reflux, difficulté de sommeil,
  etc.) sont volontairement ignorées.
- Le journal quotidien reste PRIORITAIRE.
  Exemple : si Stress a été renseigné dans le journal quotidien, un stress de protocole
  ne le remplace pas.
- Si plusieurs protocoles fournissent le même signal le même jour et qu'aucune valeur
  quotidienne n'existe, le résumé utilise leur moyenne.

5) PERFORMANCE
- Mon Équilibre ne gagne AUCUNE requête réseau supplémentaire :
  l'ancienne lecture journal_entries d'aujourd'hui est remplacée par un seul RPC compact
  journal_balance_summary().
- L'ouverture du Journal privé charge les ressentis de protocole uniquement à la demande,
  quand l'utilisateur ouvre cette date.
- Aucun Realtime.
- Aucun historique protocole chargé au démarrage.

6) CORRECTIONS V368 CONSERVÉES
- Aucun faux 5/10 : « — Non renseigné » tant que le curseur n'est pas touché.
- Brouillon local automatique pendant l'écriture.
- Journal quotidien non rattaché artificiellement au protocole actif.
- Pas de requête protocol_progress lors de l'enregistrement du journal quotidien.
- « Comment je me sens ? » et « Ma phrase à retenir » conservés.

7) CACHE / HISTORIQUE
- tee-balance VERSION 17.
- Nouveau snapshot V3 pour les calculs intégrant éventuellement les signaux de protocole.
- Cache-busting V369 sur journal.js, v18-premium.js et tee-balance.js.

FICHIERS PRINCIPAUX
- scripts/journal.js + www/
- scripts/v18-premium.js + www/
- scripts/tee-balance.js + www/
- pages HTML de cache-busting
- supabase/V369_JOURNAL_UNIFIE.sql
