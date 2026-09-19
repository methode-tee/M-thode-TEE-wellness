V4896675 — RUNTIME CONTROL + SÉCURITÉ PLANTES DURCIE

Base de travail
- construit à partir du ZIP M-thode-TEE-wellness-main 342(1).zip
- inclut intégralement V4896674 Runtime Control pour « Que manger maintenant ? »
- ajoute V4896675 Phyto Safety Hardening
- aucun SQL à exécuter : la partie Supabase V4896675 a déjà été installée et vérifiée

1. Panne de chargement des règles
- mt_phyto_active_rules_v3() est la source canonique.
- une panne ne devient jamais une liste vide.
- l’UI distingue status=unavailable de status=ok + rules=[]
- aucune liste vide issue d’une panne n’est mise en cache comme résultat sain.
- nouvelle tentative automatique + bouton « Réessayer ».
- pour une suggestion automatique : fail-closed, la suggestion est masquée tant que la sécurité est indisponible.
- si la récupération des identifiants exacts d’un contenu échoue, le contenu est également marqué « vérification indisponible » au lieu d’être considéré comme sans alerte.

2. block_auto réellement appliqué
- nouvelle RPC mt_phyto_blocked_ingredient_ids_v1().
- nouvelle RPC mt_phyto_auto_clearance_v1(uuid[], text[]).
- une identité botanique non résolue bloque aussi la recommandation automatique.
- suggest_botanical_beverage(...) exclut désormais les identifiants bloqués côté serveur.
- une plante block_auto peut rester consultable dans une fiche informative avec son avertissement ; elle n’est plus utilisée dans une suggestion automatique.
- les plantes automatiques du parcours portent data-mt-phyto-auto=1 et passent par la clearance serveur.

3. Reset / profil / compte
- reset() remplace également le WeakMap lastScan.
- suppression et reconstruction des bandeaux.
- remise à zéro du cache de références exactes.
- recalcul après mt:phyto-profile-updated.
- recalcul après mt:account-changed.
- recalcul après SIGNED_IN / SIGNED_OUT / USER_UPDATED.
- tee-next déclenche le recalcul après sauvegarde du profil plantes.

4. Identifiants exacts des plantes sur les contenus
- protocol_contents possède maintenant phyto_ingredient_ids uuid[].
- RPC mt_phyto_content_refs_v1(uuid[]) pour relire les liens exacts.
- app.js, protocol-journey.js et v18-premium.js exposent ces IDs sur les cartes.
- le texte visible reste un fallback complémentaire, pas l’unique source.
- l’admin des contenus permet de rechercher et lier les plantes exactes, notamment pour PDF/audio dont le nom n’est pas visible sur la carte.
- un trigger Supabase refuse les UUID qui ne correspondent pas au catalogue botanique.
- backfill déjà effectué sur les contenus dont le titre/description permettait une identification fiable : 108 guides plantes + 4 PDF.

Vérifications backend effectuées
- mt_phyto_active_rules_v3(): status=ok, 46 règles actives lors du test.
- plante à précaution élevée testée : allow_auto=false ; le compositeur automatique renvoie null si elle est seule.
- nom botanique inconnu : allow_auto=false + unresolved_names.
- « Camomille » résout bien vers Camomille matricaire après ajout de l’alias canonique.
- Runtime Control alimentaire V4896674 reste LIVE, 4 contextes activés.

Fichiers à remplacer dans le projet
- admin.html
- food-day.html
- index.html
- scripts/admin.js
- scripts/app.js
- scripts/food-guidance.js
- scripts/home-smart-cards.js
- scripts/phyto-safety-global.js
- scripts/protocol-journey.js
- scripts/tee-next.js
- scripts/v18-premium.js
- www/admin.html
- www/food-day.html
- www/index.html
- www/scripts/admin.js
- www/scripts/app.js
- www/scripts/food-guidance.js
- www/scripts/home-smart-cards.js
- www/scripts/phyto-safety-global.js
- www/scripts/protocol-journey.js
- www/scripts/tee-next.js
- www/scripts/v18-premium.js

Cache phytothérapie
- scripts/phyto-safety-global.js?v=v4896675-phyto-safety-hardening-r1

Cache alimentaire/runtime control conservé
- v4896674-runtime-control-r1

Ne pas réexécuter d’ancien SQL V4896669 / V4896670 / V4896672 / V4896673.
