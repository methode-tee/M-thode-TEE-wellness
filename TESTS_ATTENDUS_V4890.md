# Tests fonctionnels V489.0

## Test A — même profil, budget 30 / 45 / 70
Utiliser le même compte, le même placard, les mêmes exclusions et le mode « Utiliser raisonnablement mon budget ».

Attendu :
- 30 € vise approximativement la zone 20–29 € selon contraintes ;
- 45 € doit exploiter une enveloppe sensiblement supérieure ;
- 70 € doit ouvrir davantage le catalogue ;
- les trois semaines peuvent partager quelques plats, mais pas simplement les mêmes 7 dans un autre ordre ;
- 100 % chiffrable si au moins assez de candidats 100 % existent.

## Test B — régénération
Sans changer aucun champ, cliquer une deuxième fois.

Attendu :
- la composition change grâce à `mt_planner_recommendation_history` ;
- la nouvelle semaine reste cohérente avec le profil ;
- pas de random incohérent : la rotation est déterministe à partir de l'historique.

## Test C — compte vierge vs compte documenté
Même budget et mêmes réglages.

Attendu :
- compte vierge : socle grand public, aucune fausse affirmation sur des habitudes alimentaires ;
- compte documenté : 4–5 choix environ doivent être davantage alignés avec le profil alimentaire lorsque le signal est assez fort ;
- 1–2 respirations plus ouvertes ;
- mêmes repas exacts récents évités.

## Test D — modes budget
À 45 € :
- Économiser au maximum : coût nettement sous l'enveloppe ;
- Utiliser raisonnablement : rapprochement du cœur de l'enveloppe ;
- Variété : plus de diversité et utilisation plus haute de l'enveloppe sans la dépasser.

## Test E — ticket de caisse
Regarder « Formats magasin ».

Attendu : le pourcentage n'est 100 % que si toutes les lignes disposent d'un paquet exact vérifié. Sinon l'app dit explicitement que le reste est basé sur les quantités consommées.
