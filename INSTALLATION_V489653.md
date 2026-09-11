# Patch V489653.1 — Explications factuelles sans répétition

Base : archive Méthode TEE 459. Ce patch contient uniquement quatre fichiers d'exécution, un test et cette notice.

## Installation

1. Décompresser le patch et remplacer les fichiers correspondants à la racine du projet, en conservant les dossiers `scripts` et `www`.
2. Publier les changements sur l'hébergement Web selon votre procédure habituelle. Un upload GitHub seul ne confirme pas que le site est déployé.
3. Pour l'application iOS, depuis le dossier du projet à jour : `npx cap sync ios`, puis tester et compiler dans Xcode selon votre procédure habituelle.
4. Fermer puis rouvrir la rubrique de planification et construire une nouvelle semaine.

Aucun SQL ni nouvelle dépendance. La version commerciale de l'application n'est pas modifiée. Le repère technique du planificateur devient `v4896531` ; son URL de script utilise un nouveau paramètre de version pour éviter la réutilisation de l'ancien script lors du chargement du nouvel HTML.

## Changements

- Suppression des motifs de secours fondés seulement sur le score de familiarité ou l'origine du catalogue.
- Aucun motif générique de budget : cette phrase était déjà absente du code actif du ZIP 459.
- Chaque formulation factuelle est affichée au maximum une fois par semaine. Si elle a déjà été utilisée, le moteur cherche une autre raison disponible et vérifiable ; sinon le bloc est masqué.
- Recalcul des explications à chaque rendu, y compris après remplacement ou annulation. Aucun état de déduplication partagé entre profils ou semaines.
- Même code pour le Web et le miroir iOS `www`.

Le patch ne modifie ni la sélection des repas, ni les prix, ni les calculs du panier, ni les protocoles, ni les données Supabase. Il ne transforme pas une raison manquante en affirmation inventée.

## Vérifications locales réalisées

Depuis la racine du projet :

```sh
node --check scripts/tee-next.js
node qa/test_v489653_raisons_uniques.js
node qa/test_v489652_coherence_semaine_raisons.js
node qa/test_v489651_panier_budget_hybride.js
```

Ces tests passent : trois plats successifs avec les mêmes caractéristiques, absence de remplissage générique, diversité de protéines/féculents documentée, restes liés au lendemain, absence d'état partagé, rendu HTML réel, miroirs Web/iOS, cohérence culinaire et séparation des coûts du panier.

À vérifier après déploiement : construire une semaine, remplacer un plat, annuler un refus et vérifier les actions. Aucun test sur votre Supabase de production ni sur un iPhone réel n'a été effectué ici. Si l'ancienne phrase sur le budget reste visible, vérifier que le nouvel HTML et son script sont effectivement déployés et chargés.

## Micro-correctif V489653.1
La formulation « prolonge un même fil culinaire dans la semaine » est remplacée par « s’inscrit dans un fil culinaire repris cette semaine ». Aucun autre comportement n’est modifié.
