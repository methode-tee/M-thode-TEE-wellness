# PATCH V465 — Mes suivis connectés · Méthode Tee d’abord

Base utilisée : **M-thode-TEE-wellness-main 418.zip**.

## Intention

Les suivis ne doivent plus fonctionner comme des formulaires isolés. Pour une date donnée, Méthode Tee relit d’abord ce qui est déjà renseigné dans l’application, puis utilise Apple Santé uniquement comme complément pour les mesures objectives compatibles encore absentes.

Ordre appliqué :

1. **Saisie explicite du suivi** — ne doit jamais être écrasée.
2. **Données Méthode Tee reliées** — Carnet, alimentation, Journal, profil, autres suivis, protocoles quand une donnée structurée existe.
3. **Apple Santé en complément** — remplit uniquement ce qui reste vide.
4. **Exception Pas & marche** — Apple Santé reste la meilleure source passive pour compter les pas ; une saisie manuelle explicite garde néanmoins la priorité.

## Ce que le patch relie

- **Sommeil approfondi** : durée de sommeil déjà enregistrée dans Méthode Tee + qualité/repères sommeil du Journal, d’autres suivis et des journaux structurés de protocoles. Apple Santé complète les horaires/stades et autres données compatibles si disponibles.
- **Stress & régulation** : stress, humeur, énergie et contexte sommeil déjà renseignés dans le Carnet/Journal/suivis + signaux structurés de protocoles liés au stress, cortisol, anxiété ou apaisement.
- **Confort digestif** : confort digestif provenant des repas, boissons, Journal, autres suivis + ballonnements, douleurs/crampes ou digestion renseignés dans des journaux de protocoles.
- **Reflux & aigreurs** : épisodes déjà renseignés, lien temporel avec les repas lorsque disponible, stress associé + signaux structurés de protocoles reflux/estomac.
- **Équilibre alimentaire** : nombre de repas, satiété, énergie/digestion après repas, protéines, fibres et sucres documentés dans Ma journée alimentaire.
- **Évolution corporelle** : poids/tour de taille déjà documentés, poids actuel du profil comme point de départ du jour, énergie/faim/satiété/ballonnements disponibles + contexte des protocoles corps/recomposition/silhouette.
- **Peau** : sommeil, stress, contexte du cycle + signaux structurés de protocoles peau/équilibre hormonal.
- **Activité & récupération** : récupération, sommeil, activité/pas/énergie active déjà connus + crampes/douleurs et contexte des protocoles récupération, sport, corps, Pilates ou recomposition. Apple Santé complète les métriques objectives.
- **Cycle & rythme hormonal** : énergie, humeur, stress, sommeil, appétit, digestion, douleurs et ballonnements déjà documentés + protocoles cycle/hormones/période menstruelle.
- **Périménopause & ménopause** : sommeil, énergie, humeur, stress, digestion, douleurs et ballonnements déjà présents + futur protocole périménopause/ménopause automatiquement reconnu par son intitulé.
- **Jeûne intermittent** : dernière heure de repas de la veille + première heure de repas du jour depuis Ma journée alimentaire pour calculer la fenêtre observée, puis faim/énergie/confort de rupture/satiété/digestion quand disponibles + protocole Jeûne intermittent.
- **Réduction du sucre** : sucres **totaux documentés** dans l’alimentation, envies/faim/stress/fatigue structurés + protocole Stop Sucre. Le patch ne présente jamais les sucres totaux comme des sucres ajoutés.
- **Nutrition végétale & micronutriments** : calories/macros utiles, protéines, fibres, sucres et micronutriments réellement disponibles dans les aliments/quantités renseignés. Une donnée absente n’est jamais inventée.
- **Changer une habitude** : confiance/difficulté lorsqu’elles ont été explicitement renseignées dans un journal de protocole compatible + contexte de protocoles habitudes/stress/sucre/alcool. Aucun succès n’est auto-validé sans signal explicite.
- **Pas & marche** : données Méthode Tee déjà présentes + Apple Santé comme source passive privilégiée pour les pas/marche lorsqu’il n’existe pas de saisie manuelle explicite.

## Protocoles

Le patch étend la projection des journaux privés de protocole **uniquement pour des questions clairement orientées avec réponse numérique 1–10**. Le texte libre n’est jamais interprété automatiquement comme un symptôme ou une mesure.

Les protocoles en cours sont aussi utilisés comme **contexte** quand leur titre correspond au suivi. Le simple fait de suivre un protocole ne crée jamais une donnée de santé fictive.

## Calendrier

Aucun `user_tracker_entries` artificiel n’est créé pour les données reliées. Une information provenant d’un repas, du Journal, d’un protocole ou d’un autre suivi reste rattachée à sa vraie date/source dans le Carnet. La couche connectée ne fait que la relire pour le suivi concerné.

## Performance / Supabase

- aucune nouvelle table ;
- aucune duplication d’historique ;
- une RPC compacte `mt_tracker_connected_context(...)` ;
- fenêtre maximale de 365 jours ;
- aucun texte libre de Journal/protocole renvoyé ;
- repas : uniquement horaires + agrégats compacts déjà calculés ;
- cache client 5 minutes, partagé entre les suivis pour une même période ;
- cache invalidé lorsqu’une donnée quotidienne change ;
- si le SQL V465 n’est pas installé, les suivis continuent de fonctionner avec leur comportement précédent sans crash.

## Installation

### 1. GitHub

Copier les fichiers du patch en conservant exactement leurs chemins :

- `scripts/custom-trackers.js`
- `scripts/v18-premium.js`
- `www/scripts/custom-trackers.js`
- `www/scripts/v18-premium.js`
- `supabase/V465_SUIVIS_CONNECTES_APP_FIRST.sql`
- `www/supabase/V465_SUIVIS_CONNECTES_APP_FIRST.sql`

### 2. Supabase

Dans **Supabase → SQL Editor → New query**, ouvrir puis exécuter une seule fois :

`supabase/V465_SUIVIS_CONNECTES_APP_FIRST.sql`

La migration est idempotente : elle fait `create or replace function` et ne crée aucune table.

### 3. Test conseillé

1. Renseigner une durée de sommeil dans Méthode Tee, puis ouvrir **Sommeil approfondi** : l’historique/aperçu doit déjà la reconnaître avant Apple Santé.
2. Ajouter un repas complet, puis ouvrir **Équilibre alimentaire**, **Nutrition végétale & micronutriments**, **Réduction du sucre** ou **Jeûne intermittent** : les données compatibles doivent apparaître comme reliées à Méthode Tee.
3. Renseigner stress/digestion dans le Journal, puis ouvrir les suivis correspondants.
4. Ouvrir **Pas & marche** avec Apple Santé : les données passives Apple doivent rester privilégiées en l’absence de saisie manuelle explicite.
5. Vérifier qu’aucune nouvelle ligne artificielle n’est créée dans `user_tracker_entries` simplement parce qu’un suivi a relu une donnée existante.

## Garde-fous

- une absence reste une absence ;
- une association entre deux données n’est pas présentée comme une causalité ;
- un protocole ne génère jamais à lui seul un symptôme ;
- sucres totaux ≠ sucres ajoutés ;
- Apple Santé ne remplace pas une saisie explicite Méthode Tee ;
- le profil sert de contexte/point de départ, pas de faux historique rétroactif.
