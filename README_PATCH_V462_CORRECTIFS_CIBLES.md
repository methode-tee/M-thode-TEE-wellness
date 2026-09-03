# PATCH V462 — Correctifs ciblés Méthode Tee

Base obligatoire : **M-thode-TEE-wellness-main 415.zip** (la 415 et la 415(1) fournies sont identiques).

Ce patch conserve intégralement le moteur adaptatif V461 et son cycle de réévaluation sur 7 jours.

## Ce que corrige V462

### 1. Protocoles connectés jusqu’au jour courant

La dernière fonction V453 arrêtait la période « Pendant » à la dernière validation. V462 conserve les faits compacts et les limites de V453, mais rétablit la règle suivante : une donnée réellement saisie aujourd’hui peut nourrir le protocole en cours avant la validation de la journée.

Cela ne valide aucune journée et ne modifie ni les XP, ni le streak, ni les certificats, ni le déblocage à 7 h.

### 2. Portions McDonald’s individualisées

Le catalogue McDonald’s importé conserve déjà dans `adapter_profile` le poids de portion estimé à partir des colonnes officielles « Pour 100 g/ml » et « Par produit ».

V462 crée ou actualise un profil de portion relié directement au `food_dictionary_id` :

- l’interface propose **1 portion** au lieu de 100 g ;
- le poids correspondant est converti automatiquement en grammes/ml pour le calcul ;
- la référence générique `burger ≈ 220 g` ne passe plus devant la portion propre au produit ;
- le calcul nutritionnel reste fondé sur les valeurs officielles pour 100 g/ml ;
- aucune ancienne saisie n’est recalculée.

Le catalogue actuel permet de documenter **121 produits sur 137**. Les 16 produits sans poids exploitable restent volontairement sans portion inventée.

### 3. Valeurs absentes protégées côté interface

Les vues Journée alimentaire, Boissons et Nutrition des recettes distinguent maintenant explicitement :

- `0`, qui est une vraie valeur documentée ;
- `null`, `undefined` ou vide, qui restent **Non documenté / —**.

Cela protège aussi les anciens snapshots ou les données importées qui conserveraient explicitement une valeur `null`.

### 4. V461 conservée

Le correctif visuel et fonctionnel **Observer → Relier → Priorité → Réévaluer** est déjà présent dans le ZIP 415. V462 ne remplace donc pas `adaptive-reference.js` et ne réinitialise pas le cycle local de 7 jours.

## Installation

### Étape A — Supabase

Dans **Supabase → SQL Editor → New query**, ouvrir et exécuter en entier :

`supabase/V462_PROTOCOLS_PORTIONS_MCDO_GARDE_FOUS.sql`

Le fichier n'utilise aucune table temporaire : il peut être exécuté intégralement depuis le SQL Editor mobile. S'il a déjà été tenté une première fois, il peut être relancé sans créer de doublons.

Le résultat final attendu contient :

- `status: v462_protocoles_portions_mcdo_pret`
- `protocol_current_day_ready: true`
- `mcdo_portions_available: 121` avec le catalogue McDonald’s complet déjà importé
- `historical_meals_rewritten: false`
- `purchases_changed: false`
- `seven_am_unlock_changed: false`

Si `mcdo_portions_available` vaut 0, ne pas poursuivre l’upload : cela signifie que le catalogue McDonald’s avec ses métadonnées de portions n’est pas présent dans cette base.

### Étape B — Fichiers du front

Uploader tous les autres fichiers du patch en conservant exactement leurs dossiers, puis remplacer les fichiers existants. Les versions racine et `www/` sont fournies pour rester synchronisées.

## Tests rapides

1. Rechercher `Le 280 Original — McDonald’s` dans un nouveau repas : la quantité proposée doit être `1 portion`, correspondant à environ 312,6 g.
2. Rechercher les petites, moyennes et grandes frites : chaque taille doit proposer sa propre portion, et non 100 g.
3. Ouvrir un protocole en cours, renseigner un suivi ou un repas aujourd’hui sans valider la journée, puis rouvrir le protocole : la donnée compatible du jour doit pouvoir apparaître.
4. Vérifier qu’une valeur absente dans une boisson ou une recette affiche `—` ou `Non documenté`, jamais `0`.
5. Vérifier que le cycle adaptatif V461 affiche toujours sa progression vers `Réévaluer`.
6. Vérifier un protocole acheté et un contenu futur : accès premium inchangé et contenu toujours verrouillé avant 7 h locale.

## Garde-fous

- aucune modification de `food_meal_items` ;
- aucune modification des anciennes boissons ;
- aucune modification CIQUAL ;
- aucune modification des achats ;
- aucune modification des XP, validations ou certificats ;
- aucune modification du déblocage à 7 h ;
- aucune nouvelle requête ajoutée au moteur adaptatif V461 ;
- profils de portions créés uniquement pour les produits McDonald’s possédant déjà un poids documenté dans leurs métadonnées.
