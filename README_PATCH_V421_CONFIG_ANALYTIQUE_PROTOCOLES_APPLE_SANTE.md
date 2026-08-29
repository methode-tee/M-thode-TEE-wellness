# PATCH V421 — Configuration analytique explicite des protocoles
Base vérifiée : `M-thode-TEE-wellness-main 380.zip`
Version applicative conservée : `1.1.0` — build `43`.

## Ce que corrige ce patch

### 1. Chaque protocole possède sa propre lecture analytique
Les protocoles ne reposent plus uniquement sur une grande famille générique. Les protocoles déjà connus sont reconnus explicitement par leur titre/slug et reçoivent leurs propres repères.

Exemples :
- **Pilates** : temps pratiqué · séances réalisées · mobilité/aisance · récupération.
- **Recomposition & Définition** : entraînements · récupération · poids en plage neutre · protéines documentées.
- **Prise de masse / masse saine** : temps d’entraînement · récupération · protéines · poids en plage neutre.
- **Crampes & récupération** : récupération · inconfort musculaire · temps de pratique · pas.
- **Silhouette & Équilibre** : poids en plage · tour de taille en plage · mouvement/pratique · protéines.
- **Ventre plat** : confort digestif · ballonnements · tour de taille neutre · douleurs/crampes.
- **Sommeil profond** : durée · qualité ressentie · état au réveil.
- **Stress & Cortisol / Anxiété & Apaisement** : progression, ressentis et sommeil documenté, sans score de santé.
- **Cycle / Période menstruelle** : énergie · douleurs · sommeil, sans jauge bon/mauvais.
- **Stop Sucre** : envies · journées sans sucre ajouté · alternatives utiles.
- **Jeûne intermittent** : durée · énergie · confort après rupture.
- **Aigreurs & Reflux** : fréquence · intensité · contexte/stress.
- **Anémie / Fer / Micronutrition** : protéines · fibres · micronutriments réellement documentés.
- **Alcool & Équilibre** et **Maux de gorge** : progression/récupération avec sommeil si disponible.

Un filet de sécurité reste présent pour les futurs protocoles, mais les protocoles connus ont une configuration explicite.

### 2. Nouvelle progression commune à TOUS les protocoles
Ajout d’une carte **Ma progression** inspirée de la maquette fournie :
- regroupement par semaines S1, S2, S3… ;
- jour validé ;
- aujourd’hui ;
- jour non validé ;
- jour à venir ;
- streak ;
- nombre de jours validés ;
- date de départ du protocole.

Cette progression est volontairement commune à tous les protocoles. Elle ne remplace pas les balises analytiques propres à chaque protocole.

### 3. Un protocole commencé avant V421 n’est pas remis à zéro
Le calcul reste ancré sur `protocol_progress.started_at`, `current_day` et `completed_days`.
Les validations déjà enregistrées avant la mise à jour restent utilisées dans la grille de progression.

Important : les nouveaux repères analytiques ne fabriquent pas de données historiques. Si un suivi analytique n’existait pas encore à une ancienne date, la progression du protocole reste conservée, mais l’application n’invente pas une mesure pour cette date.

### 4. Apple Santé uniquement quand pertinent
La configuration d’un protocole peut maintenant demander plusieurs familles HealthKit simultanément :
- activité/marche ;
- sommeil ;
- mesures corporelles.

Exemple : **Recomposition & Définition** peut combiner activité + mesures corporelles, tout en gardant les protéines issues du Carnet/CIQUAL.
Les mesures corporelles Apple Santé restent datées : une ancienne mesure n’est pas présentée comme une mesure d’aujourd’hui.

### 5. « Ajouter un suivi » nettoyé
Dans la feuille **Ajouter un suivi**, suppression des boutons **Évolution** placés à côté des suivis actifs et dans les lignes de catalogue. La feuille sert désormais à ajouter, masquer, configurer ou saisir : l’évolution reste accessible depuis les vraies cartes de suivi.

### 6. Invitation Apple Santé sous « + Ajouter un suivi »
Sous le bouton d’ajout, ajout d’un lien fin et premium :
**Compléter automatiquement certains repères avec Apple Santé**

Le lien mène au Profil via `dashboard.html#apple-sante`, fait défiler jusqu’à la carte Apple Santé puis ouvre le panneau de connexion. La connexion reste facultative et en lecture seule.

## Cached egress
Ce patch ne réintroduit pas de chargement global du catalogue alimentaire ou de gros historique au simple affichage.
Les requêtes protocoles restent bornées à la durée du protocole et aux tracker keys réellement nécessaires à sa configuration analytique.
Apple Santé est lue localement sur iPhone.

## SQL
**Aucun nouveau SQL à exécuter pour V421.**
Conserver le SQL V419 déjà exécuté pour la micronutrition.

## Installation
Copier le contenu de ce patch à la racine du projet en écrasant les fichiers correspondants, puis :

```bash
npx cap sync ios
npx cap open ios
```

Pour Git :

```bash
git status
git add .
git commit -m "V421 protocol analytics and Apple Health guidance"
git push
```

## Vérifications réalisées
- `node --check` : `custom-trackers.js`, `healthkit.js`, `protocol-journey.js`, `v18-premium.js`.
- parité racine / `www` vérifiée pour les scripts et `journey.css` modifiés.
- cache-busting V421 appliqué aux pages qui chargeaient les modules V420.
