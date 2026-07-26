# PATCH V261 — Immersion complète + refonte prioritaire des types

Base de référence : `M-thode-TEE-wellness-main 258(11).zip`.

Ce patch remplace les essais V259/V260. Il regroupe :

1. les correctifs de performance et de persistance de **Notre journée ensemble** ;
2. tous les éléments obligatoires du README `README_IMMERSION_METHODE_TEE(2).md` ;
3. la refonte prioritaire des types **Tableau**, **Suivi**, **Plan du parcours**, **Checklist**, **Routine**, **Playlist** et **Journal privé**.

## SQL unique à exécuter

Dans Supabase → SQL Editor, exécuter uniquement :

```text
supabase/V261_IMMERSION_COMPLETE_ET_TYPES.sql
```

Ne pas exécuter les anciens scripts V259/V260 pour cette fonctionnalité.

## Notre journée ensemble — architecture finale

Le module est totalement indépendant de `daily_rituals`.

Tables dédiées :

- `community_journey_settings` ;
- `community_journey_items` ;
- `community_journey_completions` ;
- `community_journey_participation`.

Aucune requête de l’Immersion ne lit ou n’écrit dans `daily_rituals`.

### Administration

La rubrique **Immersion — Notre journée ensemble** permet :

- de choisir une date précise ;
- de naviguer au jour précédent ou suivant ;
- de préparer plusieurs jours à l’avance ;
- de dupliquer une journée vers une autre date ;
- de remplir ou laisser vide chacune des 6 tranches ;
- de choisir manuellement la tranche indépendamment de l’heure ;
- de saisir n’importe quelle heure, y compris 21 h 30, 23 h ou plus tard ;
- de sélectionner maximum 4 cartes avec `show_on_home` ;
- de définir l’ordre ;
- de créer des pills personnalisées ;
- de personnaliser les textes avant et après validation ;
- de relier une publication, recette, plante, audio, page, protocole, PDF ou URL ;
- de configurer une notification facultative ;
- de choisir le fuseau local ou Europe/Paris ;
- d’afficher/masquer le compteur et choisir son seuil ;
- de voir un aperçu mobile 2 × 2 ;
- de contrôler la longueur des titres et textes courts.

La sauvegarde utilise uniquement :

- `INSERT` pour un nouvel élément ;
- `UPDATE` pour un élément existant ;
- archivage ciblé pour un élément retiré.

Aucune suppression globale n’est exécutée.

### Côté utilisatrice

- le bloc existant « Échos du journal » est réutilisé ;
- aucune nouvelle grande section n’est ajoutée ;
- maximum 4 cartes sélectionnées apparaissent en grille 2 × 2 ;
- les cartes conservent leur hauteur actuelle ;
- la zone membres + progression reste compacte ;
- les pills proviennent de l’admin et utilisent le même état que leur carte ;
- le clic ouvre instantanément la vue complète déjà présente dans le DOM ;
- les 6 tranches Réveil / Matin / Déjeuner / Après-midi / Soir / Nuit sont toujours visibles dans la grande jauge ;
- une tranche vide est estompée et ne compte pas dans le dénominateur ;
- la progression est calculée avec le nombre réel de rendez-vous ;
- les validations sont relues depuis Supabase puis fusionnées avec le cache hors ligne ;
- le même compte retrouve sa progression sur un autre appareil ;
- la journée est réévaluée au retour de l’arrière-plan et après minuit ;
- aucun horaire de secours n’est inventé ;
- une journée vide affiche un message élégant ;
- la participation est comptée une fois par membre et par date lors de l’ouverture de la vue complète ;
- le compteur affiche les formulations compactes sous le seuil de 50 et le chiffre réel à partir de 50 ;
- aucune fausse valeur aléatoire n’est créée.

### Notifications

Les champs de notification sont administrables par rendez-vous.

Sur iPhone, si les rappels natifs sont déjà activés par l’utilisatrice :

- les notifications du jour sont réconciliées une seule fois au chargement du payload ;
- aucune permission supplémentaire n’est demandée silencieusement ;
- aucun timer permanent, polling ou `setInterval` n’est ajouté ;
- les notifications précédentes de l’Immersion sont annulées avant remplacement afin d’éviter les doublons ;
- les brouillons et éléments archivés ne sont jamais programmés ;
- le deep link ouvre `#daily-journey`.

Le rappel natif existant portant l’identifiant `73001` n’est jamais modifié.

## Performance

- une seule RPC `community_journey_payload(date)` charge les éléments, réglages, validations et compteur ;
- cache local court de 5 minutes ;
- aucun `setInterval` ;
- aucun `MutationObserver` ;
- aucun polling ;
- aucun rechargement global de l’accueil après une action ;
- un seul écouteur de clic délégué pour tout le module ;
- la vue détaillée utilise les données déjà en mémoire ;
- `v18-premium.js` détecte le contrôleur V261 et ne contrôle plus la même zone ;
- aucun rendez-vous d’une autre date n’est chargé côté utilisatrice.

## Refonte des types

### Tableau

- ne déclenche plus le tracker ;
- première ligne utilisée comme en-têtes ;
- 2–3 colonnes : vrai tableau premium avec défilement horizontal doux ;
- 4 colonnes et plus : cartes verticales adaptées au mobile ;
- aucun curseur.

### Suivi

Composant indépendant acceptant :

- nombre ;
- durée ;
- unité ;
- choix ;
- texte court ;
- texte long ;
- oui/non ;
- date.

### Autres types

- Plan du parcours : chronologie réelle ;
- Checklist : sections, barre et progression ;
- Routine : séquence guidée, une étape à la fois ;
- Playlist : aucune piste fictive ;
- Journal privé : le type choisi dans l’admin reste prioritaire.

L’admin affiche une aide de syntaxe adaptée au type sélectionné.

## Systèmes strictement intacts

Le patch ne modifie pas :

- StoreKit 2 ;
- Stripe ;
- validation Apple ;
- restauration des achats ;
- Product IDs ;
- `user_protocols` ;
- `protocol_progress` ;
- déblocages quotidiens ;
- recettes marketplace ;
- authentification Supabase ;
- navbar ;
- rappels natifs existants.

## Contrôles effectués

- `node --check` réussi sur tous les JavaScript modifiés ;
- copies racine et `www/` synchronisées ;
- aucune référence à `daily_rituals` dans `daily-journey.js` ou le SQL V261 ;
- aucune suppression globale dans le module V261 ;
- aucun `setInterval` ou `MutationObserver` ajouté.
