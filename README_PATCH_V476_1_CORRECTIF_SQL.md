# PATCH V476.1 — Correctif SQL apprentissage individuel

Base : patch V476 sur `M-thode-TEE-wellness-main 429.zip`.

## Cause de l'erreur
PostgreSQL/PLpgSQL rejetait les expressions `CASE` placées directement dans la condition multi-ligne du `IF` qui décide si un modèle individuel est utilisable.

## Correctif
Les seuils de couverture, R² et RMSE sont désormais calculés dans des variables (`coverage_gate`, `r2_gate`, `rmse_gate`) avant le `IF`, puis la condition compare uniquement des valeurs simples.

La logique métier reste identique :
- 15–19 observations : couverture >= 65 %, R² >= 0,20, RMSE-z <= 1,10, score de fiabilité >= 65 ;
- 20–29 observations : couverture >= 55 %, R² >= 0,10, RMSE-z <= 1,20, score >= 62 ;
- 30+ : couverture >= 45 %, R² >= 0,05, RMSE-z <= 1,35, score >= 60.

## SQL à exécuter
Si le V476 précédent a échoué avec `syntax error at end of input`, exécuter uniquement :

`supabase/V476_1_CORRECTIF_SQL_APPRENTISSAGE_15_VERSION_1_1_3.sql`

Le script reste encapsulé dans `BEGIN ... COMMIT`.
