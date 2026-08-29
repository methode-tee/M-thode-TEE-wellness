# PATCH V431 — Correctif ouverture des suivis depuis Routine du jour

Base : `M-thode-TEE-wellness-main 388.zip`  
Version : 1.1.0 — build 43

## Problème corrigé
Dans `Mon parcours > Routine du jour > Mes suivis`, les lignes de suivis personnalisés apparaissaient correctement mais le bouton `Renseigner` / `Voir` n'ouvrait rien.

La cause était un appel vers `mtOpenAdvancedTrackerEntry(...)`, fonction inexistante dans `scripts/app.js`.

## Correction
- ajout d'un pont `mtOpenTodayTrackerEntry(key)` ;
- chargement garanti du module `custom-trackers.js` via le chargeur déjà existant ;
- fermeture propre de la feuille `Routine du jour` ;
- ouverture du suivi demandé à la date du jour ;
- message de secours si le module ne peut exceptionnellement pas être chargé ;
- cache-bust de `scripts/app.js` vers `v431-routine-tracker-open-r1`.

Le correctif s'applique à toutes les lignes de suivis personnalisés : évolution corporelle, nutrition végétale, pas & marche, cycle, digestion, reflux, activité & récupération, peau, jeûne, sucre, etc.

## Non modifié
Aucune modification du moteur des jauges, du calendrier, des protocoles, d'Apple Santé, du clavier iOS, des données ou des tables Supabase.

## SQL
Aucun SQL à exécuter.

## Après upload GitHub
```bash
cd ~/methode-tee-capacitor
git status
git pull origin main
npx cap sync ios
npx cap open ios
```
