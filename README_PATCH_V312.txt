# PATCH V312 — Identification immédiate sur iOS

## Origine confirmée

Le problème était déjà présent dans l’ancienne version `main 304(8)` :
`auth.html` était identique dans les deux ZIP.

La page d’identification chargeait inutilement `scripts/v14-luxe.js`.
Ce script est destiné à l’accueil et lançait sur la page d’authentification :

- un écran de chargement plein écran pendant au moins 850 ms ;
- une transition de disparition de 420 ms ;
- des écouteurs et un MutationObserver sans utilité sur cette page.

Pendant cette période, le calque recouvrait les champs et interceptait les premiers touchers.
Cela explique qu’il fallait appuyer plusieurs fois ou attendre avant que le clavier s’ouvre.

## Correction

- suppression du loader plein écran sur `auth.html` ;
- suppression de `v14-luxe.js` uniquement sur la page d’identification ;
- ajout de `touch-action: manipulation` sur les champs et boutons ;
- aucune modification de Supabase, de la connexion ou de l’inscription.

## Fichiers à remplacer

- `auth.html`
- `www/auth.html`

## Performance

Cette correction allège la page :

- aucun nouveau script ;
- aucune requête ;
- aucun cache ;
- un script lourd et inutile en moins ;
- focus et clavier disponibles dès l’affichage du formulaire.

## Test recommandé

1. Fermer complètement l’application.
2. La relancer déconnectée.
3. Dès que le formulaire apparaît, toucher une seule fois le champ Email.
4. Vérifier que le curseur et le clavier apparaissent immédiatement.
5. Répéter sur Mot de passe, Connexion et Inscription.
