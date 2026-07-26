# PATCH V259 — Notre journée ensemble

## Objectif
Transformer le bloc « Ton espace du jour » en « Notre journée ensemble », sans réduire les quatre cartes existantes et sans toucher aux achats, aux protocoles, aux recettes, aux déblocages ou à StoreKit/Stripe.

## Rendu
- Accueil : 4 rendez-vous maximum dans la grille 2 × 2 existante, taille des cartes strictement conservée.
- Ajout très léger sous la grille : participation communautaire + jauge personnelle.
- Clic sur le bloc ou une carte : ouverture instantanée de la vue détaillée déjà présente dans le DOM, sans écran blanc ni nouveau chargement de page.
- Retour instantané vers l’accueil avec conservation du scroll.

## Admin
Jusqu’à 6 rendez-vous, avec pour chacun : heure libre, icône, titre, sous-titre, dates de début/fin, jours de semaine, cible facultative (recette, protocole, page, post, PDF, audio ou URL). Aucune heure n’est codée en dur.

Réglages communautaires :
- afficher/masquer ;
- seuil minimal ;
- 0 : masqué ; 1 : « Tu lances le mouvement » ; 2–9 : « Quelques membres avec toi » ; 10–49 : « La communauté avance » ; 50+ : nombre réel.

## Performance
- données du jour chargées en une requête groupée ;
- cache local immédiatement réutilisé ;
- vue détaillée rendue avec les mêmes données en mémoire ;
- mise à jour optimiste des validations ;
- synchronisation Supabase en arrière-plan ;
- aucune image distante ni animation lourde ;
- module isolé `scripts/daily-journey.js`.

## Installation Supabase
Exécuter une seule fois :
`supabase/V259_NOTRE_JOURNEE_ENSEMBLE.sql`

## Fichiers modifiés/ajoutés
- `index.html`
- `style.css` / `styles/style.css`
- `scripts/daily-journey.js` (nouveau)
- `scripts/admin.js`
- `scripts/prewarm.js`
- `admin.html`
- `supabase/V259_NOTRE_JOURNEE_ENSEMBLE.sql` (nouveau)

## Sécurité
Le compteur n’expose aucun identifiant : seule une fonction SQL retourne un total. Les validations et participations sont protégées par RLS et limitées à l’utilisateur connecté.
