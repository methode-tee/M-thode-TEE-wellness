# Audit V489.1 → V489.1.1

## Régression corrigée

- `fromage bleu` pouvait être `protein` via le fallback `protein_100g >= 13`.
- `ail` pouvait être `starch` via le fallback glucidique.
- `basilic` / `oignon` pouvaient devenir une portion végétale principale via les fallbacks nutritionnels.

## Nouvelle règle

Les rôles majeurs d'une assiette sont désormais déterminés par **identité culinaire explicite**, pas uniquement par les macros.

L'univers complet reste visible : les références non adaptées à un rôle principal reçoivent `dairy`, `aromatic`, `fruit`, `condiment_fat`, `sweet`, `beverage` ou `other`.

## Double protection

Le backend corrige `mt_ciqual_role_v1`. Le frontend applique également `ciqualAssemblySanity()` avant de constituer ses réservoirs, afin qu'un cache ancien ou une future dérive de classification ne puisse pas réintroduire ces exemples.
