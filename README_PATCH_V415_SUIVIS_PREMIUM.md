# MÉTHODE TEE — PATCH V415 · MES SUIVIS PREMIUM

Base : ZIP 372 / version iOS 1.0.4 build 38  
Sortie : version iOS 1.0.4 build 39

## Objectif
Transformer les 12 suivis actuels du Carnet en suivis plus complets, modulaires et lisibles, sans créer de nouvelles tables et sans transformer le Carnet en questionnaire obligatoire.

## Évolution corporelle V2
Le suivi existant `evolution_corporelle` est conservé et enrichi, il n'est pas dupliqué.

À la première activation / première ouverture après mise à jour, une configuration privée permet de choisir :
- focus : vue globale, silhouette & mesures, poids & tendance, ressenti & vêtements, composition corporelle ;
- intention : observer sans objectif chiffré, perte de graisse, prise de masse, recomposition, stabilisation, autre ;
- fréquence souhaitée : libre, hebdomadaire, toutes les 2 semaines, mensuelle ou quotidienne ;
- mesures visibles : poids, taille, hanches, poitrine, cuisse, bras, masse grasse %, masse musculaire ;
- possibilité de masquer complètement le poids.

La saisie quotidienne ajoute : confort corporel, vêtements, ballonnements, rétention ressentie, énergie, faim, satiété, contexte de mesure et changements remarqués. Les mesures restent toujours facultatives.

L'historique affiche les écarts depuis le premier repère de la période sans qualifier une hausse ou une baisse de « bonne » ou « mauvaise ».

## Tous les autres suivis enrichis
### Sommeil approfondi
Durée, horaires, temps d'endormissement, réveils, temps éveillé, qualité, état au réveil, somnolence, régularité, sieste, routine, écrans, repas tardif, caféine tardive, alcool, stress du soir, confort de la chambre.

### Confort digestif
Confort, ballonnements, gaz, douleurs, lourdeur, nausée, transit, fréquence, urgence, moment des symptômes, taille/vitesse du repas, aliments associés, hydratation, stress, mouvement après repas.

### Reflux & aigreurs
Épisodes, intensité, durée, gorge/remontées, rots, repas précédent, taille du repas, délai repas-coucher, position, repas gras/épicé, acidité, caféine, boissons, stress et soulagement.

### Équilibre alimentaire
Nombre de repas/collations, régularité, diversité, protéines, végétaux, féculents, matières grasses, fruits, fibres, hydratation, faim, satiété, énergie et digestion après repas, fait-maison, présence au repas, plaisir et sensation de restriction.

### Peau
Imperfections, sécheresse, rougeurs, sensibilité, démangeaisons, sébum, texture, zones, sommeil, stress, hydratation, contexte hormonal facultatif, soleil, maquillage/occlusion et changements de produits.

### Activité & récupération
Le moteur existant par discipline est conservé et enrichi avec motivation, plaisir, fatigue, récupération, disponibilité, sommeil, courbatures, hydratation, récupération alimentaire et mouvement global de la journée.

### Cycle & rythme hormonal
Flux, douleurs, énergie, humeur, stress, appétit, sommeil, ballonnements, sensibilité des seins, maux de tête, digestion, peau, pertes/glaire facultatives, disponibilité pour bouger et autre changement. Les estimations restent explicitement non contraceptives.

### Périménopause & ménopause
Bouffées, sueurs nocturnes, sommeil, énergie, humeur, stress, concentration, maux de tête, douleurs/raideur, inconfort musculaire, digestion, ballonnements, palpitations, inconfort intime, changements de saignement et note libre. Tous les champs sensibles restent facultatifs.

### Jeûne intermittent
État du jour, horaires, fenêtre visée, faim, énergie, humeur, hydratation, céphalées, faiblesse/étourdissement, type de rupture, confort/satiété/digestion après rupture, caféine et raison d'une pause.

### Réduction du sucre
Envie, intensité, moment, déclencheur, faim, stress, fatigue, produit consommé, quantité ressentie, alternative, efficacité de l'alternative, satisfaction, journée sans sucre ajouté et contexte.

### Changer une habitude
État du jour, impulsion, moment, contexte/lieu, émotion, déclencheur, réponse, comportement de remplacement, difficulté, confiance, victoire et apprentissage.

## Historique premium
Tous les suivis disposent maintenant de :
- 7 jours
- 28 jours
- 90 jours
- Depuis le début

Des cartes de synthèse propres à chaque suivi sont calculées (ex. durée moyenne de sommeil, jours avec reflux, minutes d'activité, évolution de mensurations, jours avec envies sucrées, etc.). Les corrélations affichées restent formulées comme des tendances personnelles et jamais comme des causalités.

## Coaching après saisie
Les retours quotidiens ont été approfondis pour tenir compte de davantage de champs tout en gardant des formulations prudentes. Les situations potentiellement importantes (douleur marquée, reflux récurrent, faiblesse pendant un jeûne, etc.) rappellent que le suivi ne remplace pas un avis médical.

## Données / Supabase
AUCUN SQL À EXÉCUTER.

Les tables existantes utilisent déjà des colonnes JSONB `settings` et `values`. Les nouveaux champs sont donc compatibles avec l'architecture existante :
- `user_tracker_preferences`
- `user_tracker_entries`

Les anciens historiques restent lisibles : les nouveaux champs sont facultatifs et l'ancien format n'est pas supprimé.

## Fichiers remplacés
- `scripts/custom-trackers.js`
- `www/scripts/custom-trackers.js`
- `scripts/v18-premium.js`
- `www/scripts/v18-premium.js`
- `ios/App/App.xcodeproj/project.pbxproj`

## iOS
- MARKETING_VERSION : 1.0.4
- CURRENT_PROJECT_VERSION : 39

Le cache-busting du chargeur `custom-trackers.js` passe à `v415-premium-trackers`.

## Vérifications réalisées
- syntaxe Node des 4 fichiers JS : OK ;
- racine / `www` synchronisés ;
- 12 trackers présents ;
- champs testés : de 12 à 20 champs utiles selon le suivi, regroupés en sections ;
- résumé quotidien généré sans erreur sur un jeu de données de chacun des 12 suivis ;
- Debug + Release passés au build 39 ;
- aucun changement de schéma Supabase requis.
