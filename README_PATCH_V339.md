# PATCH V339 — Journal privé + Ajouter un suivi dans Carnet

Base : `M-thode-TEE-wellness-main 321(1).zip` fourni le 13/08/2026.

## 1. Correction Journal privé
Le bug venait de plusieurs éléments `#jformModal` pouvant être recréés au fil des ouvertures de **Mon parcours**.
Le formulaire Journal est maintenant un **singleton global attaché à `<body>`** :
- une seule instance existe ;
- elle est réutilisée depuis Profil et Carnet ;
- fermeture / réouverture répétée sans dupliquer la modale ;
- la croix cible toujours la bonne instance.

Aucune modification du contenu, des données, des sliders ou de la sauvegarde du Journal.

## 2. « + Ajouter un suivi » placé dans Carnet
Ajouté dans **Carnet → Mes outils**, juste après **Trackers & checklists**.

Le choix est volontaire :
- Profil reste la vue synthèse ;
- Carnet devient l'endroit où l'utilisateur agit, renseigne et personnalise ses suivis.

## 3. Suivis personnalisés avancés
Le module propose notamment :
- Sommeil approfondi
- Confort digestif
- Reflux & aigreurs
- Équilibre alimentaire
- Évolution corporelle
- Peau
- Performance sportive
- Football
- Récupération
- Cycle menstruel
- Périménopause & ménopause
- Jeûne intermittent
- Réduction du sucre
- Changer une habitude

Chaque suivi activé peut être renseigné pour la journée et enregistré dans `user_tracker_entries`.
Les choix sont enregistrés dans `user_tracker_preferences`.

## 4. Performance / Supabase
Le module `custom-trackers.js` est **lazy-loaded uniquement au premier tap sur « + Ajouter un suivi »**.

Donc au démarrage normal :
- aucun chargement du module avancé ;
- aucune lecture de `user_tracker_preferences` ;
- aucune lecture de `user_tracker_entries` ;
- aucun historique ;
- aucun Realtime ;
- aucune modification de prewarm.

Un cache local très léger conserve seulement les suivis activés. Supabase n'est interrogé qu'à l'ouverture explicite du module ou lors d'un enregistrement.

## Prérequis Supabase
Les tables SQL déjà fournies doivent exister :
- `public.user_tracker_preferences`
- `public.user_tracker_entries`

## Fichiers
- `scripts/journal.js`
- `scripts/v18-premium.js`
- `scripts/custom-trackers.js` (nouveau)
- miroirs identiques dans `www/scripts/`

## Inchangé
- StoreKit 2
- Stripe
- validation/restauration Apple
- Product IDs
- architecture achats Supabase
- architecture de déblocage des protocoles
- CIQUAL / alimentation
- `prewarm.js`
- service worker
