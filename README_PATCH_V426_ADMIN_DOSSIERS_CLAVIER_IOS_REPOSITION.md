# PATCH V426 — Admin dossiers + clavier iOS stable

Base exacte : `M-thode-TEE-wellness-main 383.zip`
Version applicative : 1.1.0 · build 43

## 1. Admin
- Le ruban horizontal de navigation (`Protocoles`, `Nutrition & recettes`, etc.) qui restait collé en haut pendant le scroll est supprimé.
- Les grands dossiers/accordéons restent en place : Aujourd’hui & communauté, Posts & pages, Protocoles, Nutrition & recettes, Bibliothèque, Clients & accès, Outils & réglages.
- Le regroupement de l’Admin continue donc à fonctionner, sans élément flottant supplémentaire.

## 2. Clavier / zoom Safari iPhone
Le problème venait du zoom automatique natif de Safari lorsqu’un champ de saisie a une taille de texte calculée inférieure à 16 px. Une fois Safari zoomé, la page pouvait rester agrandie après fermeture du clavier.

V426 corrige le problème à la source :
- sur écran tactile mobile, les champs `input`, `textarea`, `select` et champs éditables utilisent au minimum 16 px pendant la saisie ;
- aucun `maximum-scale=1` / blocage du zoom utilisateur n’est ajouté ;
- la position de la page avant saisie est mémorisée ;
- après fermeture réelle du clavier, la hauteur stable est restaurée puis le scroll revient automatiquement à sa position d’avant saisie ;
- le passage d’un champ à un autre ne déclenche pas de repositionnement intermédiaire ;
- le correctif est global à l’app, pas uniquement à la fiche boisson.

## 3. Cache
Les pages concernées chargent maintenant `scripts/app.js?v=v426-ios-input-reset-r1`.
L’Admin charge `scripts/admin-studio-organizer.js?v=v426-admin-folders-only-r1`.

## Installation
Aucun SQL supplémentaire.

Après avoir uploadé le patch :

```bash
cd ~/methode-tee-capacitor
git status
git pull origin main
npx cap sync ios
npx cap open ios
```

Tester notamment : Carnet > Ajouter une boisson > Quantité, Nom de la boisson, recherche ingrédient, ainsi qu’un champ numérique d’un suivi.
