# PATCH V460 — Moteur adaptatif Méthode Tee · V1

Base utilisée : `M-thode-TEE-wellness-main 413.zip` fourni par l’utilisatrice.

## Objectif

Faire passer les repères personnels existants d’une simple lecture de valeurs à une **lecture décisionnelle Méthode Tee** :

**Observer → Relier → Prioriser → Réévaluer**

Le moteur choisit volontairement **un seul levier prioritaire à la fois**. Il ne copie pas un moteur « calories + poids » : il remet les apports dans le contexte de la récupération, du sommeil, du stress, des protéines, des fibres et de l’évolution corporelle déjà documentée.

## Ce que V460 ajoute

### 1. Lecture adaptative V1
Nouveau module : `scripts/adaptive-reference.js`

Décisions possibles :
- Historique encore insuffisant → aucun ajustement.
- Priorité récupération & rythme.
- Priorité protéines & structure des repas.
- Priorité fibres / densité nutritionnelle, avec progression plus douce si la digestion renseignée est fragile.
- Maintenir quand l’évolution corporelle est déjà cohérente.
- Maintenir quand le poids est stable mais que le tour de taille baisse sur les mesures comparables.
- Vérifier les mesures avant tout ajustement si une variation corporelle est trop importante pour être interprétée proprement.
- Repère énergétique à réévaluer seulement **après** avoir vérifié récupération, protéines et structure alimentaire.
- Maintenir et continuer à observer quand aucun signal suffisamment solide ne justifie un changement.

### 2. Un seul levier à la fois
La carte utilisateur affiche explicitement :
- ce que Méthode Tee a observé ;
- ce qu’elle relie ;
- la priorité actuelle ;
- ce qui est proposé pour les 7 prochains jours ;
- les données réellement disponibles qui soutiennent la lecture.

### 3. Aucun changement automatique des objectifs
V460 **ne modifie jamais** automatiquement :
- la cible calorique ;
- les protéines ;
- les fibres ;
- le profil ;
- un objectif corporel.

Un « repère énergétique à réévaluer » reste une proposition prudente. L’app demande de confirmer la tendance avec des journées comparables avant toute modification future.

### 4. Garde-fous
- Les calculs énergétiques adultes restent désactivés pour un profil mineur.
- Moins de 7 journées documentées : aucune décision adaptative forte.
- Les données manquantes ne sont jamais transformées en zéro.
- Une variation corporelle très importante n’est jamais utilisée comme base d’un recalibrage automatique.
- Les associations observées ne sont jamais présentées comme une cause certaine.

### 5. Intégration dans l’interface existante
La lecture adaptative apparaît :
- dans la fiche **Mes repères personnels** ouverte depuis le résumé nutritionnel de la journée ;
- dans **Carnet → Mes tendances**.

Dans Mes tendances 28 jours, le moteur réutilise les lignes compactes déjà chargées et peut donc reconnaître le cas « poids plutôt stable + tour de taille en baisse » sans télécharger un historique supplémentaire.

## Protection egress / Supabase

**Aucun SQL. Aucune nouvelle table. Aucun nouvel appel Supabase ajouté par le moteur adaptatif.**

V460 réutilise exclusivement :
- le modèle `MTReference` déjà chargé ;
- le résumé compact 28 jours déjà disponible ;
- les lignes compactes déjà chargées par `Mes tendances` lorsqu’elles existent.

Il n’y a donc pas de nouvelle lecture d’historique brut, pas de pagination supplémentaire et pas de stockage serveur ajouté.

## Fichiers à remplacer / ajouter

### Racine
- `library.html`
- `food-day.html`
- `scripts/adaptive-reference.js` **(nouveau)**
- `scripts/custom-trackers.js`
- `scripts/v18-premium.js`

### Miroir `www/`
- `www/library.html`
- `www/food-day.html`
- `www/scripts/adaptive-reference.js` **(nouveau)**
- `www/scripts/custom-trackers.js`
- `www/scripts/v18-premium.js`

## Installation

1. Uploader les fichiers du patch en conservant exactement leur arborescence.
2. Remplacer les fichiers existants lorsqu’ils existent.
3. Ajouter `adaptive-reference.js` aux deux emplacements indiqués.
4. Aucun script SQL à exécuter.

## Tests recommandés

### Test A — Peu de données
Profil avec moins de 7 journées documentées :
- attendre « Ton historique se construit » ;
- aucun conseil de baisse calorique.

### Test B — Récupération basse
Avec sommeil moyen bas, récupération basse ou stress élevé :
- priorité « Récupération & rythme » ;
- aucune réduction énergétique priorisée.

### Test C — Protéines basses
Avec au moins 7 journées nutritionnelles et moyenne protéique nettement sous le repère :
- priorité « Protéines & structure des repas ».

### Test D — Fibres basses
Avec au moins 7 journées nutritionnelles :
- priorité fibres / densité ;
- si digestion moyenne basse, progression explicitement douce.

### Test E — Recomposition
Dans Mes tendances 28 jours, avec plusieurs mesures comparables :
- poids plutôt stable + tour de taille en baisse → « Maintenir : ton corps évolue déjà ».

### Test F — Repère énergétique
Objectif perte de graisse ou prise de masse + au moins 10 journées alimentaires + 10 journées comparables + mesures corporelles répétées, sans signal récupération/protéines/fibres prioritaire :
- « Repère énergétique à réévaluer » ;
- **aucune cible modifiée automatiquement**.

## Portée volontaire de la V1

Cette version ne cherche pas encore à prescrire une nouvelle valeur énergétique. Elle construit d’abord une logique fiable de décision et de priorité à tester sur de vraies données Méthode Tee.

La prochaine étape éventuelle pourra proposer un bouton explicite du type « Appliquer mon nouveau repère », uniquement après validation des garde-fous et des règles de recalibrage.
