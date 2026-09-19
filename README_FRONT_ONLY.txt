V4896672 — ALL MOMENTS SERVER AUTHORITATIVE

Backend already active in Supabase:
- canonical_alias_memory = true
- exact_duplicate_server_dedup = true
- broad_cluster_memory_smearing = false
- event_memory_dedup_by_day = true

Front invariants:
1. Breakfast, lunch, snack and dinner ALL enter the structured/unified path.
2. A snack with only ONE required role no longer falls back to the old generic ranking.
3. A snack with ZERO useful roles does not manufacture legacy suggestions.
4. If the unified RPC answers for a role, the front NEVER substitutes generic legacy candidates.
5. Unified ranking uses meal_manifest_final_rank from Supabase.
6. No legacy breakfast/snack re-ranking for unified payloads.
7. No broad-cluster hard dedupe in the front.
8. Fixes the latent undefined variable in structuredRoleStep.
9. Local meal-build key bumped to v4896672 to discard stale selections.
10. Grammar fix from V4896671 retained: “l’énergie reste”.

Cache busting:
v4896672-all-moments-server-authoritative-r1

No SQL in this ZIP.
No changes to Adapter mon repas, Ma journée alimentaire write path,
payments, unlocks, protocols or cached egress.

Replace exactly these 8 files:
- food-day.html
- index.html
- scripts/food-guidance.js
- scripts/home-smart-cards.js
- www/food-day.html
- www/index.html
- www/scripts/food-guidance.js
- www/scripts/home-smart-cards.js
