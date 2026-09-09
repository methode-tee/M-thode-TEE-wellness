# Méthode TEE — V489.1
## Univers CIQUAL complet + assembleur déterministe

V489.1 corrige la séparation artificielle entre le catalogue de 32 plats et l'univers alimentaire réel.

### Ce que le cerveau voit désormais
`mt_planner_ciqual_universe_v1()` expose **toutes les lignes présentes dans `ciqual_foods`**, sans limite à 32, 60 ou 500. Le nombre exact dépend de la base Supabase vivante et est renvoyé dans `v4891_result.counts.ciqual_universe_total`.

Chaque référence reçoit un rôle culinaire déterministe : protéine, protéine végétale, féculent, légume, plat composé, fruit, produit laitier, condiment/matière grasse, boisson, etc.

### Important : aliment ≠ repas
Toutes les références sont accessibles au cerveau, mais TEE ne présente pas « huile d'olive » ou « farine » comme dîner. Les aliments simples deviennent des **briques**. Le frontend construit ensuite des assiettes complètes de type :

`protéine + féculent + légume`

Les plats CIQUAL composés plausibles peuvent aussi entrer directement comme candidats.

### Prix
TEE ne chiffre pas les milliers de références à chaque écran. Elle considère tout l'univers pour déterminer un réservoir pertinent, puis chiffre uniquement une shortlist par `mt_planner_ciqual_price_batch_v1()`.

Les repas assemblés ne sont admis dans le pool fiable que si leurs composants sont chiffrables. Un prix inconnu reste inconnu et n'est jamais remplacé par 0 €.

### Ce qui reste intact
- V489.0 et son optimisation hebdomadaire ;
- mémoire personnelle et cerveau holistique ;
- rotation des recommandations ;
- recettes TEE et 17 plats whole-dish stricts ;
- sécurité phyto ;
- paiements / droits / protocoles ;
- données CIQUAL elles-mêmes.

## Installation
1. Exécuter uniquement `supabase/V4891_UNIVERS_CIQUAL_3400_ASSEMBLEUR_DETERMINISTE.sql`.
2. Envoyer le JSON `v4891_result`.
3. Si les deux RPC sont `true`, remplacer les quatre fichiers frontend :
   - `tee-next.html`
   - `www/tee-next.html`
   - `scripts/tee-next.js`
   - `www/scripts/tee-next.js`
4. Tester d'abord sur `methodetee.app`.
