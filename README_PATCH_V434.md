# PATCH V434 — Scan premium + suivis complets + clavier iOS stable

Base : `M-thode-TEE-wellness-main 392.zip`
Version applicative conservée : **1.1.0 (build 43)**

## Ce que corrige ce patch

### 1. Ajouter des aliments : hiérarchie plus premium
- La recherche reste l'action principale.
- Un séparateur discret **« ou »** distingue maintenant clairement la recherche du scan.
- La ligne visible **« Saisir un code »** a été retirée de l'écran principal.
- Il ne reste qu'une action propre : **« Scanner un produit »**.

### 2. Scanner un produit : choix au second niveau
Au toucher sur « Scanner un produit », une sheet Méthode Tee s'ouvre :
- dans l'app iPhone, choix entre **scanner avec l'appareil photo** et **saisir le code-barres** ;
- sur le web si le scanner natif n'est pas disponible, seule la saisie du code est proposée avec une explication discrète.

La saisie du code n'utilise plus une alerte/prompt système : elle passe par une sheet premium cohérente avec l'app.

### 3. Correctif clavier / grand espace iOS
- Suppression de l'auto-focus qui pouvait déclencher brutalement le clavier.
- `blur()` explicite avant fermeture.
- Restauration de la position de scroll après récupération du viewport, sur le même principe que les correctifs iOS déjà stabilisés dans l'app.
- L'ajout du produit attend la fermeture de la sheet avant de relancer l'interface.

### 4. Mes suivis : le 4e suivi n'est plus perdu
Le suivi **Stress & régulation** existait bien dans le moteur des suivis mais manquait dans la métadonnée d'affichage du Carnet. Il est maintenant reconnu dans « Mes suivis ».

Pour garder un rendu premium quand beaucoup de suivis sont actifs :
- 3 cartes complètes sont affichées directement ;
- au-delà, une ligne discrète **« Voir X autre(s) suivi(s) »** permet de déplier les autres ;
- tous restent actifs, accessibles et continuent à construire leur historique ;
- « Gérer » reste réservé à l'ajout/masquage/configuration.

### 5. Textes iOS cohérents avec les fonctions réelles
- `NSCameraUsageDescription` mentionne maintenant le scan de code-barres ainsi que les photos choisies par l'utilisateur.
- `NSHealthShareUsageDescription` mentionne les catégories HealthKit désormais proposées : sommeil, activité, récupération, cardio, cycle et repères corporels.
- Aucun changement d'écriture HealthKit : l'app reste en lecture seule pour Apple Santé.

## Préservé volontairement
- logique des 3 jauges ;
- Apple Santé / HealthKit ;
- calendrier et pills ;
- Routine du jour ;
- protocoles ;
- correctif V433 du retour en haut de l'Accueil ;
- Supabase / règles RLS ;
- aucune nouvelle requête périodique et aucun polling ;
- aucun SQL.

## Vérifications techniques
- `node --check scripts/food-meal.js` : OK
- `node --check scripts/v18-premium.js` : OK
- parité root / `www` vérifiée pour les JS/CSS/HTML concernés.
