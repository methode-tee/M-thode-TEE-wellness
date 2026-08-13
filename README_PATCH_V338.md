# PATCH V338 — Journal réouvrable + Mes repères avancés

Base : ZIP 321 fourni le 13 août 2026.

## 1. Correction du Journal privé

Le formulaire Journal était déplacé sous `<body>` pour corriger iOS, mais `Mon parcours` recréait ensuite un deuxième `#jformModal` à chaque réouverture. Cela pouvait rendre la croix inactive au deuxième passage.

V338 transforme le formulaire Journal en **singleton global** :
- un seul `#jformModal` existe à la fois ;
- il reste attaché à `<body>` ;
- les doublons éventuels sont supprimés ;
- fermeture = nettoyage complet ;
- réouverture depuis Profil ou Carnet réutilise le même moteur.

Aucun changement aux données du Journal.

## 2. Mes repères personnalisés — architecture avancée

Ajout dans **Mon parcours** d'un bloc « Mes repères personnalisés ».

L'utilisateur peut activer uniquement les suivis qui l'intéressent :

### Mon alimentation
- Faim & satiété
- Rapport au sucre
- Équilibre alimentaire

### Mon corps
- Évolution corporelle
- Peau
- Reflux & aigreurs
- Sommeil approfondi

### Ma performance
- Performance sportive
- Football
- Récupération

### Mon rythme hormonal
- Cycle menstruel
- Périménopause & ménopause

### Mes habitudes
- Jeûne intermittent
- Changer une habitude

Aucun suivi n'est activé automatiquement.

## 3. Performance / Supabase

Le module est volontairement **lazy-loaded** :
- `personal-trackers.js` n'est PAS chargé au démarrage de l'app ;
- il est téléchargé seulement lorsque `Mon parcours` est ouvert ;
- aucune requête Supabase des suivis avancés sur Accueil / Profil / Carnet au chargement ;
- les préférences sont relues sur Supabase uniquement quand l'utilisateur ouvre « Personnaliser mes suivis » ;
- la page `Mon parcours` affiche d'abord le petit cache local des préférences ;
- une saisie quotidienne = un seul `upsert` ;
- aucun Realtime ;
- aucun historique 30/90 jours chargé automatiquement ;
- les futurs historiques utiliseront les index `(user_id, date)` et `(user_id, tracker_key, date)`.

Cela évite d'ajouter du travail au démarrage de l'app et préserve le comportement performant actuel.

## 4. SQL à exécuter une fois dans Supabase

Copier-coller le fichier :

`supabase/V338_SUIVIS_PERSONNALISES.sql`

Il crée seulement deux tables :
- `user_tracker_preferences`
- `user_tracker_entries`

avec RLS stricte par `auth.uid()` et deux index ciblés.

Si le SQL n'a pas encore été exécuté, l'écran de personnalisation peut s'afficher grâce au cache local, mais les entrées quotidiennes ne pourront pas être synchronisées dans le compte.

## Fichiers modifiés
- `scripts/journal.js`
- `www/scripts/journal.js`
- `index.html`
- `library.html`
- `dashboard.html`
- `www/index.html`
- `www/library.html`
- `www/dashboard.html`

## Fichiers ajoutés
- `scripts/personal-trackers.js`
- `www/scripts/personal-trackers.js`
- `supabase/V338_SUIVIS_PERSONNALISES.sql`
- `README_PATCH_V338.md`

## Non touché
- StoreKit 2
- Stripe
- validation/restauration Apple
- Product IDs
- achats Supabase
- architecture de déblocage des protocoles
- `prewarm.js`
- service worker
- CIQUAL
- moteur alimentaire
- logique de déblocage quotidien
