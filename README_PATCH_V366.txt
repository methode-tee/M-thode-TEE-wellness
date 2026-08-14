PATCH V366 — MON ÉQUILIBRE · SCORES PLUS EXIGEANTS

Base : M-thode-TEE-wellness-main 341.zip

OBJECTIF
Rendre 80–90 % déjà excellent et réserver 95–100 % aux journées réellement
très complètes et cohérentes, sans baisser artificiellement tous les scores.

1. COURBE DE SOMMEIL PLUS EXIGEANTE
Repères de la composante sommeil :
- 5 h ≈ 35 %
- 6 h ≈ 55 %
- 7 h ≈ 75 %
- 7 h 30 ≈ 88 %
- 8 h = 100 %
- 8 h 30 ≈ 98 %
- 9 h ≈ 94 %
- 9 h 30 ≈ 88 %
Le score redescend progressivement pour les durées très éloignées de la zone optimale.

2. RESSENTIS 1–10 UN PEU PLUS STRICTS
- 8/10 = 74 %
- 9/10 = 86 %
- 10/10 = 100 %
Cela concerne les ressentis utilisés dans Vitalité / Équilibre intérieur :
énergie, récupération, qualité du sommeil, digestion, humeur, etc.
Le stress reste inversé : plus il est faible, plus il soutient le score.

3. HAUT DE L’ÉCHELLE COMPRESSÉ
Le score brut reste pratiquement inchangé jusqu’à 70.
Ensuite :
- 80 brut ≈ 77
- 90 brut ≈ 85
- 95 brut ≈ 91
- 100 brut = 100
=> atteindre 95–100 demande maintenant des composantes presque parfaites.

4. PLAFOND SELON LE NOMBRE DE PREUVES
Vitalité / Équilibre intérieur :
- 1–2 composantes disponibles : maximum 79 %
- 3 composantes : maximum 89 %
- 4 composantes : maximum 95 %
- 5+ composantes : possibilité d’aller jusqu’à 100 %
Une personne ne peut donc plus obtenir 98 % avec seulement deux repères parfaits.

5. MAILLON FAIBLE
Sur les composantes majeures de Vitalité et Équilibre intérieur :
- une composante < 50 % plafonne la jauge à 84 %
- une composante < 30 % plafonne la jauge à 69 %
Une très bonne moyenne ne peut plus masquer un vrai point faible.
Composantes majeures Vitalité : sommeil, énergie, stress, récupération.
Composantes majeures Équilibre intérieur : digestion, humeur, stress.

6. RÉGULARITÉ PLUS DIFFICILE À SATURER
Le dénominateur stable du V365 est conservé.
Un plafond dépend maintenant du nombre de dimensions réellement disponibles :
- seulement 1–2 dimensions : maximum 89 %
- 3 dimensions : maximum 94 %
- 4 dimensions : maximum 97 %
- 5+ dimensions : possibilité de 100 %
Exemple : hydratation + journal parfaits ne suffisent plus, à eux seuls, pour afficher 100 %.

7. LIBELLÉS
Le très haut niveau commence désormais à 85 %.
70–84 % est déjà clairement valorisé comme un bon niveau.
Les anciens seuils qui qualifiaient 75 % directement comme le niveau maximal ont été durcis.

8. HISTORIQUE / SNAPSHOTS
- moteur : VERSION 16
- nouveau snapshot write key V2 pour forcer l’enregistrement du nouveau calcul aujourd’hui
- comparaison hebdomadaire : uniquement snapshots VERSION 16
=> les comparaisons strictement cohérentes avec cette nouvelle formule se reconstruisent
à partir du déploiement V366.

PERFORMANCE
- Aucun SQL supplémentaire.
- Aucun Realtime.
- Aucune nouvelle requête Supabase.
- Aucun historique supplémentaire chargé.
- Cache-busting V366.

IMPORTANT
Le SQL V365 doit simplement rester en place s’il a déjà été exécuté.
Il n’y a AUCUN nouveau SQL à lancer pour V366.

FICHIERS
- scripts/tee-balance.js
- www/scripts/tee-balance.js
- dashboard.html
- www/dashboard.html
- library.html
- www/library.html
