# PATCH V430 — Tout connecté : suivis, jauges, calendrier, parcours

Base exacte : `M-thode-TEE-wellness-main 387.zip`
Version : 1.1.0 · build 43

## Ce patch termine le raccord transversal des suivis

- **Mon parcours / Routine du jour** affiche désormais automatiquement les suivis activés dans **Carnet > Mes suivis**.
- Chaque ligne montre un résumé réellement adapté au suivi du jour et ouvre directement sa fiche détaillée au toucher.
- Exemples :
  - Pas & marche → `42 pas · 0,03 km` puis ouverture du suivi Pas & marche.
  - Cycle & rythme hormonal → `J28 · Phase lutéale` même si le repère du jour vient de la projection configurée ; toucher ouvre le suivi Cycle.
  - Activité & récupération → discipline / séance / durée / récupération selon ce qui est renseigné.
  - Digestion → état / confort / ballonnements.
  - Reflux → épisode / intensité.
  - Équilibre alimentaire → repas / diversité / protéines / satiété.
  - Évolution corporelle → ressenti / vêtements / confort / poids ou mensuration si renseigné.
  - Peau → état / sensibilité / rougeurs.
  - Périménopause & ménopause → état / bouffées / énergie / sommeil.
  - Jeûne intermittent → état / durée / énergie.
  - Réduction du sucre → envie / intensité / contexte / sans sucre ajouté.
  - Nutrition végétale & micronutriments → repas calculables / protéines / fibres.
  - Changer une habitude → petit pas / état de la journée.

## Connexion aux 3 jauges / Mon Équilibre

Le moteur transversal existant lisait déjà les entrées des suivis. V430 renforce ce raccord :

- les suivis réellement renseignés comptent maintenant aussi comme **preuve de régularité** ;
- Pas & marche peut transmettre le ressenti d'énergie après marche ;
- Équilibre alimentaire peut transmettre énergie et digestion ressenties ;
- Réduction du sucre peut transmettre le stress renseigné ;
- les autres raccords déjà présents restent conservés : sommeil, récupération, activité, cycle, digestion, reflux, corps, peau, périménopause, jeûne, nutrition, etc.

Aucun nombre de pas n'est transformé artificiellement en « score santé ». Seuls les signaux pertinents et réellement renseignés influencent les jauges.

## Calendrier / pills / historique

Les entrées de suivis étaient déjà lues par le calendrier et ses pills. V430 conserve cette logique et marque aussi `daily_activity.has_tracker = true` lors d'une saisie synchronisée, afin que la journée soit reconnue partout comme contenant un suivi.

Le cycle conserve ses pills spécifiques : règles / fenêtre d'ovulation / ovulation lorsque les données configurées le permettent.

## Performance / egress

- Une seule lecture compacte des entrées du jour est faite pour construire les lignes « Mes suivis » de la Routine du jour.
- Les préférences restent mises en cache localement.
- Aucun historique complet n'est téléchargé pour cette vue.
- Les lectures analytiques existantes restent inchangées.

## Important

- Aucun nouveau SQL n'est nécessaire.
- Aucun changement Gemini.
- Aucun changement du correctif clavier / zoom iOS.
- Aucun changement des champs iOS stabilisés.
- Aucun changement des notifications ou de HealthKit.

## Après upload GitHub

```bash
cd ~/methode-tee-capacitor
git status
git pull origin main
npx cap sync ios
npx cap open ios
```
