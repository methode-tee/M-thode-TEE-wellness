# PATCH V314 — Bouton Apple sous Notifications + version 1.0.1

## Modifications

- Déplacement de « Restaurer mes achats Apple » :
  - après la carte « Notifications » ;
  - juste avant le bloc « Méthode Tee — Version ».
- Suppression de son ancien emplacement sous « Gérer mes accès ».
- Version visible mise à jour de 1.0.0 vers 1.0.1.

## Fichiers à remplacer

- scripts/app.js
- www/scripts/app.js

## Pourquoi 1.0.1 ?

Il s’agit du prochain build correctif de la version 1.0.0 :
- corrections d’interface ;
- corrections de connexion ;
- ajustements du Profil ;
- aucune rupture majeure du produit.

La version publique logique est donc 1.0.1.
Le numéro de build Xcode doit aussi être augmenté séparément dans App Store Connect/Xcode.

## Performance

- aucune nouvelle requête ;
- aucun nouveau script ;
- aucun cache ;
- aucune modification StoreKit ;
- déplacement HTML uniquement.
