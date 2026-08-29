# PATCH V436 — Premium connecté + Mes tendances + HealthKit + code-barres + egress borné

Patch cumulatif prévu pour être appliqué directement sur **M-thode-TEE-wellness-main 391(2)**.
Il reprend V434 + V435 puis ajoute les corrections V436.

## V436 — corrections de cohérence globale

- Suppression des anciens symboles en losange dans les fichiers premium modifiés : remplacement par l’étoile `✦`.
- Le suivi **Stress & régulation** transmet désormais aussi ses repères `énergie`, `humeur` et `contexte sommeil` à **Mon Équilibre** lorsqu’ils sont réellement renseignés.
- Une sauvegarde ou suppression de suivi déclenche toujours :
  - rafraîchissement des cartes de suivis ;
  - rafraîchissement du calendrier Mon parcours ;
  - événement `mt:custom-trackers-changed` ;
  - événement `mt:daily-state-changed`, consommé par `tee-balance.js` pour recalculer les jauges.
- Les jauges n’utilisent pas arbitrairement tous les champs : chaque repère ne pèse que sur les dimensions pertinentes. Ex. stress/humeur/sommeil peuvent influer sur Vitalité/Équilibre intérieur ; un code-barres ou une photo Peau n’altère pas artificiellement une jauge.

## Connexions principales

### Suivis ↔ Mon Équilibre / jauges
Les entrées de suivi sont réduites en un résumé quotidien `_daily.signals`. `tee-balance.js` lit ces signaux et les combine avec Journal, hydratation, alimentation, routines et activité du jour. Le nouveau suivi Stress & régulation participe aux repères de stress, humeur, énergie et sommeil lorsqu’ils existent.

### Suivis ↔ calendrier / Mon parcours
Chaque saisie marque `daily_activity.has_tracker=true`, rafraîchit `mtRefreshParcoursCalendar()` et alimente la journée correspondante. Le Cycle conserve en plus ses événements menstruation / fenêtre d’ovulation / ovulation estimée.

### HealthKit ↔ suivis
HealthKit reste en lecture seule. Les valeurs disponibles peuvent préremplir les suivis compatibles (sommeil, activité/récupération, pas/marche, évolution corporelle, cycle). Aucune entrée Carnet factice n’est créée automatiquement : l’utilisateur garde la validation de sa saisie.

### Carnet alimentation ↔ nutrition / reflux / digestion / jeûne
CIQUAL reste la source nutritionnelle générique. Open Food Facts est interrogé ponctuellement uniquement pour un code-barres scanné. Le repas choisi peut servir de contexte à Digestion/Reflux/Jeûne. Les corrélations temporelles sont calculées à la demande, pas en arrière-plan.

### ✦ Mes tendances
Vue transversale ouverte volontairement. Fenêtre 28 jours par défaut, sélection réduite, limites bornées, cache mémoire 5 minutes. Elle relie uniquement des journées/événements comparables et affiche explicitement qu'une association observée n'est pas une causalité.

## Cached egress — garde-fous

- aucune nouvelle table Supabase ;
- aucun miroir Open Food Facts dans Supabase ;
- cache local Open Food Facts 7 jours ;
- aucune photo Peau envoyée automatiquement au Storage ;
- pas de polling HealthKit ;
- `Mes tendances` ne se charge qu'au tap ;
- historiques 7/28/90 bornés ;
- requêtes transversales avec colonnes réduites + `limit` ;
- réutilisation des caches existants et des résumés `_daily` lorsque possible.

## Contrôles effectués

- syntaxe JavaScript des scripts modifiés ;
- parité root / `www` des fichiers dupliqués concernés ;
- absence de symboles en losange dans le patch ;
- intégration du plugin scanner iOS et fichiers HealthKit conservés ;
- aucun ajout de migration/table Supabase dans ce patch.

## À tester sur vrai iPhone avant soumission

1. Autorisations Apple Santé par catégorie et refus partiel.
2. HRV / FC repos / récupération / cardio fitness / lumière du jour selon les données réellement disponibles.
3. Cycle Apple Santé sans écraser les saisies manuelles.
4. Scanner EAN : autorisation caméra, produit trouvé/non trouvé, produit incomplet.
5. Sauvegarder Stress & régulation : vérifier immédiatement Mon Équilibre et le calendrier.
6. Ouvrir ✦ Mes tendances : vérifier absence de chargement avant le tap puis cache lors d'une réouverture proche.
