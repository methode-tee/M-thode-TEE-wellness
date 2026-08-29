# PATCH V428 — Correctif iOS des champs natifs qui dépassent

Base : V427 / projet 384(2) + correctifs précédents. Version applicative inchangée : 1.1.0 build 43.

## Correction unique

Ce patch ne modifie ni le clavier stabilisé en V426, ni le repositionnement après saisie, ni les suivis, ni les protocoles, ni le moteur alimentaire, ni l’admin hors comportement visuel des champs.

Le débordement restant provenait des contrôles natifs Safari iOS `time/date/datetime-local`, dont l’apparence native conserve parfois une largeur intrinsèque supérieure à la zone CSS. V427 bornait la boîte CSS mais ne neutralisait pas cette largeur native.

V428 cible uniquement ces contrôles sur WebKit/iOS :
- suppression de l’apparence native responsable de la largeur intrinsèque (`appearance: none`) ;
- largeur logique forcée à 100 % de la zone disponible ;
- `min-inline-size: 0` / `max-inline-size: 100%` ;
- confinement des champs des suivis ;
- même règle globale pour les formulaires Admin utilisant des champs date/heure.

Le type HTML reste `time`/`date` : le sélecteur iOS continue donc à être appelé au toucher.

## Installation

Aucun SQL. Après upload sur le dépôt :

```bash
cd ~/methode-tee-capacitor
git status
git pull origin main
npx cap sync ios
npx cap open ios
```

Tester en priorité : Carnet > Sommeil approfondi > Heure de coucher / Heure de réveil, puis un formulaire Admin contenant une date ou une heure.
