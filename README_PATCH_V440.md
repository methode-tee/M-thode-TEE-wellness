# Patch V440 — Étoile simple · Mes tendances

Patch correctif à appliquer après le V439 / sur la base 394 correspondante.

- Retire l’asset étoile spécifique ajouté en V439 dans **Mes tendances**.
- Réutilise le glyphe simple `✷`, déjà présent dans l’interface Méthode Tee (notamment Apple Santé).
- Corrige la ligne Mes tendances du Carnet, le titre de la feuille Mes tendances et le bouton Ouvrir Mes tendances.
- Aucun changement de données, HealthKit, Supabase, SQL, cached egress ou logique de tendances.

Vérification HealthKit dans la base 394 :
- fréquence cardiaque au repos (`restingHeartRate`)
- HRV / SDNN (`heartRateVariabilitySDNN`)
- récupération cardiaque à 1 minute (`heartRateRecoveryOneMinute`)
- cardio fitness / VO₂ max (`vo2Max`)
Ces repères alimentent Activité & récupération lorsqu’ils sont disponibles et autorisés.
