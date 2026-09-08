# V487.3.1 — HOTFIX Méthode TEE+ invisible dans Profil

## Symptôme
Un grand espace vide apparaissait juste avant « Préférences et compte ».

## Cause
La section Méthode TEE+ était bien injectée dans le DOM, mais elle recevait la
classe `.reveal` après le passage de `observeReveal()`. Elle restait donc
`opacity: 0` tout en gardant toute sa hauteur.

## Correctif
Après insertion, V487.3.1 :
- relance `observeReveal()` quand il est disponible ;
- possède un fallback qui force `visible` si nécessaire.

## Résultat attendu
Entre « Mon suivi personnel » et « Préférences et compte » :
Méthode TEE+ · Aller plus loin
- Planifier ma semaine
- Sécurité plantes

Aucune 5e card n'est ajoutée au Carnet.

## Backend
Aucun SQL à exécuter.
V487.3 côté Supabase reste inchangé.
