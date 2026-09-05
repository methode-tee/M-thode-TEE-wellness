# Patch V475.1 — sécurisation holistique (base V428)

Ce patch s'applique **uniquement par-dessus `M-thode-TEE-wellness-main 428`**. Il conserve les ajouts V475 (connexions protocoles, suivis, périménopause et fringales) ainsi que le correctif de validation des protocoles déjà présent dans la V428.

## Corrections incluses

1. Correction de la requête SQL qui calculait le délai entre une fringale et le dernier repas. L'agrégation invalide a été remplacée par une sous-requête scalaire sûre.
2. Protection contre la fausse précision :
   - un modèle individuel n'influence l'application qu'à partir de 30 observations, avec une fiabilité d'au moins 60/100 ;
   - les modèles « exploratory » restent visibles comme repères en construction, mais ne pilotent plus les priorités ;
   - les effets d'un cycle demandent au moins 7 jours appliqués, 14 jours de comparaison et 7 jours appariés ;
   - un effet n'est interprété comme exploitable qu'à partir de 60/100.
3. Réponse plus rapide : si le contexte holistique n'est pas revenu après 2,5 secondes, l'interface utilise immédiatement les données locales disponibles. Le calcul complet continue en arrière-plan et remplit le cache pour les appels suivants.
4. Actualisation des paramètres de cache des pages concernées afin que les téléphones chargent bien les nouveaux scripts.

## Installation

1. Décompresser le ZIP.
2. Envoyer tous les fichiers et dossiers du patch à la racine du dépôt GitHub en acceptant le remplacement des fichiers portant le même nom.
3. Dans Supabase → SQL Editor, ouvrir **uniquement** `supabase/V475_CUMULATIF_DEPUIS_V474.sql`, copier tout son contenu puis cliquer sur **Run**.

Le SQL cumulatif peut être relancé si l'ancienne version V475 avait déjà été exécutée. Ne pas exécuter ensuite le fichier V474 séparément : il est fourni seulement pour garder le dépôt source corrigé et cohérent.

## Contrôles rapides après déploiement

- Ouvrir puis valider un contenu de protocole : l'état doit passer à « fait » sans rester sur « Enregistrement… ».
- Ouvrir un suivi relié à un protocole et vérifier que les données déjà saisies dans Méthode Tee apparaissent comme source prioritaire.
- Tester une page utilisant les repères personnels avec une connexion lente : l'écran doit rester utilisable après environ 2,5 secondes.
- Vérifier dans la console qu'aucune erreur SQL relative à `urge_time` ou `max(meal_time)` n'apparaît.

## Garantie de portée

Le patch ne supprime aucune table, aucune donnée utilisateur, aucun repas, aucun achat et aucun historique. Les signatures des fonctions appelées par l'application restent inchangées.
