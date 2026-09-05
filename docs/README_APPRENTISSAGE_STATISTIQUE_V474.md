# V474 — Apprentissage statistique individuel · note technique

## Moteur prédictif personnel

Méthode : régression ridge multivariée sur variables standardisées, entraînée séparément par compte et par issue. Fenêtre maximale : 90 jours. Les coefficients sont réestimés lorsque les faits individuels ont évolué.

L'imputation des prédicteurs manquants utilise `z = 0`, c'est-à-dire la moyenne personnelle, et non zéro physiologique. La couverture réelle entre dans le score de fiabilité.

## Graphe causal

Les modèles ne découvrent pas librement des liens arbitraires. Les prédicteurs et leurs lags sont pré-spécifiés. La structure sert de garde-fou de sélection et de temporalité ; elle ne transforme pas les données observationnelles en essai randomisé.

## Effet d'intervention

Pour les leviers compatibles, V474 estime un ATT apparié. Les jours d'application explicites sont appariés à des journées pré-intervention proches selon sommeil de la veille, stress de la veille, activité de la veille et niveau précédent de l'issue. Deux voisins au maximum sont retenus par journée appliquée.

L'estimation renvoie effet brut, effet standardisé, dispersion, intervalle indicatif, distance moyenne d'appariement et fiabilité. Ces champs restent internes.

## Seuils de prudence

- modèle ridge : au moins 12 issues observées ;
- prédicteur : couverture minimale adaptative, au moins 8 jours ;
- utilisation forte dans la priorité : fiabilité >= 55 ;
- effet d'intervention : au moins 4 jours appliqués et 8 jours pré-intervention exploitables ;
- absence de check-in = inconnue, jamais « non appliqué ».

## Règle absolue

Les modèles servent à choisir où regarder et quel levier tester. Ils ne posent pas de diagnostic et ne prouvent pas une cause.
