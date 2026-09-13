# CP495R14.1 — Fallback universel standalone

Ce patch remplace CP495R13 + CP495R14. Il part directement de la baseline CP495R12.1 déjà installée.

## Pourquoi
Le premier CP495R14 exigeait CP495R13, que tu n'avais pas installé. R14.1 contient donc lui-même le resolver fallback complet.

## Principe
1. Résolution exacte d'abord.
2. Si elle échoue, extraction linguistique de l'aliment de base.
3. Si la formulation contient des mots non prévus, TEE cherche aussi des spans/n-grams connus dans la phrase : ce mécanisme évite de dépendre d'une liste finie de formulations humaines.
4. Les états (cru, grillé, vapeur, rôti, fumé, mariné, etc.) servent à classer les fiches.
5. Un fallback n'est jamais auto-validé : même s'il ne reste qu'une fiche plausible, l'écran demande confirmation.
6. Si aucun aliment connu n'est retrouvable, le fail-closed reste en place.

## Installation
1. Exécuter `CP495R14_1_SQL_A_EXECUTER.sql`.
2. Envoyer `cp495r14_1_audit`.
3. Si l'audit est bon, uploader les deux fichiers frontend :
   - `scripts/food-adapter.js`
   - `www/scripts/food-adapter.js`

Ne pas exécuter CP495R13 ni l'ancien CP495R14 avant ce patch.
