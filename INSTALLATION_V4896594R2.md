# V4896594R2 — CONTINUATION APRÈS CP483B

Le résultat CP483B avec `fiches_sauvegardees=19` est un SUCCÈS. Les deux `false` étaient attendus : CP483B ne devait pas installer les formules complètes.

Ne relance plus CP483A/CP483B et n'exécute pas leur rollback. N'utilise pas l'ancien V4896594R1.

SQL à exécuter dans cet ordre :
1. supabase/00_INSTALL_V4896594_PROFILS_FORMULES_TRIGGER_SAFE.sql
2. supabase/01_PROFILE_BUCKET_0_1.sql
3. supabase/02_PROFILE_BUCKET_2_3.sql
4. supabase/03_PROFILE_BUCKET_4_5.sql
5. supabase/04_PROFILE_BUCKET_6_7.sql
6. supabase/05_AUDIT_FINAL_V4896594.sql

Le fichier 00 vérifie lui-même que CP483B est réellement installé (19 backups, 19 overrides, trigger actif). Il garde le trigger CP483B, remplace V6592 par V6594 et ajoute un finaliseur après CP483B pour que le profil déterministe soit calculé sur la classification finale.

Après 05, envoie les JSON d'audit AVANT de remplacer les fichiers web.

Quand l'audit est propre, remplacer : food-adapter.html, scripts/food-adapter.js, scripts/adapter-completion.js et leurs copies www/.
