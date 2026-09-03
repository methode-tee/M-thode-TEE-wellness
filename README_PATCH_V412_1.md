# Méthode Tee — PATCH V412.1 · Précision réelle + Protocoles connectés

**Base obligatoire : ZIP 412 actuel.** Ce patch a été construit depuis `M-thode-TEE-wellness-main 412.zip`, donc il conserve le correctif V411.4 déjà présent (Bibliothèque + Apple Santé). Ne pas l'appliquer à une ancienne base.

## Ce que le patch ajoute

### 1. V411.3 réadapté au ZIP 412
- poids final préparé **facultatif** pour les recettes Méthode Tee ;
- repère par portion et, seulement si un poids final existe, repère pour 100 g préparés ;
- quantités réellement utilisées pour les smoothies/boissons ;
- snapshot nutritionnel des **nouvelles** boissons quantifiées ;
- aucune ancienne boisson et aucun ancien repas recalculés.

### 2. Protocoles reliés au Profil + Carnet
- un protocole en cours peut lire les données réellement renseignées jusqu'à aujourd'hui, même avant de valider la journée du protocole ;
- si aucune pesée datée n'existe pendant le protocole, le poids actuel du Profil peut apparaître comme **Poids · repère — Mon profil**. Il n'est pas transformé en fausse journée de pesée ;
- `Protéines documentées` peut remonter les protéines réellement connues des items du Carnet, même lorsqu'un repas reste partiellement documenté. Les aliments inconnus ne deviennent jamais 0 ;
- les protocoles déjà spécialisés restent spécialisés ; ajout d'une lecture adaptée pour **Force & Construction**, **Énergie & Vitalité**, **Souplesse & Mobilité**, **Malbouffe & Excès**, **Confort dentaire** et **3 jours pour retrouver ton rythme** ;
- `Force & Construction` lit maintenant mouvement/pratique, récupération, protéines documentées et poids/Profil quand disponible.

> « Tout connecté » ne signifie pas afficher le poids ou les protéines dans chaque protocole. La couche commune Profil/Carnet est disponible ; chaque protocole n'affiche que les repères pertinents pour son objectif.

### 3. Validation de journée plus robuste
- les anciennes formes `YYYY-MM-DD`, timestamps ISO et tableaux JSON sont normalisées avant affichage ;
- après une validation, l'app relit si possible `protocol_progress` après le commit Supabase ;
- le cache des repères est invalidé après confirmation ;
- aucune validation historique n'est créée ou réécrite artificiellement.

### 4. V411.4 conservé
Le fichier `v18-premium.js` de ce patch est basé sur le ZIP 412 et contient toujours le correctif Bibliothèque V411.4 : tap fiable, apostrophes sûres et retour visuel immédiat. Le fichier Apple Santé du ZIP 412 n'est pas remplacé par ce patch, donc son correctif de superposition reste intact.

## Installation

### Étape A — Supabase
Sur iPhone : **Supabase → SQL Editor → New query → colle tout** le fichier :

`supabase/V412_1_MOBILE_TOUT_EN_UN.txt`

puis **Run**.

Le dernier résultat attendu est :

`"status": "v412_1_precision_reelle_protocoles_connectes_pret"`

avec notamment :
- `recipe_final_weight_ready: true`
- `actual_beverage_calculator_ready: true`
- `protocol_reference_ready: true`
- `profile_weight_fallback_ready: true`
- `documented_protein_from_carnet_ready: true`
- `current_unvalidated_day_data_ready: true`
- tous les champs `historical_*_rewritten: false`

### Étape B — Front
Après validation du SQL, copie les fichiers du patch en respectant exactement les dossiers racine / `scripts` / `www` / `www/scripts`.

## Tests prioritaires avant soumission

1. **Bibliothèque** : ouvrir, fermer et rouvrir plusieurs anciens PDF — le correctif V411.4 doit rester fonctionnel.
2. **Silhouette & Équilibre** : si aucun poids daté n'existe mais que le Profil contient un poids, la carte doit afficher `Poids · repère` avec source `Mon profil`.
3. **Carnet → protocole** : avec des repas contenant des aliments dont les protéines sont calculables, `Protéines documentées` doit se renseigner. Si certains aliments sont inconnus, le texte doit signaler une donnée partielle au lieu de fabriquer 0.
4. **Force & Construction** : les cartes doivent maintenant être orientées construction/récupération avec protéines documentées.
5. **Validation du jour** : valider une journée, laisser le rechargement se faire, rouvrir le protocole ; la journée doit rester cochée si Supabase l'a bien enregistrée.
6. **V411.3** : tester une recette structurée avec poids final facultatif et un smoothie avec quantités réelles.

### Apple Santé
Le correctif Apple Santé V411.4 est déjà dans le ZIP 412 et n'est pas écrasé. Sa superposition `Connecter` doit être vérifiée dans la build native/TestFlight, pas dans Safari privé.

## Garde-fous
- aucune mise à jour massive de `food_meal_items` ;
- aucun recalcul des anciens repas ;
- aucun recalcul des anciennes boissons ;
- aucune création rétroactive de journée validée ;
- aucune valeur absente transformée en zéro ;
- pas de modification des données CIQUAL ou des plats culturels ;
- pas de modification du paiement, des achats ni du déblocage 7 h.
