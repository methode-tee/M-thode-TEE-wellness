# V4896596H — Adapter V-only, formule d'abord

Ce patch corrige uniquement le branchement de l'Adapter. Il ne reconstruit pas les 3 794 profils et ne modifie pas les memberships V validés en G4.

## 1. Supabase
Exécuter une seule fois :

`supabase/00_INSTALL_V4896596H_FORMULA_FIRST_V_ONLY.sql`

Le résultat final doit contenir :
- `status = V4896596H_INSTALLED`
- `rpc_exists = true`
- `foods_without_exact_v = 0`
- `non_exact_memberships = 0`
- `identity_mismatches = 0`

## 2. Web
Remplacer les six fichiers fournis :
- `food-adapter.html`
- `scripts/adapter-v-engine.js`
- `scripts/food-adapter.js`
- `www/food-adapter.html`
- `www/scripts/adapter-v-engine.js`
- `www/scripts/food-adapter.js`

## Règle installée
Pour un repas principal : rôles exacts -> formule fixe -> si complet, arrêt -> sinon intersection des V -> candidats exacts du même V.

Il n'y a plus de question « En faire un repas / Garder cet aliment seul » pour un aliment simple.

Un repas `protein + starch + vegetable` est déclaré complet immédiatement, même si les trois fiches n'ont aucun V commun.

Les plats préparés/composés restent protégés et ne sont pas forcés dans cette formule.
