MÉTHODE TEE — PATCH V446 — CONNEXION TRANSVERSALE FINALE
Base : M-thode-TEE-wellness-main 401.zip

OBJECTIF
Ce patch corrige le classement de « Premiers Pas — La Méthode Tee » et renforce la couche commune qui relie les données réellement renseignées dans l'app, sans transformer les données inconnues en zéro et sans télécharger des historiques bruts inutilement.

1. PREMIERS PAS
- « Premiers Pas — La Méthode Tee » possède maintenant une règle explicite AVANT le matcher générique du mot « pas ».
- Il n'est plus interprété comme un protocole de marche.
- Ses balises deviennent « Tes premiers repères » : journées réalisées, journées avec repères réellement documentés, ressentis notés.

2. ALIMENTATION / SCANNER / CIQUAL / ADMIN
- Les repas et produits scannés continuent d'enregistrer leur snapshot nutritionnel au moment de la consommation.
- Les faits quotidiens compacts reprennent les macros et nutriments documentés utiles.
- Les micronutriments issus directement des aliments/scans peuvent maintenant nourrir les tendances transversales et les protocoles nutritionnels sans exiger que l'utilisateur crée d'abord le suivi « Nutrition végétale & micronutriments ».
- Garde-fou : un total micronutritionnel journalier n'est promu comme total que si cette donnée est connue pour TOUS les aliments de la journée. Inconnu reste NULL, jamais 0.

3. BOISSONS
- Les boissons alimentent la couche commune avec : nombre de boissons, hydratation documentée, énergie/digestion ressenties après boisson et présence documentée de caféine.
- Elles peuvent être réutilisées dans les protocoles concernés et les vues transversales sans relire tout l'historique des boissons.

4. PROFIL / REPÈRES PERSONNELS / ADAPTER MON REPAS
- Le contexte compact contient désormais les protocoles réellement en cours.
- Le moteur alimentaire conserve toujours ses propositions culinaires précises.
- Un protocole actif peut seulement RÉORDONNER une proposition déjà pertinente (sucre, digestion, structure/protéines, récupération), jamais inventer une restriction ou remplacer les propositions culinaires par du coaching générique.
- Les informations nutritionnelles récentes (dont sucres, graisses saturées, sel/oméga-3 lorsqu'elles sont connues) restent disponibles dans le modèle de contexte personnel.

5. SUIVIS / MES TENDANCES
- Les micronutriments compacts issus des repas sont exposés comme un suivi nutritionnel virtuel dans les tendances.
- Les boissons peuvent également être représentées par une ligne synthétique compacte.
- 28 jours : faits quotidiens compacts.
- 3 mois : agrégats mensuels.
- Aucun fallback vers le téléchargement de tout user_tracker_entries pour les tendances globales.

6. PROTOCOLES EN COURS
- La comparaison protocole retourne au maximum 60 faits quotidiens WHITELISTÉS pendant le protocole : nutrition, boissons, hydratation, stress/humeur/énergie/digestion, sommeil, pas/activité/récupération, poids/tour de taille.
- Jamais food_meal_items brut ni historique complet des trackers envoyé au client pour cette lecture.
- Les données du Carnet peuvent donc compléter un protocole nutrition, sucre, jeûne, recomposition, digestion, etc., selon sa logique.
- « Après » continue de dépendre d'une fin réellement enregistrée, pas seulement de la durée théorique.

7. APPLE SANTÉ
- Aucun changement de principe : HealthKit brut reste lu localement dans l'app iOS quand disponible.
- Ce patch n'upload pas un historique HealthKit brut vers Supabase.
- Le web Safari peut donc afficher moins de données automatiques que l'app native, ce qui est attendu.

8. CACHED EGRESS
- Une ligne compacte par jour reste la base de la lecture transversale.
- Le protocole reçoit au maximum 60 lignes compactes et whitelisted.
- Les tendances 3 mois restent mensuellement agrégées.
- Cache client existant conservé.
- Reconstruction des faits historiques faite côté serveur via le bootstrap, après invalidation ponctuelle de l'état de synchronisation.

SQL
Si V441, V442 et V445 sont déjà installés, exécuter seulement :
  supabase/V446_CONNEXION_TRANSVERSALE_FINALE.sql

Sinon, respecter l'ordre :
  V441_REPERES_PERSONNELS_EVOLUTIFS.sql
  V442_PROFIL_REPERES_ADAPTATIFS_GARDE_FOUS.sql
  V445_NUTRITION_COMPLETE_FAVORIS_ROUTINES.sql
  V446_CONNEXION_TRANSVERSALE_FINALE.sql

Puis copier les autres fichiers en conservant exactement l'arborescence racine + www/.

VALIDATIONS EFFECTUÉES AVANT PACKAGING
- node --check sur les JS modifiés racine + www.
- parité racine/www vérifiée sur tous les fichiers modifiés concernés.
- règle « Premiers Pas » vérifiée avant le matcher générique /pas/.
- garde-fou micronutrition : connu pour tous les aliments avant agrégation journalière.
- structure SQL vérifiée statiquement (transactions et blocs dollar-quoted équilibrés).
- URLs de cache V446 actualisées, y compris le chargeur dynamique custom-trackers.

IMPORTANT
Le SQL n'a pas été exécuté sur la base Supabase de production depuis cet environnement. Faire un test sur un compte de test après exécution de V446 avant soumission App Store.
