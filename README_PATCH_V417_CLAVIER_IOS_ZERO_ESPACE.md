# MÉTHODE TEE — PATCH V417 · CLAVIER iOS / SAFARI · ZÉRO ESPACE FANTÔME

Base : ZIP 374 / version iOS 1.1.0 build 40  
Sortie : **version iOS 1.1.0 build 41**

## Problème corrigé
Sur certains focus de champ texte — particulièrement **Carnet → Ajouter une boisson** — Safari/iOS pouvait afficher une grande zone beige vide entre le contenu et le clavier. Le phénomène était intermittent car il dépendait du timing de l'animation `visualViewport`.

## Cause réelle
Le correctif V414 conservait volontairement une hauteur plein écran pendant l'ouverture du clavier. Or l'app utilise `.page` comme vrai conteneur de scroll, tandis que le recalage V414 clampait surtout `window.scrollY`. Safari pouvait donc :
- réduire son viewport visible ;
- garder la shell à sa hauteur avant clavier ;
- conserver la navbar invisible mais encore présente dans le flux flex ;
- conserver le padding bas de 126 px des écrans Food ;
- laisser `.page.scrollTop` momentanément hors de sa plage utile.

La combinaison produisait exactement la zone vide visible sur la capture utilisateur.

## V417
Le correctif est partagé par **tous les écrans Carnet qui chargent `food-core.js`** :
- Ajouter une boisson ;
- Journée alimentaire ;
- Ajouter/modifier un repas ;
- Adapter mon repas ;
- Inspire-moi avec ce que j'ai.

Pendant la saisie :
1. la hauteur de la shell suit réellement `window.visualViewport.height` ;
2. la navbar est retirée du flux avec `display:none` et ne réserve donc plus aucun espace invisible ;
3. le gros padding bas historique des pages Food est remplacé temporairement par 18 px ;
4. le recalage vise désormais `.page.scrollTop`, le vrai scroller de l'app ;
5. le champ actif est maintenu dans la zone visible ;
6. à la fermeture, la navbar ne revient qu'après récupération stable de la hauteur du viewport ;
7. le scroll est reclampé sur deux frames avant/après la restitution finale.

## Cache
Les 5 écrans Food utilisent maintenant :
- `styles/food.css?v=v417-keyboard-no-gap`
- `scripts/food-core.js?v=v417-keyboard-no-gap`

Cela évite qu'un ancien correctif clavier reste chargé depuis le cache Safari/GitHub Pages.

## iOS
- Version : **1.1.0**
- Build : **41**
- HealthKit V416 conservé.
- Push APNs V414 conservé.
- Aucun SQL.
- Aucun secret supplémentaire.
- Aucun package npm supplémentaire.

## Vérifications
- `node --check scripts/food-core.js` et copie `www` ;
- parité racine / `www` des fichiers JS/CSS concernés ;
- présence du cache-buster V417 sur les 5 écrans racine et `www` ;
- version Xcode Debug + Release : 1.1.0 build 41 ;
- ZIP d'origine conservé comme base, aucun changement HealthKit/APNs fonctionnel.

Le comportement final du clavier iOS doit être validé sur iPhone physique, car Safari/WKWebView est seul à fournir l'animation `visualViewport` exacte.
