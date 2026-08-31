MÉTHODE TEE · PATCH V453 — CONNEXION ADAPTATIVE TOTALE

Base vérifiée : M-thode-TEE-wellness-main 406.zip

ORDRE
1. Supabase SQL Editor : exécuter supabase/V453_CONNEXION_ADAPTATIVE_TOTALE.sql
   (les migrations V441, V442, V445, V446, V447 et V451 doivent déjà être présentes).
2. Copier les fichiers du patch en conservant exactement l’arborescence racine + www/.
3. Déployer/synchroniser iOS comme d’habitude.

CE QUI EST RELIÉ
- Aujourd’hui passe avant la moyenne : sommeil, activité/séance, pas, énergie active, récupération, stress, digestion, hydratation, faim/appétit, ballonnements, fatigue, micronutrition et protocoles actifs.
- Tous les champs NUMÉRIQUES de tous les trackers actuels/futurs continuent d’être aplatis sous tracker.champ dans le fait quotidien compact ; ils alimentent les agrégats mensuels sans requête historique brute.
- Les trackers du jour sont renvoyés explicitement au contexte, même si leur valeur n’a pas de règle métier : ils sont reliés sans inventer d’interprétation.
- Adapter mon repas affiche le contexte du jour et l’utilise pour RÉORDONNER les propositions culinaires ; il ne remplace jamais les trois propositions précises par des conseils génériques.
- Les protocoles reçoivent les faits whitelisted + au maximum 24 signaux numériques génériques par journée, sur max 60 jours, et peuvent donc exploiter un suivi pertinent sans retélécharger tout l’historique.
- Le recalibrage énergétique reste protégé : journées complètes seulement, adulte seulement, pas de double comptage Apple Santé.

NUTRITION
- Le détail nutritionnel part du snapshot du repas.
- Si une valeur manque et que l’aliment possède un lien fiable, l’écran interroge en une RPC compacte la référence exacte CIQUAL et/ou la bibliothèque Méthode Tee/culturelle.
- Les valeurs vérifiées de la bibliothèque peuvent compléter la référence CIQUAL ; le snapshot enregistré reste prioritaire.
- Les produits scannés utilisent l’instantané Open Food Facts réellement reçu au scan, y compris sucres, saturés, sodium, trans, mono/poly-insaturés, amidon, polyols, cholestérol, alcool, oméga-3/6 et micronutriments quand disponibles.
- Une valeur absente reste « Non documenté » ; une sélection incomplète devient « Données partielles ». Aucun faux zéro.
- L’enrichissement du détail n’est lancé qu’à l’ouverture du panneau, donc pas de requêtes permanentes supplémentaires.

CACHED EGRESS
- Pas de polling.
- Contexte du jour compact + cache client.
- 28 jours = faits compacts.
- 3 mois = agrégats mensuels.
- Protocoles = max 60 jours compacts et 24 signaux génériques/jour.
- Détail nutritionnel = lecture à la demande uniquement.
