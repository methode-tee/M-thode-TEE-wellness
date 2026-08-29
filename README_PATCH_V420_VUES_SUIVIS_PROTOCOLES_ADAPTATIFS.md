# MÉTHODE TEE — PATCH V420
## Vues de suivi façon Santé + détails par repère + protocoles adaptatifs distincts + Apple Santé contextuel

**Base exacte :** `M-thode-TEE-wellness-main 379.zip`  
**Version iOS conservée :** `1.1.0`  
**Build conservé :** `43`  
**Nouveau SQL : NON.** Le SQL V419 micronutrition déjà appliqué reste le bon ; ce patch ne modifie aucun schéma Supabase.

---

## 1. Suppression de la redondance dans les suivis

Le bouton séparé **« Mes jauges & mes courbes »** placé juste au-dessus de **« Aperçu de mon évolution »** est supprimé.

À l’ouverture de **Saisir aujourd’hui**, il ne reste qu’un seul bloc d’évolution.

Ce bloc devient une vraie vue de synthèse inspirée de la logique de l’app Santé :

- une carte par repère pertinent ;
- dernière donnée mise en avant ;
- date de la dernière donnée ;
- plage observée sur la période ;
- source de la donnée ;
- toucher une carte ouvre le détail de CE repère.

La vue globale n’est plus un doublon. Le bouton du bas devient **« Vue d’ensemble · tendances & croisements »** et ouvre une analyse différente : jauges descriptives, courbes multiples, tendances prudentes et croisements entre suivis.

---

## 2. Une vue « résumé » puis une vraie fiche de détail

Chaque suivi possède maintenant deux niveaux visuels réellement différents.

### Niveau 1 — aperçu du suivi

Exemples selon le suivi :

**Pas & marche**
- Pas
- Distance
- Longueur de pas
- Vitesse de marche
- Énergie active
- Étages montés
- Temps de marche

**Évolution corporelle**
- Poids
- Tour de taille
- Tour de hanches
- Masse grasse
- Masse maigre
- IMC lorsqu’Apple Santé le fournit
- Confort corporel

**Sommeil approfondi**
- Durée
- Qualité ressentie
- État au réveil
- Sommeil profond
- Sommeil REM
- Réveils nocturnes

**Nutrition végétale & micronutriments**
- Protéines
- Glucides
- Lipides
- Fibres
- puis les micronutriments réellement sélectionnés et documentés dans le Carnet / CIQUAL.

Les autres suivis ont leurs propres repères : digestion, reflux, peau, activité/récupération, cycle, périménopause, jeûne, réduction du sucre, changement d’habitude, etc.

### Niveau 2 — toucher un repère

Une fiche détaillée s’ouvre avec :

- 7 j / 28 j / 90 j / Depuis le début ;
- **plage** ou dernière donnée ;
- courbe dédiée au repère choisi ;
- dernière valeur ;
- date ;
- source (`Apple Santé`, `Saisie Méthode Tee`, `Carnet alimentaire · CIQUAL`) ;
- section **« À propos de ce repère »** adaptée au type de suivi.

Les jours sans donnée restent vides et ne sont jamais transformés en zéro.

---

## 3. Apple Santé reste connecté seulement quand c’est pertinent

Le pont HealthKit existant est conservé et enrichi par une API interne de lecture quotidienne réutilisable par les protocoles.

### Suivis

- **Pas & marche** : historique Apple Santé, pas, distance, longueur de pas, vitesse, énergie active, étages, temps de marche.
- **Activité & récupération** : pas, distance, énergie active et entraînements lorsqu’ils ont été importés dans le repère.
- **Sommeil approfondi** : durée et stades disponibles ; le ressenti personnel reste séparé.
- **Évolution corporelle** : une ancienne mesure Apple Santé n’est toujours jamais recopiée comme si elle avait été prise aujourd’hui.

### Protocoles

Quand le thème le justifie :

- protocole sommeil → lecture Apple Santé du sommeil disponible aujourd’hui ;
- protocole activité / récupération / muscle / marche → historique d’activité Apple Santé borné à la durée du protocole ;
- protocole silhouette / poids → mesures corporelles Apple Santé uniquement si elles sont réellement datées d’aujourd’hui.

Aucune donnée HealthKit n’est écrite dans Apple Santé par Méthode Tee.

---

## 4. Les protocoles n’utilisent PLUS les mêmes jauges que le Carnet

L’ancien bloc basé sur :

- Vitalité ;
- Équilibre intérieur ;
- Régularité ;

et la courbe générique de Mon Équilibre ont été retirés du rendu des protocoles.

Ils donnaient l’impression que le protocole affichait simplement les mêmes jauges générales que le Carnet.

### Nouveau système : « Balises du protocole »

Chaque protocole reçoit maintenant des balises adaptées à son thème.

Le visuel est volontairement différent : **rubans segmentés de présence des données**, et non jauges de score.

Le ruban indique combien de journées alimentent le repère. Il ne dit jamais qu’un poids, une douleur, une phase de cycle ou une journée est « bonne à 70 % ».

Exemples :

- **Sommeil profond** → durée du sommeil / qualité ressentie / état au réveil ;
- **Ventre, digestion** → confort / ballonnements / douleurs ;
- **Reflux** → jours avec épisode / intensité / stress renseigné ;
- **Réduction du sucre** → envies / journées sans sucre ajouté renseignées / alternatives utiles ;
- **Jeûne intermittent** → durée / énergie / confort après rupture ;
- **Cycle & hormones** → énergie / douleurs / sommeil ;
- **Périménopause** → sommeil / énergie / journées avec bouffées renseignées ;
- **Peau** → sensibilité / rougeurs / sécheresse ;
- **Fer / nutrition / micronutrition** → protéines / fibres / micronutriments documentés depuis le Carnet CIQUAL ;
- **Silhouette** → poids et tour de taille en plages neutres + confort corporel ;
- **Crampes, récupération, recomposition, muscle, Pilates, marche** → pas / récupération / temps de pratique ;
- **Stress / anxiété / apaisement** → rituels réalisés / ressentis notés / sommeil documenté ;
- autres protocoles → progression, rythme et ressentis du protocole, sans réutiliser Mon Équilibre.

---

## 5. Nouvelle « Trajectoire du protocole »

Sous les balises, le protocole possède maintenant une lecture jour par jour :

- vert = rituel réalisé ;
- doré = un repère a été documenté ;
- vide = jour à venir / non renseigné.

Cette trajectoire répond à la question **« comment j’avance dans CE protocole ? »**, contrairement aux jauges générales du Carnet qui répondent à **« comment va mon équilibre global ? »**.

---

## 6. Connexions utilisées

Le moteur de protocole peut croiser, selon le thème :

- `protocol_progress` ;
- journal d’humeur du protocole ;
- `user_tracker_entries` ;
- Pas & marche ;
- Activité & récupération ;
- Sommeil approfondi ;
- Évolution corporelle ;
- Digestion / reflux ;
- Cycle / périménopause ;
- Nutrition végétale & micronutriments ;
- Carnet / CIQUAL via les entrées déjà calculées ;
- Apple Santé en lecture seule lorsque pertinent.

Aucun lien causal n’est inventé.

---

## 7. Cached egress / lectures bornées

- le nouveau moteur de protocole ne charge plus `daily_activity.tee_balance_snapshot` pour redessiner les mêmes courbes générales ;
- les entrées de suivis du protocole sont bornées à la période du protocole et à un nombre de lignes plafonné ;
- l’historique Apple Santé activité est borné aux dates du protocole ;
- l’aperçu d’un suivi charge seulement 7 jours ;
- Pas & marche utilise 28 jours uniquement quand son repère personnel / historique le nécessite ;
- « Depuis le début » reste une action explicite et n’est jamais déclenchée à l’ouverture du formulaire ;
- aucune réintroduction d’un `.limit(1000)` dans `custom-trackers.js`.

---

## 8. Cache-busting

Nouveaux identifiants :

- `v420-measurement-views-r1`
- `v420-protocol-bridge-r1`
- `v420-protocol-markers-r1`

Cela évite que Safari / la WebView Capacitor conserve le rendu V419 précédent.

---

## 9. Vérifications effectuées

- `node --check scripts/custom-trackers.js`
- `node --check scripts/healthkit.js`
- `node --check scripts/protocol-journey.js`
- `node --check scripts/v18-premium.js`
- parité racine / `www` des scripts et du CSS concernés ;
- aucune occurrence `.limit(1000)` dans `custom-trackers.js` ;
- aucun appel actif à l’ancienne courbe `Vitalité / Équilibre intérieur / Régularité` dans le rendu du protocole ;
- archive ZIP testée avec `unzip -t`.

---

## 10. Installation

Appliquer le contenu du patch à la racine du projet, en conservant l’arborescence, puis :

```bash
npx cap sync ios
npx cap open ios
```

### SQL

**Aucun nouveau SQL à exécuter pour V420.**  
Si le SQL V419 micronutrition a déjà été exécuté, ne fais rien de plus côté Supabase pour ce patch.
