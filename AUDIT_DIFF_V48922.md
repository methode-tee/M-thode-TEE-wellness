# Audit V489.2.2

## Défaut réellement identifié dans V489.2.1

La rotation V489.2.1 reposait encore principalement sur une **pénalité de score** :

- `recommendationPenalty()` pouvait descendre un plat déjà vu ;
- mais ce plat restait éligible ;
- l'expansion du beam privilégiait encore les mêmes meilleurs candidats ;
- le bruit déterministe de génération n'était que ±0,35 point.

Résultat : si le noyau 100 % chiffrable était nettement meilleur que le reste, les mêmes aliments pouvaient revenir à chaque clic.

## Correction

V489.2.2 mémorise explicitement la dernière génération et applique une contrainte :

- maximum 2 recouvrements avec la semaine précédente si 7 alternatives fiables existent ;
- 3 si le pool est plus étroit ;
- jusqu'à 5 seulement en dernier recours pour éviter un échec complet.

Les composants CIQUAL reçoivent aussi une mémoire propre afin qu'une assiette dynamique ne contourne pas la rotation simplement en changeant un seul des trois éléments.

## Correction culinaire

La classification backend intercepte maintenant `fromages`, `yaourts`, etc. **avant** les mots marketing tels que « spécial pâtes ».
Le frontend interdit également tout laitage comme pilier majeur de l'assembleur.

## Inchangé

- univers CIQUAL complet ;
- 100 % chiffrable prioritaire ;
- budget global ;
- 1 culturel spécifique maximum ;
- sécurité phyto ;
- paiements ;
- recettes/protocoles ;
- mémoire holistique historique.
