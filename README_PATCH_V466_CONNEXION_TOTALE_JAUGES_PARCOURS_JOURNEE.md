# PATCH V466 — Connexion totale · Mon Équilibre + Mes suivis + Mon parcours + Notre journée

Base utilisée : **M-thode-TEE-wellness-main 419.zip**.

## Intention

V466 termine la logique **Méthode Tee d'abord** : une information déjà renseignée dans l'application ne doit pas être redemandée ou ignorée par une autre partie de l'app.

Ordre de priorité conservé :

1. **Saisie explicite de la personne** dans le suivi concerné.
2. **Données Méthode Tee déjà enregistrées** le même jour : profil, Carnet, alimentation, boissons, Journal, autres suivis, protocoles structurés, Mon parcours aujourd'hui, routines et Notre journée ensemble.
3. **Apple Santé en complément** pour les mesures objectives compatibles encore absentes.
4. **Pas & marche** reste l'exception logique : Apple Santé est la meilleure source passive de comptage quand il n'existe pas de saisie manuelle explicite.

Aucune action de navigation ou simple ouverture de contenu ne fabrique un symptôme, un ressenti ou une donnée de santé.

---

## 1. Mon Équilibre aujourd'hui lit maintenant la couche connectée

La carte **Mon Équilibre aujourd'hui** ne dépend plus seulement du formulaire qui se trouve directement à côté de la jauge.

### Vitalité

Les sources compatibles déjà renseignées peuvent alimenter :

- durée du sommeil ;
- énergie ressentie ;
- qualité ressentie du sommeil ;
- stress ;
- récupération ;
- repères énergétiques issus de l'alimentation quand ils sont réellement documentés.

Ces valeurs peuvent provenir du Journal, de Mes suivis, du Carnet, de Ma journée alimentaire, de données structurées de protocoles ou d'autres sources Méthode Tee compatibles. Apple Santé complète uniquement ce qui manque.

### Équilibre intérieur

Le calcul principal reste :

- digestion : **28 %** ;
- humeur : **24 %** ;
- stress inversé : **25 %** ;
- qualité ressentie du sommeil : **13 %** ;
- équilibre nutritionnel documenté : **10 %**.

Mais chaque composante peut maintenant relire les repères structurés déjà enregistrés ailleurs dans Méthode Tee. Par exemple, un stress renseigné dans Stress & régulation ou dans un journal structuré compatible peut nourrir Équilibre intérieur sans demander une deuxième saisie.

### Régularité

La régularité peut maintenant reconnaître, selon ce qui existe réellement le jour concerné :

- hydratation ;
- Journal ;
- routines ;
- protocole du jour ;
- rituels et actions de **Mon parcours aujourd'hui** ;
- suivis personnels renseignés ;
- participation et validations de **Notre journée ensemble**.

Les anciennes lignes `has_checklist`, `has_tracker`, `has_photo`, `has_recipe`, `has_protocol`, `has_routine`, `has_ritual` sont également relues pour ne pas perdre une action enregistrée par une ancienne version de l'app.

Important : une action de Mon parcours ou de Notre journée ensemble nourrit la **régularité / le contexte**, jamais artificiellement la digestion, le stress, l'humeur ou une autre donnée de santé.

---

## 2. Mon parcours aujourd'hui est relié même après rechargement / autre appareil

V466 relit `daily_activity` et expose un résumé compact :

- hydratation renseignée ;
- sommeil renseigné ;
- Journal ;
- checklist ;
- suivi ;
- photo ;
- recette ;
- protocole ;
- routine ;
- rituel ;
- nombre d'actions réellement enregistrées ;
- protocole / jour de protocole si présents.

Le compteur `parcours_completed_count` complète les anciennes données lorsque seul un drapeau `has_*` avait été enregistré. Il évite aussi de recompter deux fois une action déjà présente dans `today_checks`.

Le sommeil reste un **repère**, pas une mission à réussir : il peut nourrir Vitalité mais n'est pas transformé en coche de régularité.

---

## 3. Notre journée ensemble est reliée à Mon Équilibre

V466 relit uniquement la participation réelle de l'utilisateur :

- journée rejointe ;
- rendez-vous validés ;
- nombre total de rendez-vous validables du jour.

Le simple fait qu'une journée collective soit programmée ne crée aucune donnée chez une personne qui n'y a pas participé.

Lorsqu'un rendez-vous collectif est validé, **Mon Équilibre se rafraîchit immédiatement** grâce à l'événement `mt:community-journey-updated`.

La journée collective apparaît comme contexte de régularité ; elle ne génère jamais une humeur, un stress ou un symptôme fictif.

---

## 4. Les sources déjà reliées par V465 restent actives

V466 remplace la même RPC `mt_tracker_connected_context(...)` et conserve les connexions V465 :

- Sommeil approfondi ;
- Stress & régulation ;
- Confort digestif ;
- Reflux & aigreurs ;
- Équilibre alimentaire ;
- Évolution corporelle ;
- Peau ;
- Activité & récupération ;
- Cycle & rythme hormonal ;
- Périménopause & ménopause ;
- Jeûne intermittent ;
- Réduction du sucre ;
- Nutrition végétale & micronutriments ;
- Changer une habitude ;
- Pas & marche ;
- Journal ;
- Ma journée alimentaire ;
- Boissons ;
- profil ;
- journaux structurés des protocoles compatibles.

Le texte libre des protocoles n'est jamais interprété arbitrairement. Seuls des signaux structurés / numériques déjà enregistrés peuvent être réutilisés.

---

## 5. Alimentation et boissons

La couche connectée conserve les agrégats compacts déjà calculés :

- nombre de repas ;
- protéines ;
- fibres ;
- glucides ;
- lipides ;
- sucres totaux documentés ;
- satiété / énergie / digestion après repas quand renseignées ;
- micronutriments réellement disponibles ;
- horaires des repas utiles au Jeûne intermittent ;
- boissons, hydratation issue des boissons et ressentis après boisson quand disponibles.

Les sucres totaux ne sont jamais présentés comme des sucres ajoutés.

La jauge d'hydratation garde la donnée Méthode Tee déjà consolidée comme source principale ; les boissons servent déjà de fallback dans le moteur de faits journaliers.

---

## 6. Calendrier : aucune duplication

Le Calendrier du Carnet reste la représentation des **vraies sources** de la journée : repas, suivis, routines, protocoles, Journal, Notre journée ensemble, etc.

V466 ne crée **aucune nouvelle ligne artificielle** dans `user_tracker_entries` pour faire croire qu'un suivi a été rempli.

Même date = même Carnet. Une information reste rattachée à sa source d'origine et les autres modules la relisent.

---

## 7. Ce que V466 ne connecte volontairement PAS aux jauges

Certaines actions de l'app n'ont pas de signification physiologique suffisante pour modifier une jauge :

- enregistrer un favori ;
- ouvrir une ressource ;
- consulter un PDF ;
- naviguer dans la Bibliothèque.

Elles restent utiles dans l'expérience Méthode Tee mais ne doivent pas faire monter artificiellement Vitalité ou Équilibre intérieur.

Le patch connecte donc **tout ce qui a un sens comme donnée corporelle, nutritionnelle, ressenti, progression ou régularité**, pas chaque clic de navigation.

---

## 8. Performance et sécurité Supabase

- aucune nouvelle table ;
- aucune duplication d'historique ;
- une RPC compacte `mt_tracker_connected_context(...)` ;
- limite maximale : 365 jours pour Mes suivis ;
- Mon Équilibre ne demande que **la journée du jour** ;
- cache client de 5 minutes ;
- aucun texte libre de Journal/protocole renvoyé ;
- les agrégats alimentaires restent compacts ;
- si le SQL V466 n'est pas encore installé, l'app retombe sur son comportement précédent sans crash.

V466 incrémente aussi la version interne des snapshots de Mon Équilibre afin de ne pas comparer une ancienne formule de données partielles avec les nouvelles lectures connectées. Les nouvelles empreintes se reconstruisent progressivement avec la version connectée.

---

## 9. Installation

### GitHub

Copier les fichiers du patch en conservant leurs chemins.

Fichiers fonctionnels principaux :

- `scripts/tee-balance.js`
- `scripts/custom-trackers.js`
- `scripts/v18-premium.js`
- `supabase/V466_CONNEXION_TOTALE_JAUGES_PARCOURS_JOURNEE.sql`
- leurs miroirs sous `www/`

Les fichiers HTML inclus ne changent que les versions de cache des scripts concernés afin que l'iPhone / PWA charge bien V466 :

- `dashboard.html`
- `library.html`
- `food-inspiration.html`
- `index.html`
- `page.html`
- `protocol-journey.html`
- `protocol.html`
- `protocols.html`
- et leurs miroirs `www/`.

### Supabase

Après le déploiement GitHub, aller dans :

**Supabase → SQL Editor → New query**

puis exécuter **une seule fois** :

`supabase/V466_CONNEXION_TOTALE_JAUGES_PARCOURS_JOURNEE.sql`

La migration fait `create or replace function` : elle remplace la RPC V465, sans créer de table.

---

## 10. Tests conseillés

1. **Sommeil app-only** : renseigner les heures de sommeil dans Mon parcours, sans Apple Santé, puis vérifier Sommeil approfondi et Vitalité.
2. **Stress** : renseigner un stress dans Journal ou Stress & régulation puis ouvrir Mon Équilibre ; Équilibre intérieur doit pouvoir l'utiliser sans deuxième saisie.
3. **Digestion** : renseigner un repas / ressenti digestif puis vérifier Confort digestif et Équilibre intérieur.
4. **Alimentation** : renseigner plusieurs aliments avec quantités puis vérifier Équilibre alimentaire / Micronutrition et la composante nutritionnelle d'Équilibre intérieur.
5. **Routine** : terminer une routine puis rouvrir Mon Équilibre ; Régularité doit reconnaître la réalisation.
6. **Mon parcours aujourd'hui** : valider un rituel/protocole/checklist puis vérifier que le contexte est conservé après rechargement.
7. **Notre journée ensemble** : rejoindre la journée, valider un rendez-vous et vérifier le rafraîchissement de Régularité sans recharger l'écran.
8. **Apple Santé désactivé** : vérifier que les repères Méthode Tee continuent de fonctionner.
9. **Apple Santé activé** : vérifier qu'il complète les données objectives absentes sans écraser une saisie explicite.
10. **Calendrier** : vérifier qu'aucune nouvelle fausse entrée de suivi n'a été créée simplement parce qu'un autre module a relu la donnée.

