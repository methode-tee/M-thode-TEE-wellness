# PATCH V475 — Connexion protocoles ↔ cerveau global ↔ ménopause ↔ fringales

Base : **M-thode-TEE-wellness-main 427.zip**.

Ce patch complète V474. Il ne remplace pas le moteur holistique : il ferme les deux connexions encore incomplètes identifiées dans la 427.

## 1. Trackers intégrés aux protocoles → cerveau global

Avant V475, les trackers créés dans **Mes suivis** (`user_tracker_entries`) alimentaient bien `user_reference_daily_facts`, alors que les trackers intégrés directement dans un contenu de protocole (`tracker_entries`) restaient surtout dans leur propre historique.

V475 ajoute une passerelle serveur :

- chaque saisie numérique d'un tracker de protocole est reliée au fait journalier compact ;
- les valeurs restent namespacées sous `protocol_tracker.<content_id>.<field_key>` ;
- les champs structurés reconnus (énergie, stress, humeur, digestion, sommeil, récupération, faim, satiété, envies, douleur, ballonnements, bouffées, sueurs nocturnes) sont normalisés pour pouvoir participer aux lectures transversales ;
- **une saisie personnelle déjà présente dans Mes suivis / Journal / Carnet garde toujours la priorité** ;
- aucun texte libre de protocole n'est interprété automatiquement ;
- une suppression ou modification du tracker reconstruit le jour concerné ;
- le backfill est limité aux 90 derniers jours pour éviter un historique inutilement lourd.

Cette connexion permet aux futurs protocoles de nourrir le même moteur sans créer une nouvelle table par protocole.

## 2. Périménopause & ménopause ↔ Fringales & envies

V475 relie explicitement **Fringales & envies** aux protocoles et contextes :

- cycle ;
- hormonal ;
- menstruation ;
- périménopause ;
- ménopause ;
- sommeil ;
- stress ;
- nutrition ;
- jeûne ;
- sucre / glycémie ;
- silhouette / équilibre.

Les catégories du suivi Périménopause sont converties en contexte ordinal uniquement lorsqu'elles sont réellement renseignées :

- bouffées de chaleur ;
- sueurs nocturnes.

Une non-réponse reste **NULL**, jamais zéro.

Le modèle individuel V475 peut alors répartir ses poids entre :

- sommeil ;
- stress ;
- protéines ;
- fibres ;
- rythme de jeûne ;
- appétit du cycle ;
- bouffées de chaleur documentées ;
- sueurs nocturnes documentées.

Le contexte hormonal peut donc réduire une conclusion trop simpliste du type « les fringales viennent forcément des protéines » ou « forcément du stress ». Il reste une **variable contextuelle**, jamais une preuve de causalité.

## 3. Protocole Périménopause & ménopause prêt à être accueilli

La lentille protocole dédiée est renforcée :

- `perimenopause`
- `fringales_envies`
- `sommeil_profond`
- `stress_regulation`

La trajectoire du protocole peut maintenant afficher :

- sommeil ;
- énergie ;
- jours avec bouffées de chaleur renseignées ;
- intensité moyenne des Fringales & envies si ce suivi est utilisé.

Apple Santé peut continuer à compléter le sommeil quand disponible, selon les règles app-first existantes.

## 4. Connexion avec le reste de l'application

V475 ne transforme pas toutes les rubriques en données physiologiques.

Les règles restent :

- alimentation → données nutritionnelles et contexte repas ;
- calendrier → date réelle des saisies ;
- Mes suivis → signaux personnels structurés ;
- trackers de protocole → signaux structurés du protocole ;
- Mon parcours aujourd'hui → régularité / actions réalisées ;
- routines → régularité / adhérence ;
- missions → régularité / adhérence ;
- Notre journée ensemble → participation réelle ;
- favoris / simple ouverture d'un PDF → **aucun signal physiologique**.

Donc une routine validée ne fabrique jamais un « stress bas », et une mission terminée ne fabrique jamais une « bonne digestion ».

## 5. Apprentissage statistique V475

Les modèles individuels énergie, fringales et récupération sont recalculés avec le contexte hormonal supplémentaire lorsqu'il existe.

Les mêmes garde-fous V474 restent actifs :

- minimum de données avant activation d'un prédicteur ;
- ridge multivarié standardisé ;
- couverture individuelle ;
- coefficients recalculés par personne ;
- causalité non affirmée ;
- aucun changement énergétique automatique ;
- données absentes ≠ zéro.

Deux associations descriptives supplémentaires peuvent être affichées dans Mes tendances seulement avec suffisamment de paires et une corrélation marquée :

- Bouffées de chaleur ↔ Fringales & envies ;
- Sueurs nocturnes ↔ Fringales & envies.

Le texte visible rappelle toujours qu'une association répétée n'est pas une preuve de cause.

## 6. SQL

### Option recommandée si tu n'es pas certaine que V474 corrigé a déjà été exécuté avec succès

Exécuter **un seul fichier** :

`supabase/V475_CUMULATIF_DEPUIS_V474.sql`

Il contient le **V474 corrigé** puis V475.

### Si V474 corrigé a déjà été exécuté avec succès

Tu peux exécuter uniquement :

`supabase/V475_CONNEXION_PROTOCOL_TRACKERS_MENOPAUSE_FRINGALES.sql`

Ne réutilise pas l'ancien SQL V474 qui contenait l'erreur `into counts[j]`.

## 7. Cache

- chargeur dynamique `custom-trackers.js` → `v475-connexion-protocoles-menopause-r1` ;
- `v18-premium.js` → cache V475 ;
- `personal-reference.js` → cache V475 ;
- `protocol-journey.js` → cache V475.

## 8. Vérifications réalisées

- syntaxe JS avec `node --check` : OK ;
- miroirs `scripts/` et `www/scripts/` : identiques ;
- miroirs HTML root / `www` modifiés : identiques ;
- aucune occurrence du bug SQL V474 `into counts[j]`, `into means[j]`, `into sds[j]` dans le SQL cumulatif ;
- tracker Périménopause détecté par slug/titre `perimenopause|menopause` ;
- Fringales reconnaît maintenant les protocoles cycle/hormonaux/périménopause/ménopause ;
- trackers internes de protocole raccordés à `user_reference_daily_facts` par trigger ;
- priorité aux données personnelles explicites conservée.

## 9. Tests fonctionnels conseillés avant soumission

1. Ouvrir **Fringales & envies**, enregistrer une journée et vérifier l'historique.
2. Renseigner **Périménopause & ménopause** puis Fringales le même jour.
3. Vérifier que Mes tendances ne conclut rien avec une seule journée.
4. Créer / ouvrir un contenu de protocole de type Tracker, déplacer un curseur et attendre « Sauvegardé sur ton compte ».
5. Fermer puis rouvrir : la valeur doit revenir.
6. Vérifier Mon parcours aujourd'hui / calendrier : la vraie activité du jour reste visible sans faux score physiologique.
7. Ouvrir le protocole **Périménopause & ménopause** : sa trajectoire doit accepter sommeil, énergie, bouffées et Fringales si ces données existent.
8. Refaire le test sur plusieurs jours : les liens ne doivent apparaître qu'avec assez d'historique.

