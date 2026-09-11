# V489.6569 — Adapter mon repas · cerveau alimentaire connecté

## Objectif
Connecter **Adapter mon repas** aux briques déjà présentes dans Méthode Tee sans ralentir l'app :

- `food_dictionary` + plats culturels ;
- CIQUAL ;
- rôles culinaires déjà utilisés par le planificateur ;
- repas réellement renseignés dans le Carnet ;
- repères personnels énergie / protéines / fibres ;
- mémoire alimentaire personnelle ;
- modèles d'apprentissage individuels déjà calculés.

Aucune IA externe et aucune recherche Internet n'est ajoutée.

## Installation

### 1. Supabase SQL Editor — à faire une seule fois
Exécuter :

`supabase/V4896569_ADAPTER_CONTEXTE_RAPIDE.sql`

Le résultat final doit contenir :

- `status = v4896569_adapter_contexte_rapide_pret`
- `rpc = true`

Le RPC renvoie un JSON compact en **un seul aller-retour réseau**. Il réutilise les tables et fonctions existantes ; il ne crée aucune nouvelle bibliothèque parallèle.

### 2. Uploader les fichiers web
Remplacer :

- `food-adapter.html`
- `scripts/food-adapter.js`
- `www/food-adapter.html`
- `www/scripts/food-adapter.js`

Les deux JS racine / Capacitor sont identiques.

## Ce qui change dans Adapter mon repas

1. **Présence ≠ quantité**
   - TEE peut savoir qu'une ratatouille apporte un repère végétal même si le grammage est inconnu.
   - Une quantité inconnue n'est plus assimilée à un aliment absent.

2. **Repas courant exclu du reste de la journée**
   - Le poulet du repas analysé n'est plus compté comme « déjà mangé plus tôt ».

3. **Repères personnels utilisés discrètement**
   - le besoin restant est réparti entre les occasions alimentaires encore possibles ;
   - TEE ne demande jamais de rattraper le besoin journalier entier sur un seul repas.

4. **Mémoire alimentaire**
   - quand plusieurs solutions sont équivalentes, une option familière peut être privilégiée ;
   - ce n'est jamais une obligation et ce qui a déjà été mangé dans la journée est évité si une alternative convient.

5. **Intentions**
   - `Énergie` : priorité à une source glucidique cohérente seulement si elle manque réellement et si le repère documenté le justifie ;
   - `Nourrir & construire` : priorité protéique contextualisée ;
   - `Digestion` : le modèle personnel déjà appris peut empêcher de pousser automatiquement les fibres si l'historique individuel ne va pas dans ce sens ;
   - `Sans intention particulière` : un repas principal déjà structuré peut simplement rester tel quel.

6. **Micronutrition**
   - quelques micronutriments CIQUAL documentés sont transmis au contexte ;
   - ils ne servent qu'au départage futur entre options également cohérentes ;
   - aucune carence n'est déduite d'une absence de donnée ou d'une journée alimentaire.

## Tests rapides

### A — repas déjà structuré
Déjeuner/dîner : `riz + poulet + ratatouille`, sans intention.

Attendu :
- protéine reconnue ;
- féculent reconnu ;
- végétaux reconnus ;
- si les quantités ne sont pas documentées : **Garde ton repas comme prévu** ;
- aucune courgette ajoutée uniquement parce que les fibres du jour paraissent basses.

### B — manque réel de protéine
Déjeuner/dîner : `salade + tomate + concombre`.

Attendu :
- partie végétale reconnue ;
- si le repère protéique restant le justifie : une seule proposition protéinée cohérente ;
- pas de rattrapage du besoin journalier complet.

### C — collation
Collation : `pomme`.

Attendu :
- aliment reconnu ;
- TEE peut laisser la pomme telle quelle ;
- si une adaptation est pertinente : elle reste facultative et adaptée à une collation.

### D — mémoire
Avec plusieurs repas déjà enregistrés sur plusieurs semaines :
- TEE peut favoriser une source alimentaire familière parmi plusieurs options équivalentes ;
- elle évite de reprendre automatiquement une protéine déjà renseignée le même jour.

### E — digestion
Choisir `Digestion`.

Attendu :
- aucun diagnostic ;
- si un modèle digestion personnel est `usable`, il peut modifier la priorité ;
- sinon les règles générales prudentes restent utilisées.

## Garde-fous

- pas de modification Stripe / Apple IAP / checkout ;
- pas de modification des déblocages ;
- pas de modification voix / photo / scan ;
- pas de recherche Internet ;
- pas d'IA externe ;
- `null` reste inconnu, jamais zéro ;
- aucune donnée d'un autre utilisateur ;
- aucune inférence de carence.
