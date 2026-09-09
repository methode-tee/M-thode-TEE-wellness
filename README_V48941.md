# V489.4.1 — Catalogue culinaire TEE validé

## Objectif

Remplacer l'assembleur libre « protéine + féculent + légume » par une vraie base de connaissance culinaire TEE.

- Les 3 585+ références CIQUAL restent visibles au cerveau TEE pour comprendre, calculer, rapprocher les habitudes et chiffrer.
- Le planificateur ne crée plus de repas en combinant librement trois références CIQUAL.
- 300 repas éditoriaux sont chargés comme base de connaissance.
- Chaque composant est résolu côté serveur vers un code CIQUAL explicite avant publication.
- Un repas n'est publié automatiquement que si tous ses composants obligatoires ont une résolution CIQUAL forte.
- Les plats culturels spécifiques de niveau 2 restent en revue manuelle par défaut.
- Les doublons pour lesquels une version whole-dish stricte existe déjà restent désactivés.
- En secours, le planner utilise uniquement les recettes/whole-dishes existants et les plats composés CIQUAL existants, jamais l'assembleur libre.

## Installation

1. Ne pas exécuter V489.4 d'origine.
2. Si V489.3.1 n'a jamais été exécuté, ce n'est pas bloquant : V489.4.1 embarque ses définitions backend critiques.
3. Exécuter uniquement :

`supabase/V48941_CATALOGUE_CULINAIRE_TEE_VALIDE.sql`

4. Envoyer le JSON `v48941_result`.
5. Si `curated_catalog_v2_rpc=true`, remplacer ensuite :
   - `scripts/tee-next.js`
   - `www/scripts/tee-next.js`
   - `tee-next.html`
   - `www/tee-next.html`

## Important

Le champ `published` n'a pas vocation à être 300 dès l'installation. C'est volontaire.

`loaded = 300` signifie que les 300 repas sont dans la base éditoriale.
`published` signifie que le repas a passé les contrôles de résolution CIQUAL forte et les règles éditoriales.
`draft` signifie que la ligne reste connue mais n'est pas encore autorisée à entrer dans le planner.

Ce patch préfère 180 repas propres à 300 repas approximatifs.

## Hiérarchie culturelle

- Niveau 0 : mainstream / immédiatement compréhensible.
- Niveau 1 : découverte accessible.
- Niveau 2 : découverte culturelle spécifique, second plan par défaut.

Les 240 assiettes TEE génériques passent au niveau 0.
Les plats nommés sont reclassés individuellement.
Les doublons déjà chiffrés en whole-dish strict sont désactivés dans ce catalogue pour éviter les collisions.

## Garde-fous

- aucun prix inconnu compté comme 0 ;
- aucun assemblage libre CIQUAL au runtime ;
- aucune ligne CIQUAL modifiée ;
- aucune recette modifiée ;
- aucune donnée de paiement/protocole/voix modifiée ;
- rotation sémantique V3 conservée ;
- fromage/paneer peut être un composant protéique uniquement dans un repas éditorial explicitement validé, jamais via l'assembleur automatique.
