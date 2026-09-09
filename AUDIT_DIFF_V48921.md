# Audit V489.2 → V489.2.1

## Corrigé

1. **Collision UUID dynamiques**
   - V489.2 redéclarait `stableHash32()` et neutralisait les seeds de `stableUuidV4891()`.
   - V489.2.1 conserve une seule fonction seedée.

2. **Prix trop vieux**
   - V489.2 autorisait implicitement un prix paquet jusqu'à 365 jours.
   - V489.2.1 sépare : format 365 jours / prix 120 jours.
   - Un prix paquet périmé n'est jamais utilisé.

3. **Assemblages CIQUAL**
   - seuil de qualité culinaire `>= 0.72` ;
   - chaque composant principal doit passer un minimum de qualité ;
   - pénalité pour combinaisons très transformées ou redondantes ;
   - les 2 places réservées ne sont obligatoires que pour de vraies assiettes qualifiées, pas pour n'importe quel candidat dynamique.

4. **Preflight**
   - vérifie explicitement `mt_planner_ciqual_universe_v1()` et `mt_planner_ciqual_price_batch_v1(text[],text,text)`.

## Préservé

- aucune IA externe ;
- aucune modification CIQUAL ;
- aucune modification recettes/protocoles/paiements/voix ;
- mémoire individuelle existante réutilisée ;
- rotation persistante ;
- maximum 1 découverte culturelle spécifique par semaine ;
- inconnus jamais transformés en 0 €.

## QA local

`qa/test_v48921_planner.js` : semaine complète, budget respecté, rotation, 2 assemblages qualifiés, 1 culturel spécifique max, 10 000 UUID dynamiques uniques.

`qa/test_v48921_static.js` : vérifie seuil d'assemblage, séparation 365/120, preflight CIQUAL et absence de seconde déclaration `stableHash32()`.
