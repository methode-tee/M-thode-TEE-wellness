# PATCH V461 — Cycle 7 jours + réévaluation visible — Méthode Tee

Base : **M-thode-TEE-wellness-main 414.zip**

## Objectif
Faire vivre visuellement et réellement la boucle :
**Observer → Relier → Priorité → Réévaluer**

sans modifier automatiquement les objectifs et sans ajouter de charge Supabase.

## Ce qui change
- Avant 7 journées documentées : **Observer** reste l’étape active.
- À partir de 7 journées, si les données permettent seulement de mettre du contexte mais pas encore de choisir un levier : **Relier** devient l’étape active.
- Lorsqu’un levier est retenu : la carte affiche **Priorité en cours · Jour X/7** avec une progression visuelle sur 7 jours.
- Le même levier reste stable pendant le cycle, pour éviter de changer de conseil au gré d’une seule journée.
- Un signal de récupération peut interrompre un levier moins prioritaire : protection avant optimisation.
- Au **Jour 7/7**, la carte passe réellement à **Réévaluer**.
- La réévaluation compare le point de départ du cycle aux données actuelles : protéines, fibres, sommeil, récupération, stress, digestion, satiété, poids/taille quand disponibles, ainsi que les nouvelles journées documentées.
- La carte indique ensuite soit :
  - que la priorité reste la même ;
  - qu’un nouveau levier devient prioritaire ;
  - ou qu’il manque encore une donnée nécessaire avant de choisir le levier suivant.
- Le lendemain de la réévaluation, un nouveau cycle de 7 jours démarre automatiquement si une priorité actionnable existe.

## Sécurité / architecture
- **Aucune nouvelle table Supabase**
- **Aucun SQL**
- **Aucune nouvelle requête Supabase**
- **Aucune modification automatique des calories ou objectifs**
- Réutilise uniquement les données déjà chargées par le moteur existant.
- La mémoire du cycle de 7 jours est conservée localement sur l’appareil, avec une clé liée au compte quand l’identifiant de session est disponible.
- La vue 90 jours reste analytique et ne pilote pas le cycle d’action courant.

## Fichiers à remplacer
- `scripts/adaptive-reference.js`
- `food-day.html`
- `library.html`
- `www/scripts/adaptive-reference.js`
- `www/food-day.html`
- `www/library.html`

Les HTML ne changent que le cache-busting de `adaptive-reference.js` vers `v461-cycle-7j-r1`.

## Test rapide après upload
1. Ouvrir **Carnet → Mes tendances** ou **Ma journée alimentaire → Mes repères personnels**.
2. Avec moins de 7 journées documentées, vérifier que **Observer** est l’étape active.
3. Quand un levier est disponible, vérifier l’affichage **Priorité en cours · Jour 1/7**.
4. Les jours suivants, la progression doit avancer sans changer de levier sur une variation isolée.
5. Au Jour 7, vérifier **Réévaluation du cycle · Jour 7/7** et le bloc comparant le cycle précédent à la suite proposée.

## Note
Le cycle est volontairement local pour cette V461 afin d’éviter toute migration Supabase et tout risque sur le cached egress. Cela signifie qu’un changement d’appareil ou une suppression du stockage local peut recommencer le compteur visuel du cycle, sans perdre les données santé/nutrition déjà enregistrées dans Supabase.
