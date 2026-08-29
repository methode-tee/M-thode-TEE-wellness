# PATCH V432 — Routine du jour : données réelles pour tous les suivis

Base exacte : **M-thode-TEE-wellness-main 389.zip**  
Version : **1.1.0 · build 43**

## Correctif
V431 ouvrait correctement les fiches, mais la carte « Routine du jour > Mes suivis » considérait encore qu'un suivi n'était renseigné que s'il existait une ligne manuelle dans `user_tracker_entries`.

V432 introduit une lecture unifiée des sources du jour. Une carte affiche maintenant la meilleure donnée réellement disponible, avec priorité à la saisie du suivi puis aux sources déjà connectées, sans créer de fausse saisie.

### Sources reconnues
- saisie manuelle du suivi : priorité absolue ;
- Apple Santé : Pas & marche, Activité & récupération, Sommeil approfondi, Évolution corporelle ;
- Carnet / `daily_activity` : nutrition, équilibre alimentaire, digestion, activité, énergie/sommeil utiles à certains suivis ;
- projection du cycle : jour et phase du cycle lorsque configurés.

### Exemples dans « Routine du jour »
- Pas & marche : `66 pas · 0 km` depuis Apple Santé ;
- Cycle : `J28 · Phase lutéale` ;
- Activité & récupération : séance/durée saisie, ou entraînement/activité Apple Santé si disponible ;
- Évolution corporelle : mesure du jour Apple Santé si elle existe ;
- Nutrition végétale : repas calculés · protéines · fibres réellement documentés ;
- Équilibre alimentaire : repas documentés + digestion/énergie disponibles ;
- Confort digestif : confort du jour s'il est déjà documenté ailleurs dans le Carnet ;
- Périménopause : énergie/sommeil déjà documentés lorsque disponibles ;
- Réduction du sucre : envie du jour lorsqu'elle est réellement documentée ;
- tous les autres suivis : leur saisie dédiée reste la source de vérité.

Une donnée externe ou dérivée réellement disponible fait apparaître **Voir ›** au lieu de **Renseigner ›**. Cliquer ouvre toujours la fiche complète du suivi. Aucune donnée Apple Santé n'est enregistrée automatiquement dans `user_tracker_entries`.

## Ce qui n'a pas été modifié
- logique clavier/zoom iOS ;
- notifications ;
- calculs des protocoles ;
- jauges Mon Équilibre ;
- calendrier ;
- moteur alimentaire ;
- SQL / schéma Supabase.

## Installation
Après upload sur GitHub :

```bash
cd ~/methode-tee-capacitor
git status
git pull origin main
npx cap sync ios
npx cap open ios
```

Aucun nouveau SQL à exécuter.
